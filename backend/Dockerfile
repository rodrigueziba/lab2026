# backend/Dockerfile
FROM node:20-alpine

# Directorio de trabajo
WORKDIR /app

# Copiamos TODOS los archivos primero
COPY . .

# Instalamos TODAS las dependencias (incluyendo dev)
RUN npm install

# Inyectamos variable temporal para Prisma
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"

# Generamos Prisma
RUN npx prisma generate

# Compilamos NestJS
RUN npm run build

# Exponemos el puerto
EXPOSE 3000

# Arrancamos desde la carpeta generada (dist/src/main o dist/main según genere Nest)
CMD ["npm", "run", "start:prod"]