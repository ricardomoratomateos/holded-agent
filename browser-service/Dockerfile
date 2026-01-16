# Imagen oficial de Playwright con navegadores pre-instalados
FROM mcr.microsoft.com/playwright:v1.57.0-noble

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar código
COPY . .

EXPOSE 3400

CMD ["node", "server.js"]
