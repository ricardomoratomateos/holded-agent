# 🐳 Docker - Guía de Uso

Esta guía explica cómo ejecutar Holded AI Agent usando Docker en desarrollo y producción.

## 📋 Requisitos

- Docker Desktop instalado y corriendo
- Docker Compose v2+
- Archivo `.env` configurado en la raíz del proyecto

## 🚀 Desarrollo Local (con Hot Reload)

### Inicio Rápido

```bash
# Construir y levantar todos los servicios
npm run docker:up

# O en modo detached (background)
npm run docker:up:detach

# Ver logs en tiempo real
npm run docker:logs

# Detener todos los servicios
npm run docker:down
```

También puedes usar directamente Docker Compose:

```bash
docker-compose up --build
docker-compose down
```

### URLs de Acceso

- **Frontend**: http://localhost:3301
- **Backend**: http://localhost:3300

### Hot Reload

Ambos servicios tienen hot reload activado:
- **Backend**: Usa `tsx watch` para reiniciar automáticamente
- **Frontend**: Vite con hot module replacement (HMR)

Los cambios en el código se reflejarán automáticamente sin necesidad de reconstruir los contenedores.

### Estructura de Volúmenes

El `docker-compose.dev.yml` monta:

**Backend:**
- `./src` → Código fuente
- `./uploads` → Archivos subidos (persistente)
- `./data` → Base de datos SQLite (persistente)

**Frontend:**
- `./frontend/src` → Código fuente
- `./frontend/public` → Assets públicos
- Archivos de configuración (vite.config.ts, tailwind, etc.)

### Variables de Entorno

Crea un archivo `.env` en la raíz con:

```env
OPENAI_API_KEY=tu_key_aqui
ANTHROPIC_API_KEY=tu_key_aqui
LANGCHAIN_API_KEY=opcional
LANGCHAIN_TRACING_V2=true
LANGCHAIN_PROJECT=holded-agent
```

## 🏭 Producción

### Construcción y Despliegue

```bash
# Construir y levantar en modo producción
npm run docker:prod

# Detener servicios de producción
npm run docker:prod:down
```

### URLs de Producción

- **Frontend**: http://localhost:8080
- **Backend**: http://localhost:3300

### Diferencias con Desarrollo

**Backend:**
- Usa `npm start` (versión compilada)
- No tiene hot reload
- Optimizado para producción

**Frontend:**
- Build estático servido por Nginx
- Assets optimizados y minificados
- Multi-stage build para reducir tamaño

## 🔧 Comandos Docker Útiles

### Ver servicios corriendo
```bash
docker-compose ps
```

### Reconstruir un servicio específico
```bash
docker-compose up -d --build backend
docker-compose up -d --build frontend
```

### Entrar en un contenedor
```bash
# Backend
docker exec -it holded-agent-backend-dev sh

# Frontend
docker exec -it holded-agent-frontend-dev sh
```

### Ver logs de un servicio específico
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Limpiar todo (contenedores, volúmenes, imágenes)
```bash
docker-compose down -v
docker system prune -a
```

## 🐛 Troubleshooting

### El hot reload no funciona en el frontend

**Solución**: Vite necesita `usePolling: true` en `vite.config.ts` para Docker. Ya está configurado.

### Permisos en carpetas uploads/data

**Solución**: Los Dockerfiles crean las carpetas con permisos 777. Si hay problemas:
```bash
chmod -R 777 uploads data
```

### El backend no puede conectar con APIs externas

**Solución**: Verifica que las API keys estén en el `.env` y que el archivo esté siendo leído por Docker Compose.

### Puerto ya en uso

**Solución**: Cambia los puertos en `docker-compose.dev.yml`:
```yaml
ports:
  - "3301:3300"  # Host:Container
```

### Cambios en package.json no se reflejan

**Solución**: Necesitas reconstruir el contenedor:
```bash
docker-compose -f docker-compose.dev.yml up -d --build
```

### El contenedor se reinicia constantemente

**Solución**: Revisa los logs:
```bash
docker-compose -f docker-compose.dev.yml logs backend
```

Probablemente falte una dependencia o hay un error de sintaxis.

## 📊 Monitoreo

### Ver uso de recursos
```bash
docker stats
```

### Ver espacio en disco usado
```bash
docker system df
```

## 🗑️ Limpieza

### Limpiar contenedores parados
```bash
docker container prune
```

### Limpiar imágenes no usadas
```bash
docker image prune -a
```

### Limpiar volúmenes no usados
```bash
docker volume prune
```

## 🔒 Seguridad

### Buenas prácticas

1. **No commitees el `.env`** al repositorio
2. **Actualiza las imágenes base** regularmente:
   ```bash
   docker pull node:20-slim
   docker pull nginx:stable-alpine
   ```
3. **Escanea imágenes** en busca de vulnerabilidades:
   ```bash
   docker scan holded-agent-backend-dev
   ```

## 📝 Notas

- Los `node_modules` se instalan **dentro** del contenedor, no en tu máquina local
- Las carpetas `uploads/` y `data/` persisten entre reinicios
- En desarrollo, los cambios de código se reflejan inmediatamente gracias a los volúmenes montados
- En producción, debes reconstruir las imágenes para aplicar cambios

---

**¿Necesitas ayuda?** Abre un issue en el repositorio.
