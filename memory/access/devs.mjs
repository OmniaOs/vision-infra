#!/usr/bin/env node
// Admin: alta de un dev en el gateway de memoria. Sin dependencias.
//
//   node memory/access/devs.mjs add <id> [dominio]
//
// Genera un token nuevo, imprime la linea que va en ACCESS_DEVS (solo el hash)
// y el comando de una linea que el dev pega para conectarse. El token en claro
// no se guarda en ningun lado: si se pierde, se da de alta otro.
// Baja: borrar la linea del dev en ACCESS_DEVS y redeploy del servicio `access`.

import { randomBytes } from 'node:crypto';
import { hashToken } from './server.mjs';

const [cmd, id, domain = 'memory.omniaos.ai'] = process.argv.slice(2);

if (cmd !== 'add' || !/^[a-z0-9][a-z0-9._-]{0,31}$/.test(id || '')) {
  console.error('Uso: node memory/access/devs.mjs add <id> [dominio]\n  <id>: minusculas, digitos, . _ -  (ej. ana, luis.m)');
  process.exit(1);
}

const token = `omnia_${randomBytes(32).toString('base64url')}`;

console.log(`
1) Agrega esto a ACCESS_DEVS (separado por comas) en el recurso memory de Coolify
   y haz Redeploy del servicio "access":

   ${id}:${hashToken(token)}

2) Mandale a ${id} SOLO su comando, por un canal de un solo uso
   (Vaultwarden Send: 1 vista, expira en 24 h). No lo pegues en chat ni en un repo.

   Windows (PowerShell):
   $env:OMNIA_TOKEN='${token}'; irm https://${domain}/setup | iex

   macOS / Linux:
   OMNIA_TOKEN='${token}' bash -c "$(curl -fsSL https://${domain}/setup.sh)"
`);
