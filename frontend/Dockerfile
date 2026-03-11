# frontend/Dockerfile
# Usamos Debian (slim) en lugar de Alpine para que lightningcss (Tailwind/PostCSS)
# instale el binario correcto (linux-x64-gnu); en Alpine (musl) falla con lightningcss.linux-x64-musl.node
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
COPY .npmrc ./
RUN npm install --legacy-peer-deps
COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001
ENV PORT=3001
CMD ["npm", "start"]