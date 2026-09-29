FROM node:26-alpine AS deps
WORKDIR /app
RUN npm install --global pnpm@11.10.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

FROM node:26-alpine AS builder
WORKDIR /app
RUN npm install --global pnpm@11.10.0
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:26-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=9086
EXPOSE 9086
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --chmod=755 docker-entrypoint.sh ./docker-entrypoint.sh
USER node
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
