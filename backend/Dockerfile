# Development Dockerfile
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (use npm ci for reproducible builds)
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the application
RUN npm run build

# Development stage (uses nodemon for hot reload)
FROM node:20-alpine AS development

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma

# Install nodemon for hot reload
RUN npm install -g nodemon

# Expose port
EXPOSE 3000

# Run with nodemon for development
CMD ["nodemon", "--exec", "node dist/main", "--watch", "dist"]
