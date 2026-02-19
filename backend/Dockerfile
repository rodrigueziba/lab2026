# backend/Dockerfile
FROM node:20-alpine

WORKDIR /app

# 1. Instalar dependencias
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install

# 2. Copiar código y compilar
COPY . .
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
RUN npx prisma generate
RUN npm run build

# 3. Debug: Esto mostrará en el log de Render dónde se guardaron los archivos
RUN ls -R dist

EXPOSE 3000

# 4. Comando dinámico: Prueba ambas rutas comunes de NestJS
CMD ["sh", "-c", "if [ -f dist/src/main.js ]; then node dist/src/main.js; else node dist/main.js; fi"]