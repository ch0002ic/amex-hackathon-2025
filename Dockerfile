# syntax=docker/dockerfile:1

FROM node:20-bookworm AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build:server

FROM node:20-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist/server ./dist/server
COPY --from=builder /app/dist/shared ./dist/shared
ENV NODE_ENV=production
EXPOSE 5050
CMD ["node", "dist/server/index.js"]
