# ---- Panel build stage ----
FROM node:22-alpine AS panel-build

WORKDIR /panel

COPY ampanel/package.json ampanel/package-lock.json ./
RUN npm ci

COPY ampanel/ .
RUN npm run build

# ---- Backend build stage ----
FROM node:22-alpine AS build

WORKDIR /app

COPY ambackend/package.json ambackend/package-lock.json ./
RUN npm ci

COPY ambackend/ .
RUN npm run build

# ---- Production stage ----
FROM node:22-alpine

RUN apk add --no-cache dumb-init curl

WORKDIR /app

COPY --from=build /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=panel-build /panel/dist ./public

USER node

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "npx typeorm migration:run -d dist/typeorm.config.js && node dist/main"]
