# =============================================================================
# Thena Server — Multi-stage Dockerfile
# =============================================================================
# Development: docker compose up (uses target: development)
# Production:  docker compose -f docker-compose.yml -f docker-compose.prod.yml up
#              (uses target: production — compiled JS, no ts-node, no watch)
# =============================================================================

# ---- Shared base ----
FROM node:22-slim AS base
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./

# ---- Development ----
FROM base AS development
RUN npm ci
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# ---- Builder (compile TypeScript) ----
FROM base AS builder
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# ---- Production (compiled JS only) ----
FROM base AS production
ENV NODE_ENV=production
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
# Prisma requires the generated client engine from the builder stage
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
# Schema needed for prisma migrate deploy at startup (if used)
COPY prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/main.js"]
