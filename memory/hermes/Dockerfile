# Hermes — daemon de self-learning. Node 20 + git (para clonar/leer repos).
FROM node:20-alpine
RUN apk add --no-cache git
WORKDIR /app
COPY package.json ./
# Sin dependencias externas (solo built-ins); npm install queda como no-op seguro.
RUN npm install --omit=dev || true
COPY . .
ENV HERMES_STATE_DIR=/app/state
VOLUME ["/app/state"]
CMD ["node", "index.mjs", "--loop"]
