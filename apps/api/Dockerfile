FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/runtime/package.json packages/runtime/package.json
RUN npm ci
COPY apps/api apps/api
COPY packages packages
RUN npm run build --workspace @evidera/api

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/runtime/package.json packages/runtime/package.json
RUN npm ci --omit=dev --workspace @evidera/api --include-workspace-root=false
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/packages packages
COPY infra/postgres/migrations infra/postgres/migrations
USER node
EXPOSE 4100
CMD ["node", "apps/api/dist/server.js"]
