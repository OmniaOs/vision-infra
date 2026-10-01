#!/usr/bin/env node
// Admin: alta de una persona en el gateway de memoria. Sin dependencias.
//
//   node memory/access/devs.mjs add <id> [dominio] [--role miembro|lectura|cliente|admin] [--spaces int-frutal,proy-omniapos]
//
// Genera un token nuevo, imprime la linea que va en ACCESS_DEVS (solo el hash,
// con rol y espacios si se indicaron) y el comando de una linea que la persona
// pega para conectarse. El token en claro no se guarda en ningun lado: si se
// pierde, se da de alta otro. Baja: borrar la linea y redeploy del servicio `access`.
//
// Roles y espacios: memory/PERMISOS.md. Sin --role se emite el formato antiguo
// "id:hash" (rol miembro sin espacios asignados).

import { randomBytes } from 'node:crypto';
import { hashToken } from './users.mjs';
import { validateUser, ROLES } from './policy.mjs';

const args = process.argv.slice(2);
const flags = {};
const pos = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) flags[args[i].slice(2)] = args[++i];
  else pos.push(args[i]);
}
const [cmd, id, domain = 'memory.omniaos.ai'] = pos;
const spaces = flags.spaces ? flags.spaces.split(',').map((s) => s.trim()).filter(Boolean) : [];

function usage(msg) {
  if (msg) console.error(`Error: ${msg}\n`);
  console.error('Uso: node memory/access/devs.mjs add <id> [dominio] [--role <rol>] [--spaces <a,b>]\n'
    + `  <id>: minusculas, digitos, . _ -  (ej. ana, luis.m)\n  --role: ${ROLES.join(' | ')}\n`
    + '  --spaces: int-<cliente>, proy-<repo>, cli-<cliente> (global es implicito segun el rol)');
  process.exit(1);
}

if (cmd !== 'add' || !/^[a-z0-9][a-z0-9._-]{0,31}$/.test(id || '')) usage();
if (flags.spaces && !flags.role) usage('--spaces necesita --role');
if (flags.role) {
  const err = validateUser({ id, role: flags.role, spaces });
  if (err) usage(err);
}

const token = `omnia_${randomBytes(32).toString('base64url')}`;
const suffix = flags.role ? `:${flags.role}${spaces.length ? `:${spaces.join('+')}` : ''}` : '';

console.log(`
1) Agrega esto a ACCESS_DEVS (separado por comas) en el recurso memory de Coolify
   y haz Redeploy del servicio "access":

   ${id}:${hashToken(token)}${suffix}

2) Mandale a ${id} SOLO su comando, por un canal de un solo uso
   (Bitwarden Send: 1 vista, expira en 24 h). No lo pegues en chat ni en un repo.

   Windows (PowerShell):
   $env:OMNIA_TOKEN='${token}'; irm https://${domain}/setup | iex

   macOS / Linux:
   OMNIA_TOKEN='${token}' bash -c "$(curl -fsSL https://${domain}/setup.sh)"
`);
