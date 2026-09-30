FROM node:24-alpine
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages packages
COPY prisma prisma
COPY prisma.config.ts ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm db:generate \
    && pnpm --filter @paddle-tactics/game-data build \
    && pnpm --filter @paddle-tactics/game-core build \
    && pnpm --filter @paddle-tactics/ai build \
    && pnpm --filter @paddle-tactics/server build
ENV NODE_ENV=production
EXPOSE 3002
CMD ["sh", "-c", "pnpm db:migrate:deploy && pnpm --filter @paddle-tactics/server start"]
