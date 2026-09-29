# Omnia memory access gateway — Node nativo, sin dependencias.
FROM node:22-alpine
WORKDIR /app
COPY server.mjs ./
COPY setup ./setup
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
CMD ["node", "server.mjs"]
