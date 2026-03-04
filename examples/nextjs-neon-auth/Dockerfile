# syntax=docker/dockerfile:1

FROM oven/bun:1 AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy workspace configuration and lock file
COPY package.json bun.lock ./

# Copy all workspace package.json files (needed for workspace resolution)
COPY packages/internal/package.json ./packages/internal/package.json
COPY packages/postgrest-js/package.json ./packages/postgrest-js/package.json
COPY packages/auth/package.json ./packages/auth/package.json
COPY packages/auth-ui/package.json ./packages/auth-ui/package.json
COPY packages/neon-js/package.json ./packages/neon-js/package.json
COPY e2e/package.json ./e2e/package.json
COPY examples/nextjs-admin-portal/package.json ./examples/nextjs-admin-portal/package.json
COPY examples/nextjs-neon-auth/package.json ./examples/nextjs-neon-auth/package.json
COPY examples/react-auth-external-ui/package.json ./examples/react-auth-external-ui/package.json
COPY examples/react-neon-js/package.json ./examples/react-neon-js/package.json

# Install dependencies (this will install all workspace packages)
RUN bun install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Copy node_modules and source files
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .

# Build the application
WORKDIR /app/examples/nextjs-neon-auth
RUN bun run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Bun image uses Debian, so use groupadd/useradd instead of addgroup/adduser
RUN groupadd --system --gid 1001 nodejs || true
RUN useradd --system --uid 1001 --gid nodejs nextjs || true

COPY --from=builder /app/examples/nextjs-neon-auth/public ./public

# Set the correct permission for prerender cache
RUN mkdir -p .next
RUN chown -R nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/examples/nextjs-neon-auth/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/examples/nextjs-neon-auth/.next/static ./examples/nextjs-neon-auth/.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["bun", "examples/nextjs-neon-auth/server.js"]
