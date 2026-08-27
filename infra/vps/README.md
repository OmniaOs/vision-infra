# Scripts del VPS (`server-omniaplatform`)

> Versionados aquí el 2026-08-27 — hasta esa fecha **solo existían en el VPS**,
> sin respaldo ni historial en ningún repo. Esa falta de versionado es la
> razón por la que un bug real en este script (ver abajo) tardó semanas en
> diagnosticarse: nadie podía revisar su contenido sin entrar al servidor.

## `omnia-portblock.service` + `omnia-portblock.sh`

Servicio systemd que corre una vez al arrancar Docker y bloquea (vía
`iptables`/`ip6tables` en la cadena `DOCKER-USER`, que Docker no expone a
`ufw`) el acceso externo directo a los puertos de las apps de este repo
(`3000` openmemory-ui, `4000` gateway, `4320` metrics-hub, `6333` qdrant,
`8765` openmemory-mcp). Es la segunda capa de defensa post-incidente
20-jul-2026, independiente del binding `127.0.0.1:PUERTO:PUERTO` de cada
`docker-compose.yml` — ver `DEPLOY_COOLIFY.md`.

**Bug real encontrado y corregido el 2026-08-27**: el script original incluía
`80` y `443` (los puertos de Traefik/`coolify-proxy`) en la lista de bloqueo.
Eso hacía que **ningún dominio público fuera alcanzable en absoluto** desde
que se aplicó el fix de seguridad (24-jul-2026) — no un problema del
proveedor (OVH), como se sospechó dos veces antes de encontrar esto. El
propio comentario del script ya anticipaba el error ("si algún día se
quieren dominios+TLS, quitar 80/443 de la lista conscientemente") pero nunca
se hizo hasta que se intentó exponer `metrics-hub` con dominio.

**Cómo desplegar un cambio a este script:** no hay automatización — se edita
aquí, y **a mano** se copia a `/usr/local/sbin/omnia-portblock.sh` en el VPS
y se corre `systemctl restart omnia-portblock` (o se espera al próximo
reinicio). Ese es un gap real de este repo, no una elección deliberada;
si este script crece o se vuelve más importante, vale la pena traerlo a un
pipeline de deploy real en vez de mantenerlo sincronizado a mano.
