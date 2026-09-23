# Servidor estatico minimo: sirve memory/setup/windows.ps1 y memory/tunnel.sh
# para el bootstrap de una sola linea (irm https://vault.omniaos.ai/setup |
# iex). Config horneada en la imagen (COPY), no bind-mount -- mismo patron
# que el resto del repo (ver DEPLOY_COOLIFY.md, Convenciones).
#
# Build context: la RAIZ del repo (ver build.context en vault/docker-compose.yml),
# porque necesita copiar archivos de memory/, fuera de vault/.
FROM nginx:alpine
COPY memory/setup/windows.ps1 /usr/share/nginx/html/windows.ps1
COPY memory/tunnel.sh /usr/share/nginx/html/tunnel.sh
COPY vault/setup/nginx.conf /etc/nginx/conf.d/default.conf
