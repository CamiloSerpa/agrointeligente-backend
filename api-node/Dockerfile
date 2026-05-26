FROM node:20-alpine

WORKDIR /app

# Instalar dependencias primero (mejor cache)
COPY package*.json ./
RUN npm install --omit=dev && npm install -g nodemon

COPY src ./src

EXPOSE 3000

# En desarrollo se sobrescribe con nodemon vía docker-compose
CMD ["nodemon", "src/server.js"]
