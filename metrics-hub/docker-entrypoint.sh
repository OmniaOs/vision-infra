#!/bin/sh
# Entrypoint del Metrics Hub para Coolify:
#  1. Clona/actualiza los repos de HUB_REPOS bajo HUB_REPOS_DIR.
#  2. Genera hub.config.json (repos apuntando a los clones; conserva authorMap
#     comiteado en hub.config.json).
#  3. Corre collect una vez, arranca el server (:4320) y re-colecta en bucle.
set -e

REPOS_DIR="${HUB_REPOS_DIR:-/repos}"
INTERVAL="${HUB_INTERVAL:-3600}"
mkdir -p "$REPOS_DIR"

# 1) clonar/actualizar repos (CSV owner/repo en HUB_REPOS)
IFS=','
for entry in $HUB_REPOS; do
  entry="$(echo "$entry" | xargs)"
  [ -z "$entry" ] && continue
  name="$(basename "$entry")"
  dest="$REPOS_DIR/$name"
  if [ -n "$GITHUB_TOKEN" ]; then
    url="https://x-access-token:${GITHUB_TOKEN}@github.com/${entry}.git"
  else
    url="https://github.com/${entry}.git"
  fi
  if [ -d "$dest/.git" ]; then
    git -C "$dest" remote set-url origin "$url" && git -C "$dest" fetch --quiet --all || true
    git -C "$dest" pull --quiet || true
  else
    git clone --quiet "$url" "$dest" || echo "aviso: no pude clonar $entry"
  fi
done
unset IFS

# 2) generar hub.config.json (conservando authorMap comiteado)
node -e '
const fs=require("fs");
const base=JSON.parse(fs.readFileSync("hub.config.json","utf8"));
const dir=process.env.HUB_REPOS_DIR||"/repos";
const csv=(process.env.HUB_REPOS||"").split(",").map(s=>s.trim()).filter(Boolean);
base.repos=csv.map(e=>{const n=e.split("/").pop();return {name:n,path:`${dir}/${n}`};});
fs.writeFileSync("hub.config.runtime.json",JSON.stringify(base,null,2));
console.log("config runtime:",base.repos.length,"repos");
'

# 3) collect inicial + server + bucle de re-colecta
node scripts/collect.mjs --config hub.config.runtime.json || true
(
  while true; do
    sleep "$INTERVAL"
    node scripts/collect.mjs --config hub.config.runtime.json || true
  done
) &

exec node scripts/serve.mjs
