# Etapa de compilación
FROM node:18-alpine as build
WORKDIR /app

# Esto es CLAVE: permite que Docker reciba la variable del compose
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Etapa de producción (Nginx)
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]