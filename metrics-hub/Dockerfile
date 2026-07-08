# Omnia Metrics Hub — leaderboard cross-repo. Node 20 + git (clona los repos
# cuya telemetría/commits agrega).
FROM node:20-alpine
RUN apk add --no-cache git
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev || true
COPY . .
RUN chmod +x docker-entrypoint.sh
ENV HUB_REPOS_DIR=/repos
EXPOSE 4320
VOLUME ["/repos"]
ENTRYPOINT ["./docker-entrypoint.sh"]
