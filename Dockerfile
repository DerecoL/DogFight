# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
ENV DATABASE_URL=postgresql://dogfight:dogfight@postgres:5432/dogfight?schema=public
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:24-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
ENV DATABASE_URL=postgresql://dogfight:dogfight@postgres:5432/dogfight?schema=public
COPY package*.json ./
RUN npm ci --include=dev && npm cache clean --force
COPY prisma ./prisma
COPY src/server ./src/server
COPY src/shared ./src/shared
COPY tsconfig.server.json ./tsconfig.server.json
RUN npx prisma generate
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]

FROM caddy:2-alpine AS caddy
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
