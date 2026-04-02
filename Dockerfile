# ──────────────────────────────────────────────────────────────────────────────
# Dockerfile — Multi-stage build for Hospital Management System API
#
# Stage 1 (builder): Install deps + compile TypeScript
# Stage 2 (prod):    Slim Alpine image, non-root user, only production deps
# ──────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including devDependencies for building)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY tsconfig.json ./
COPY backend ./backend/

# Build TypeScript
RUN npm run build

# ── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Security: run as non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install production deps + tsx for seeding + Prisma client
RUN npm ci --omit=dev && \
    npm install tsx && \
    npx prisma generate && \
    npm cache clean --force

# Copy compiled code from builder
COPY --from=builder /app/dist ./dist

# Copy entrypoint script
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Create logs directory
RUN mkdir -p logs && chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/v1/health || exit 1

# Use entrypoint to run migrations + seed before starting
ENTRYPOINT ["./docker-entrypoint.sh"]
