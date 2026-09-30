FROM node:24-alpine AS build
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages packages
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @paddle-tactics/game-data build \
    && pnpm --filter @paddle-tactics/game-core build \
    && pnpm --filter @paddle-tactics/ai build \
    && pnpm --filter @paddle-tactics/web build

FROM nginx:1.29-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html
EXPOSE 80
