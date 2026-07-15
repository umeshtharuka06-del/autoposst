# ===== Build stage =====
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci || npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ===== Runtime stage =====
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN (npm ci --omit=dev || npm install --omit=dev) && npm cache clean --force

COPY prisma ./prisma
RUN npx prisma generate

COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh \
    && addgroup -S app && adduser -S app -G app \
    && mkdir -p /app/storage/media && chown -R app:app /app

USER app

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
