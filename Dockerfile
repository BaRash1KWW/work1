# Build native Node.js dependencies in a toolchain-enabled stage.
FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ unixodbc-dev \
    && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

# Minimal runtime image.
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=5000 DB_CLIENT=mssql
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libodbc2 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY --chown=node:node . .
USER node
ARG VCS_URL="https://github.com/unknown"
LABEL org.opencontainers.image.title="AutoSalon Web" \
      org.opencontainers.image.description="Веб-система управления автосалоном на Node.js и Microsoft SQL Server" \
      org.opencontainers.image.source=$VCS_URL
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server.js"]
