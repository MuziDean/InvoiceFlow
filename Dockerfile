# Multi-stage Dockerfile for InvoiceFlow
# Node 22 provides built-in node:sqlite (DatabaseSync)
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies for building frontend
RUN npm ci

# Copy full source
COPY . .

# Build Vite frontend assets to /app/dist
RUN npm run build

# Production runtime stage
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    INVOICEFLOW_DB_PATH=/app/data/invoiceflow.sqlite \
    INVOICEFLOW_AUTH_PATH=/app/data/invoiceflow-auth.sqlite

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built frontend assets
COPY --from=builder /app/dist ./dist

# Copy backend files and TypeScript configuration
COPY server.ts ./
COPY src/server ./src/server
COPY tsconfig.json ./

# Create data directory for persistent SQLite storage
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["npm", "start"]
