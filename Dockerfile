FROM node:20-alpine

WORKDIR /app

# Dependencias de compilación para better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Crear carpeta de datos
RUN mkdir -p /app/data

EXPOSE 3000

# Seed + start
CMD ["sh", "-c", "node server/seed.js && node server/index.js"]
