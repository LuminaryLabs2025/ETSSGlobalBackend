# --- Development: hot-reload via bind mount + nest start --watch ---
FROM node:20-alpine AS development

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY docker-entrypoint.dev.sh /usr/local/bin/docker-entrypoint.dev.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.dev.sh

COPY . .

ENV NODE_ENV=development

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.dev.sh"]
CMD ["npm", "run", "start:dev"]

# --- Build ---
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Production ---
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

COPY scripts/docker-prod-entrypoint.sh /usr/local/bin/docker-prod-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-prod-entrypoint.sh

EXPOSE 3000

USER node

# Set RUN_SEED_ON_DEPLOY=true to run dist/database/seeds/index.js before the API (Render, etc.)
CMD ["/usr/local/bin/docker-prod-entrypoint.sh"]
