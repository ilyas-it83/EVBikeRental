# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/
RUN npm ci --workspace=apps/api --workspace=packages/shared
COPY apps/api/ ./apps/api/
COPY packages/shared/ ./packages/shared/
COPY tsconfig.json ./
RUN npm run build -w packages/shared && npm run build -w apps/api

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
RUN mkdir -p /app/data
EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
