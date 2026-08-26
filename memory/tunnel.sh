#!/bin/sh
# Túnel SSH a la memoria compartida de Vision (y opcionalmente métricas).
# El servidor NO expone puertos a internet: este túnel es la única vía.
#
# Uso:   bash memory/tunnel.sh          (usa memory/.memory.env)
# Deja la terminal abierta mientras trabajas; Ctrl+C lo cierra.
# Funciona en Linux/macOS y en Windows vía Git Bash.

set -eu

HERE=$(dirname "$0")
ENV_FILE="$HERE/.memory.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "✗ No existe $ENV_FILE"
  echo "  Crea tu conexión:  cp memory/.memory.env.example memory/.memory.env"
  exit 1
fi

# shellcheck disable=SC1090
. "$ENV_FILE"

: "${OMNIA_MEMORY_SSH_HOST:?Falta OMNIA_MEMORY_SSH_HOST en .memory.env}"
: "${OMNIA_MEMORY_SSH_USER:=visiontunnel}"
: "${OMNIA_MEMORY_SSH_KEY:=~/.ssh/id_ed25519}"
: "${OMNIA_MEMORY_TUNNEL_PORTS:=8765}"

# Expandir ~ manualmente (sh no lo hace dentro de variables)
case "$OMNIA_MEMORY_SSH_KEY" in
  "~/"*) OMNIA_MEMORY_SSH_KEY="$HOME/${OMNIA_MEMORY_SSH_KEY#\~/}" ;;
esac

FORWARDS=""
for p in $(echo "$OMNIA_MEMORY_TUNNEL_PORTS" | tr ',' ' '); do
  FORWARDS="$FORWARDS -L $p:localhost:$p"
done

echo "▶ Túnel a $OMNIA_MEMORY_SSH_HOST (puertos: $OMNIA_MEMORY_TUNNEL_PORTS)"
echo "  Memoria MCP → http://localhost:8765  |  Ctrl+C para cerrar"

# -N: sin shell remoto (el usuario del túnel no tiene shell de todos modos)
# ServerAliveInterval: mantiene vivo el túnel en redes con timeouts agresivos
# ExitOnForwardFailure: si el puerto local está ocupado, falla claro en vez de colgar
exec ssh -N \
  -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -i "$OMNIA_MEMORY_SSH_KEY" \
  $FORWARDS \
  "$OMNIA_MEMORY_SSH_USER@$OMNIA_MEMORY_SSH_HOST"
