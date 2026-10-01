// Cliente MCP minimo (SSE + JSON-RPC) para que el gateway lea Basic Memory por su cuenta.
// Una sesion por llamada: abre el SSE, inicializa, llama a la herramienta y cierra. Sin dependencias.

const CRLF = String.fromCharCode(13, 10);
const LF = String.fromCharCode(10);

/**
 * Llama a una herramienta MCP y devuelve su resultado ya interpretado (JSON).
 * Lanza Error('mcp_<motivo>') si el servidor no responde, tarda demasiado o devuelve un error.
 */
export async function callMcpTool({ base, auth, path = '/mcp', tool, args = {}, timeoutMs = 20000, fetchImpl = fetch }) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const headers = auth ? { authorization: auth } : {};
  const events = [];
  const waiters = [];
  const push = (ev) => {
    events.push(ev);
    for (const w of [...waiters]) w();
  };
  const wait = (pred) => new Promise((resolve, reject) => {
    const check = () => {
      const e = events.find(pred);
      if (e) { waiters.splice(waiters.indexOf(check), 1); resolve(e); return true; }
      return false;
    };
    if (check()) return;
    waiters.push(check);
    ac.signal.addEventListener('abort', () => reject(new Error('mcp_timeout')), { once: true });
  });

  try {
    const res = await fetchImpl(base + path, { headers: { ...headers, accept: 'text/event-stream' }, signal: ac.signal });
    if (res.status !== 200) throw new Error(`mcp_http_${res.status}`);
    (async () => {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        buf += dec.decode(value, { stream: true }).split(CRLF).join(LF);
        let i;
        while ((i = buf.indexOf(LF + LF)) >= 0) {
          const raw = buf.slice(0, i);
          buf = buf.slice(i + 2);
          push({ ev: /event: (.*)/.exec(raw)?.[1], data: /data: (.*)/s.exec(raw)?.[1] });
        }
      }
    })().catch(() => {});

    const ep = await wait((e) => e.ev === 'endpoint');
    const url = new URL(ep.data.trim(), base).toString();
    const post = (body) => fetchImpl(url, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ac.signal });
    const reply = async (id) => JSON.parse((await wait((e) => e.ev === 'message' && JSON.parse(e.data || 'null')?.id === id)).data);

    await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'omnia-portal', version: '1' } } });
    await reply(1);
    await post({ jsonrpc: '2.0', method: 'notifications/initialized' });
    await post({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: tool, arguments: args } });
    const out = await reply(2);
    if (out.error) throw new Error('mcp_error');
    const text = out.result?.content?.find((c) => c.type === 'text')?.text;
    if (out.result?.isError) throw new Error('mcp_tool_error');
    if (text === undefined) return out.result?.structuredContent ?? null;
    let parsed;
    try { parsed = JSON.parse(text); } catch { return text; }
    return parsed && typeof parsed === 'object' && 'result' in parsed ? parsed.result : parsed;
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'mcp_timeout' : e.message.startsWith('mcp_') ? e.message : 'mcp_unreachable');
  } finally {
    clearTimeout(timer);
    ac.abort();
  }
}
