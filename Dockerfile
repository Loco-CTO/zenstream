FROM node:26-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:26-alpine AS builder
WORKDIR /app
RUN corepack enable
ARG NEXT_PUBLIC_ZSO_URL
ENV NEXT_PUBLIC_ZSO_URL=$NEXT_PUBLIC_ZSO_URL
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
USER node
CMD ["node", "server.js"]
