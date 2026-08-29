# syntax=docker/dockerfile:1

FROM node:24-alpine AS builder
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages ./packages
COPY examples/nuxt-neon-auth ./examples/nuxt-neon-auth

# The lockfile must include this workspace before building the image.
RUN pnpm install --frozen-lockfile
RUN pnpm run build
RUN pnpm --filter nuxt-neon-auth build

FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/examples/nuxt-neon-auth/.output ./.output

USER node
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
