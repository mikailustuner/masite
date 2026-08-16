FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/crawler/package.json packages/crawler/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/runtime/package.json packages/runtime/package.json
RUN npm ci
COPY apps/worker apps/worker
COPY packages packages
RUN npm run build --workspace @evidera/worker

FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends chromium fonts-dejavu-core ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/crawler/package.json packages/crawler/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/runtime/package.json packages/runtime/package.json
RUN npm ci --omit=dev --workspace @evidera/worker --include-workspace-root=false
COPY --from=build /app/apps/worker/dist apps/worker/dist
COPY --from=build /app/packages packages
USER node
CMD ["node", "apps/worker/dist/worker.js"]
