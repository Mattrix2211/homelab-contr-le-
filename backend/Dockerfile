FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev=false
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache tini su-exec
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY src/db/migrations ./dist/db/migrations
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN mkdir -p /data && addgroup -S homelab && adduser -S homelab -G homelab \
    && chown -R homelab:homelab /data /app \
    && chmod +x /docker-entrypoint.sh

# Stays root here deliberately - docker-entrypoint.sh aligns the "homelab"
# user with the host's docker.sock GID (unknown at build time) before
# dropping to it via su-exec. Nothing application-level ever runs as root.
VOLUME ["/data"]
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--", "/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
