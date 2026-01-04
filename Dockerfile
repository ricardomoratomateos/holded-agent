FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN mkdir -p /app/data && chmod 777 /app/data
# Si usas TypeScript, asegúrate de tener el script 'build' y 'start' en package.json
RUN npm run build || true
EXPOSE 3300
CMD ["npm", "start"]