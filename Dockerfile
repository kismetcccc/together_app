FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build && npm prune --omit=dev
FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=build /app /app
ENV HOST=0.0.0.0 PORT=8080
EXPOSE 8080
CMD ["npm","start"]
