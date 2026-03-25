# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY .npmrc ./
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/
COPY packages/shared/package*.json ./packages/shared/
RUN npm ci --ignore-scripts
COPY apps/api/ ./apps/api/
COPY packages/shared/ ./packages/shared/
COPY tsconfig.json ./
RUN npm run build -w packages/shared && npm run build -w apps/api

# Rebuild native modules (better-sqlite3)
RUN cd node_modules/better-sqlite3 && npx --yes node-gyp rebuild 2>/dev/null || npm rebuild better-sqlite3

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
RUN mkdir -p /app/data
EXPOSE 3001
ENV NODE_ENV=production
ENV DB_PATH=/app/data/evbike.db
CMD ["node", "dist/index.js"]
