# Multi-stage build for production deployment
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force
RUN cd backend && npm ci --only=production && npm cache clean --force
RUN cd frontend && npm ci --only=production && npm cache clean --force

# Build the application
FROM base AS builder
WORKDIR /app

# Copy source code
COPY . .
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules

# Build backend
RUN cd backend && npm run build

# Build frontend
RUN cd frontend && npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/package*.json ./backend/
COPY --from=builder /app/frontend/build ./frontend/build
COPY --from=deps /app/backend/node_modules ./backend/node_modules

# Copy configuration files
COPY --from=builder /app/backend/config ./backend/config

USER nextjs

EXPOSE 3001

ENV PORT 3001

CMD ["node", "backend/dist/index.js"]