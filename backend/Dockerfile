# Etapa de construcción
FROM node:20-alpine AS builder

WORKDIR /app

# Copiamos solo los archivos de dependencias primero para aprovechar el caché de Docker
COPY package*.json ./
COPY prisma ./prisma/

# Instalamos TODAS las dependencias (incluyendo devDependencies para compilar)
RUN npm install

# Copiamos el resto del código
COPY . .

# Inyectamos una variable DATABASE_URL temporal para que Prisma pueda generar el cliente
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"

# Generamos el cliente de Prisma
RUN npx prisma generate

# Compilamos el código de NestJS (esto creará la carpeta /app/dist)
RUN npm run build

# Etapa de producción
FROM node:20-alpine

WORKDIR /app

# Copiamos los archivos de configuración
COPY package*.json ./

# Instalamos SOLO las dependencias de producción (para un contenedor más ligero)
RUN npm install --omit=dev

# Copiamos la carpeta dist compilada desde la etapa anterior
COPY --from=builder /app/dist ./dist

# Copiamos la carpeta de Prisma y el cliente generado
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["npm", "run", "start:prod"]