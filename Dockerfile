# Multi-stage Dockerfile for async-agent
# Stage 1: Build
FROM node:23-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ openssl

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src ./src/

# Generate Prisma client and build TypeScript
RUN npx prisma generate
RUN npm run build

# Stage 2: Production
FROM node:23-alpine

# Install runtime dependencies
RUN apk add --no-cache openssl curl bash

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install only production dependencies
RUN npm ci --only=production

# Copy Prisma client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy built application from builder
COPY --from=builder /app/dist ./dist/

# Copy prompts directory (optional)
COPY prompts ./prompts/

# Copy scripts directory (for database seeding)
COPY scripts ./scripts/

# Copy entrypoint script and set permissions
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && \
    chown node:node /usr/local/bin/docker-entrypoint.sh

# Create storage directory for local file uploads
RUN mkdir -p /app/storage/files && chown -R node:node /app/storage

# Use non-root user
USER node

# Expose port
EXPOSE 3001

# Set environment defaults
ENV NODE_ENV=production \
    PORT=3001 \
    LOCAL_STORAGE_PATH=/app/storage/files

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Use entrypoint script
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "start"]
