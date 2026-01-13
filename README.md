# Holded AI Agent

Agente conversacional inteligente para interactuar con la API de Holded, permitiendo consultar y gestionar datos de tu cuenta mediante lenguaje natural.

## 🚀 Características

- **Chat inteligente** con streaming de respuestas en tiempo real
- **Procesamiento de documentos**: Sube imágenes y PDFs de facturas para análisis automático
- **Integración completa con Holded API**: Consulta contactos, facturas, productos y más
- **Interfaz moderna** construida con React y assistant-ui
- **Historial persistente** de conversaciones
- **Aprobación manual** de operaciones sensibles (crear/modificar datos)

## 📋 Requisitos Previos

- Node.js 18+
- npm o yarn
- Cuenta de Holded con API key
- API key de OpenAI o Anthropic

## 🛠️ Instalación

### Backend

```bash
cd holded-agent
npm install
```

Configura las variables de entorno creando un archivo `.env`:

```env
OPENAI_API_KEY=tu_api_key_aqui
ANTHROPIC_API_KEY=tu_api_key_anthropic (opcional)
LANGCHAIN_API_KEY=tu_langchain_key (opcional, para trazas)
```

### Frontend

```bash
cd frontend
npm install
```

Configura el archivo `.env` en el frontend:

```env
VITE_API_URL=http://localhost:3300
```

## 🚀 Ejecución

### Opción 1: Docker (Recomendado)

```bash
# Levantar todos los servicios con hot reload
npm run docker:up

# Ver logs en tiempo real
npm run docker:logs

# Detener servicios
npm run docker:down
```

O directamente con Docker Compose:

```bash
docker-compose up
```

**URLs:**
- Frontend: http://localhost:3301
- Backend: http://localhost:3300

📖 **Ver [DOCKER.md](./DOCKER.md) para más información**

### Opción 2: Desarrollo Local (sin Docker)

#### Iniciar el Backend

```bash
npm run dev
```

El servidor se iniciará en `http://localhost:3300`

#### Iniciar el Frontend

```bash
cd frontend
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

## 📖 Uso

1. **Configuración inicial**: Al abrir la app, haz clic en el ícono de configuración (⚙️) y añade tu API key de Holded

2. **Consultas básicas**:
   - "Muéstrame mis últimos 5 contactos"
   - "¿Cuántas facturas tengo pendientes de pago?"
   - "Busca el contacto de nombre Juan Pérez"

3. **Subir documentos**:
   - Haz clic en el botón de adjuntar (📎)
   - Selecciona una imagen o PDF de factura
   - El agente extraerá automáticamente los datos y te preguntará qué hacer

4. **Aprobar operaciones**:
   - Cuando el agente quiera crear o modificar datos, te pedirá confirmación
   - Revisa la información y aprueba o rechaza la operación

## 🏗️ Arquitectura

### Backend

- **Framework**: Fastify
- **Agente**: LangGraph con Claude Sonnet 3.5
- **Herramientas**:
  - `call_holded_api`: Interacción con Holded API
  - `analyze_document`: Análisis de facturas con GPT-4o-mini vision
  - `brave_search`: Búsqueda web para documentación
- **Estrategias de chat**:
  - Streaming normal
  - Interrupciones para aprobación
  - Manejo de errores

### Frontend

- **Framework**: React + TypeScript + Vite
- **UI**: assistant-ui (chat interface)
- **Estado**: LocalRuntime de assistant-ui
- **Styling**: Tailwind CSS
- **Características**:
  - Streaming en tiempo real
  - Upload de archivos con preview
  - Indicadores de loading
  - Gestión de historial

## 📁 Estructura del Proyecto

```
holded-agent/
├── src/
│   ├── agent/
│   │   ├── graph.ts          # LangGraph workflow
│   │   └── prompts.ts        # System prompts
│   ├── strategies/
│   │   └── chatStrategy.ts   # Estrategias de manejo de chat
│   ├── tools/
│   │   ├── holded.ts         # Herramienta Holded API
│   │   ├── vision.ts         # Análisis de documentos
│   │   └── pdfProcessor.ts   # Procesamiento de PDFs
│   ├── utils/
│   │   └── sseWriter.ts      # Server-Sent Events
│   └── server.ts             # Servidor Fastify
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   │   └── assistant-ui/  # Componentes de chat
│   │   │   └── Layout/            # Header, Settings
│   │   ├── lib/
│   │   │   ├── holdedRuntime.ts   # Adapter SSE
│   │   │   └── attachmentAdapter.ts # Upload de archivos
│   │   └── App.tsx
│   └── index.html
└── README.md
```

## 🔧 Configuración Avanzada

### Variables de Entorno (Backend)

- `OPENAI_API_KEY`: API key de OpenAI (obligatoria para vision)
- `ANTHROPIC_API_KEY`: API key de Anthropic (obligatoria para Claude)
- `LANGCHAIN_API_KEY`: Para trazabilidad con LangSmith
- `LANGCHAIN_TRACING_V2`: Activar trazas (true/false)
- `LANGCHAIN_PROJECT`: Nombre del proyecto en LangSmith

### Personalización del Agente

Edita `src/agent/prompts.ts` para modificar:
- Instrucciones del sistema
- Comportamiento del agente
- Reglas de aprobación

## 🐛 Troubleshooting

### El agente no responde
- Verifica que el backend esté corriendo en puerto 3300
- Revisa que las API keys estén configuradas correctamente
- Mira los logs del servidor para errores

### Error de CORS
- Asegúrate de que el frontend apunte a `http://localhost:3300`
- Verifica que ambos servicios estén corriendo

### Archivos no se suben
- Tamaño máximo: 10MB
- Formatos soportados: imágenes (jpg, png) y PDF
- Verifica permisos de escritura en la carpeta `uploads/`

## 📝 Licencia

MIT

## 👥 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📧 Contacto

Para preguntas o soporte, abre un issue en el repositorio.
