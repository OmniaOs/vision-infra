# Runbook — memoria compartida del equipo

Tres procedimientos distintos. Si tenés dudas sobre el diseño general (qué
es cada pieza, por qué existe Vaultwarden, qué escribir en la memoria), ver
primero [`INSTRUCTIVO.md`](INSTRUCTIVO.md), [`../vault/README.md`](../vault/README.md)
y [`CONVENCION-DE-CONTENIDO.md`](CONVENCION-DE-CONTENIDO.md). Esto es solo
la lista de pasos.

---

## 1. Alta de un dev nuevo

**Admin, una sola vez por persona:**

1. Invitala en Vaultwarden: `https://vault.omniaos.ai/admin` → Users →
   *Invite User* con su email. Le llega el mail (SMTP real ya configurado).
2. Cuando te pase su clave pública SSH (paso 3 de abajo), autorizala en
   `visiontunnel` en el VPS:
   ```bash
   # En server-omniaplatform (via OCC o SSH directo):
   echo "<su-clave-publica-completa>" >> /home/visiontunnel/.ssh/authorized_keys
   ```

**La persona nueva, una sola vez, en su primera máquina:**

1. Acepta la invitación por mail → crea su cuenta en Vaultwarden (su propia
   contraseña maestra, nadie más la ve).
2. Genera su propio par de llaves:
   ```powershell
   ssh-keygen -t ed25519 -C "su@omniaos.ai" -f "$HOME\.ssh\id_ed25519_omnia_memory"
   ```
3. Te pasa (al admin) el contenido del `.pub` — solo eso, nunca la privada.
4. Sube la **privada** (`id_ed25519_omnia_memory`, sin `.pub`) a su propio
   vault: Secure Note llamada exactamente `omnia-memory-tunnel-ssh-key`, con
   el archivo adjunto.
5. Corre el bootstrap — **no hace falta clonar ningún repo primero**:
   ```powershell
   irm https://vault.omniaos.ai/setup | iex
   ```
   Le pide: su email de Vaultwarden, su contraseña maestra (+2FA si la
   activó), y el `OMNIA_MEMORY_TOKEN` (se lo pasás vos — es el secret
   `OPENMEMORY_API_KEY` del recurso `memory-mem0` en Coolify, el mismo para
   todo el equipo).

**Cuando cambia de laptop:** repite *solo* el paso 5. El script no
encuentra la llave local, se loguea a su mismo Vaultwarden, la descarga
sola. Cero admin de por medio.

**Offboarding:** dos pasos, sin tocar la máquina de la persona — sacarla de
`authorized_keys` en `visiontunnel`, y removerla de Vaultwarden.

---

## 2. Configurar un repo **nuevo** (nunca tuvo memoria compartida)

Requisito: quien lo configure ya pasó por la Sección 1 en su máquina (el
túnel + `OMNIA_MEMORY_TOKEN` + `OMNIA_MEMORY_GLOBAL_MCP_URL` ya están
puestos como variables de usuario — eso es machine-wide, no hace falta
repetirlo por repo).

1. Elegí el **slug del proyecto** — un nombre corto y estable (`omniapos`,
   `frutal`, `chatbot`, `cfdi`, etc.). Aislá por cliente, no por
   feature/branch.
2. Agregá este bloque al `.mcp.json` del repo (creá el archivo si no
   existe), fusionando con lo que ya haya (ej. `dart` en OmniaPOS):

   ```json
   {
     "mcpServers": {
       "omnia-memory": {
         "type": "sse",
         "url": "http://localhost:8765/mcp/claude/sse/<slug-del-proyecto>",
         "headers": { "Authorization": "Bearer ${OMNIA_MEMORY_TOKEN}" }
       },
       "omnia-memory-global": {
         "type": "sse",
         "url": "${OMNIA_MEMORY_GLOBAL_MCP_URL}",
         "headers": { "Authorization": "Bearer ${OMNIA_MEMORY_TOKEN}" }
       }
     }
   }
   ```

   **Importante — no uses una variable de entorno para el slug del
   proyecto** (nada de `${OMNIA_MEMORY_MCP_URL}` acá). Esa variable es
   machine-wide; si la usaras, dos repos abiertos en la misma máquina
   competirían por el mismo valor y uno de los dos quedaría conectado al
   namespace de memoria del OTRO proyecto. El slug va **hardcodeado en el
   texto** del `.mcp.json` de cada repo — la plantilla actualizada está en
   [`mcp-omnia-memory.example.json`](mcp-omnia-memory.example.json).
3. Reiniciá el IDE/agente en ese repo. Debería conectar sin pedir nada más
   (el túnel y el token ya están puestos por la Sección 1).
4. Verificá: pedile al agente que liste o busque algo en `omnia-memory` —
   si conecta sin `INVALID_CONFIG`, está listo.
5. Sumá al `README.md`/`vision/constitution.md` de ese repo una línea
   apuntando a este runbook, para que el próximo que llegue no tenga que
   redescubrir el proceso.

---

## 3. Configurar un repo **existente** (retrofit)

Dos repos ya tenían el bloque de `omnia-memory` en su `.mcp.json` desde
antes de esta spec — **`cfdi`** y **`omnia-client-portal`** — pero con el
patrón viejo y roto: `"url": "${OMNIA_MEMORY_MCP_URL}"`. Nunca funcionaron
(confirmado: ambos namespaces estaban vacíos), y aunque funcionaran,
tendrían el mismo bug de namespace-compartido explicado en la Sección 2.

**Para estos dos (y cualquier otro repo en el mismo estado):**

1. Abrí su `.mcp.json`.
2. Reemplazá la línea `"url": "${OMNIA_MEMORY_MCP_URL}"` del bloque
   `omnia-memory` por el slug hardcodeado de ESE proyecto:
   - `cfdi` → `"url": "http://localhost:8765/mcp/claude/sse/cfdi"`
   - `omnia-client-portal` → `"url": "http://localhost:8765/mcp/claude/sse/omnia-client-portal"`
3. Dejá `omnia-memory-global` como está (`${OMNIA_MEMORY_GLOBAL_MCP_URL}`
   sí es correcto ahí — es universal).
4. Reiniciá el IDE en ese repo y confirmá que conecta.

**Para cualquier repo que uses vos mismo día a día:** si ya tenés la
Sección 1 hecha en tu máquina, alcanza con repetir el paso 2 de la Sección
2 en cada repo — no hay setup adicional por máquina, es puramente editar
ese archivo una vez por repo.

---

## Ver también

- [`INSTRUCTIVO.md`](INSTRUCTIVO.md) — arquitectura completa (por qué
  Vaultwarden, esquema de namespaces, flujo manual de fallback).
- [`../vault/README.md`](../vault/README.md) — runbook del admin en
  Vaultwarden con más detalle.
- [`CONVENCION-DE-CONTENIDO.md`](CONVENCION-DE-CONTENIDO.md) — qué escribir
  una vez conectado, y cómo se comporta realmente `add_memories`.
- `vision/specs/services/self-service-memory-tunnel-onboarding/` — la spec
  completa, con el historial de todos los bugs reales encontrados armando
  esto (útil si algo de este runbook deja de funcionar y hay que
  diagnosticar de nuevo).
