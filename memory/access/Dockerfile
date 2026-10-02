# Omnia memory access gateway + portal.
# Etapa 1: compila el portal (React + Vite). Etapa 2: el gateway, Node nativo sin dependencias,
# que sirve ese build desde ./panel.
FROM node:22-alpine AS portal
WORKDIR /portal
COPY portal/package.json portal/package-lock.json ./
RUN npm ci
COPY portal ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY server.mjs policy.mjs users.mjs panel.mjs auth.mjs viewer.mjs mcp-client.mjs cluster.mjs ./
COPY --from=portal /portal/dist ./panel
COPY setup ./setup
# Carpeta de datos (archivo de usuarios del panel). Se crea con el dueno correcto para que un
# volumen nuevo herede el permiso de escritura de `node`.
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
CMD ["node", "server.mjs"]
