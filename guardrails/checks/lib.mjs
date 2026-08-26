/**
 * lib.mjs — Librería única de guardrails de Omnia.
 *
 * Define QUÉ es peligroso, en un solo lugar. La consumen todos los puntos de
 * enforcement: hooks de IDE (Claude Code / Cursor vía precmd.mjs), git hooks
 * (pre-commit / pre-push) y cualquier check futuro. Sin dependencias externas.
 *
 * Cada función devuelve { block: boolean, level: 'deny'|'ask'|'allow', reason: string }.
 * - deny  → bloquear siempre (destructivo/irreversible).
 * - ask   → pedir confirmación humana (cambios en vivo, sensibles).
 * - allow → seguir.
 */

/** Rutas/archivos que NUNCA deben leerse por un agente ni entrar a git. */
const SECRET_PATH_PATTERNS = [
  /(^|[\\/])_secretos([\\/]|$)/i, // carpeta de secretos de C:\Claude
  /(^|[\\/])\.env(\.|$)/i, // .env, .env.local (no .env.example)
  /(^|[\\/])\.memory\.env$/i, // conexión de memoria del dev
  /(^|[\\/])\.dev\.json$/i, // identidad local de telemetría
  /(^|[\\/])id_rsa(\.|$)/i, // llaves ssh privadas
  /(^|[\\/]).*\.pem$/i,
  /(^|[\\/])(pass|apis?|credentials?|secrets?)[^\\/]*\.(txt|json|ya?ml)$/i,
];

/** Un .env.example / .memory.env.example SÍ es seguro (plantilla). */
function isExampleFile(p) {
  return /\.example($|\.)/i.test(p) || /\.example\.(json|env|ya?ml)$/i.test(p);
}

/**
 * ¿La ruta apunta a un secreto? (para lecturas/escrituras/commits)
 */
export function checkSecretPath(rawPath) {
  const p = String(rawPath || '');
  if (!p) return { block: false, level: 'allow', reason: '' };
  if (isExampleFile(p)) return { block: false, level: 'allow', reason: '' };
  for (const re of SECRET_PATH_PATTERNS) {
    if (re.test(p)) {
      return {
        block: true,
        level: 'deny',
        reason: `Ruta de secreto bloqueada por guardrails: ${p}. Los secretos no se leen ni se commitean (ver guardrails/policy.md).`,
      };
    }
  }
  return { block: false, level: 'allow', reason: '' };
}

/** Comandos catastróficos/irreversibles → deny (nunca, ni con override del agente). */
const DESTRUCTIVE = [
  { re: /\brm\s+(-[a-z]*\s+)*-[a-z]*r[a-z]*f|\brm\s+-[a-z]*f[a-z]*r/i, why: 'rm -rf recursivo/forzado' },
  { re: /\bdrop\s+(database|table|schema)\b/i, why: 'DROP de base de datos/tabla' },
  { re: /\btruncate\s+table\b/i, why: 'TRUNCATE TABLE' },
  { re: /\bbench\b[^\n]*\bdrop-site\b/i, why: 'bench drop-site (borra un site de Frappe)' },
  { re: /\bmkfs\b|\bdd\s+if=|>\s*\/dev\/(sd|nvme|disk)/i, why: 'operación de disco de bajo nivel' },
  { re: /:\(\)\s*\{\s*:\|:&\s*\}\s*;/, why: 'fork bomb' },
];

/** Peligroso pero recuperable/a veces intencional, o cambios en vivo → ask (confirmación humana). */
const LIVE_SENSITIVE = [
  { re: /\bgit\s+push\b[^\n]*\s(--force|-f)\b/i, why: 'git push --force (reescribe historia remota)' },
  { re: /\bgit\s+reset\s+--hard\b/i, why: 'git reset --hard (descarta cambios locales)' },
  { re: /\bgit\s+clean\s+-[a-z]*f/i, why: 'git clean -f (borra archivos no rastreados)' },
  { re: /\bCustom\s+DocPerm\b/i, why: 'inserción directa de Custom DocPerm (usar permission_manager por ROL)' },
  { re: /frappe\.db\.sql\([^)]*\b(delete|update|drop)\b/i, why: 'SQL directo de escritura sobre la DB del ERP' },
  { re: /\b(psql|mysql|mariadb)\b[^\n]*\b(-e|--execute)\b/i, why: 'ejecución directa contra base de datos' },
  { re: /\bcurl\b[^\n]*\bfrutal\.omniaos\.ai\b[^\n]*\b(-X\s*(POST|PUT|DELETE|PATCH))/i, why: 'mutación al ERP de producción en vivo' },
];

/**
 * ¿El comando de shell es peligroso?
 */
export function checkCommand(rawCmd) {
  const cmd = String(rawCmd || '');
  if (!cmd.trim()) return { block: false, level: 'allow', reason: '' };

  for (const { re, why } of DESTRUCTIVE) {
    if (re.test(cmd)) {
      return { block: true, level: 'deny', reason: `Comando destructivo bloqueado (${why}). Ver guardrails/policy.md.` };
    }
  }
  for (const { re, why } of LIVE_SENSITIVE) {
    if (re.test(cmd)) {
      return { block: true, level: 'ask', reason: `Operación sensible: ${why}. Confirma explícitamente antes de continuar.` };
    }
  }
  return { block: false, level: 'allow', reason: '' };
}

/**
 * Evalúa un evento de herramienta genérico (tool_name + input) y devuelve la
 * decisión más restrictiva. `input` puede traer .command (Bash) o .file_path
 * / .path (Write/Edit/Read).
 */
export function evaluateToolEvent(toolName, input) {
  const tool = String(toolName || '').toLowerCase();
  const i = input || {};
  const decisions = [];

  if (tool.includes('bash') || i.command) {
    decisions.push(checkCommand(i.command));
  }
  const filePath = i.file_path || i.path || i.filePath;
  if (filePath) decisions.push(checkSecretPath(filePath));

  // La decisión más severa gana: deny > ask > allow.
  const rank = { deny: 2, ask: 1, allow: 0 };
  return decisions.reduce(
    (worst, d) => (rank[d.level] > rank[worst.level] ? d : worst),
    { block: false, level: 'allow', reason: '' },
  );
}
