# =============================================================================
# Thena Client — Multi-stage Dockerfile
# =============================================================================
# Development: docker compose up (uses target: development)
# Production:  docker compose -f docker-compose.yml -f docker-compose.prod.yml up
#              (uses target: production — static build served by Nginx)
# =============================================================================

# ---- Shared base ----
FROM node:22-slim AS base
WORKDIR /app
COPY package*.json ./

# ---- Development ----
FROM base AS development
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ---- Builder (production assets) ----
FROM base AS builder
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm ci
COPY . .
RUN npx vite build

# ---- Production (Nginx serving static files) ----
FROM nginx:1.27-alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
