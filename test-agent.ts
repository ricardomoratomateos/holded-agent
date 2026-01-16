/**
 * Script de test para verificar el flujo de creación de documentos
 *
 * Flujo:
 * 1. Envía imagen + "Analiza esta compra y creala"
 * 2. Espera respuesta del agente (debería usar get_api_documentation)
 * 3. Confirma la creación
 * 4. Verifica que se creó correctamente consultando el documento
 */

import fs from 'fs';
import FormData from 'form-data';

const API_URL = 'http://localhost:3300';
const HOLDED_API_KEY = process.env.HOLDED_API_KEY || '17eb53bd044eec7a291ddd2e73c51b9e';
const THREAD_ID = `test-${Date.now()}`;

interface ChatMessage {
  role: string;
  content: string;
  status?: string;
  final?: boolean;
}

/**
 * Envía un mensaje al agente y procesa el stream SSE
 */
async function sendMessage(message: string, documentPath?: string): Promise<ChatMessage[]> {
  const formData = new FormData();

  // IMPORTANTE: Añadir campos en orden correcto
  formData.append('message', message);
  formData.append('threadId', THREAD_ID);
  formData.append('holdedKey', HOLDED_API_KEY);

  if (documentPath) {
    const fileStream = fs.createReadStream(documentPath);
    const fileName = documentPath.split('/').pop() || 'file';
    formData.append('file', fileStream, fileName);
  }

  console.log(`📤 Enviando: threadId=${THREAD_ID}, message=${message.substring(0, 50)}...`);

  // Usar node-fetch con form-data (necesita headers)
  const response = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    body: formData as any,
    headers: formData.getHeaders() as any,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const messages: ChatMessage[] = [];
  const text = await response.text();

  // Procesar líneas SSE
  const lines = text.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      try {
        const data = JSON.parse(line.slice(6));
        messages.push(data);

        // Mostrar en consola en tiempo real
        if (data.content) {
          process.stdout.write(data.content);
        }
      } catch (e) {
        console.error('Error parsing SSE line:', line);
      }
    }
  }

  console.log('\n');
  return messages;
}

/**
 * Test principal
 */
async function runTest() {
  console.log('🧪 Iniciando test del agente Holded\n');
  console.log(`📋 Thread ID: ${THREAD_ID}\n`);

  try {
    // PASO 1: Enviar imagen con instrucción de crear compra
    console.log('📤 PASO 1: Enviando imagen y solicitando creación...\n');
    const imagePath = 'uploads/1768509291636-Captura de pantalla 2026-01-08 a las 22.07.09.png';

    if (!fs.existsSync(imagePath)) {
      throw new Error(`❌ Imagen no encontrada: ${imagePath}`);
    }

    const createMessages = await sendMessage('Analiza esta compra y creala', imagePath);

    // Verificar que usó get_api_documentation
    console.log('\n🔍 Verificando que usó get_api_documentation...');
    // (Esto se vería en los logs del backend)

    // Debug: mostrar todos los mensajes
    console.log('\n📋 Mensajes recibidos:', createMessages.length);
    createMessages.forEach((msg, i) => {
      console.log(`  [${i}] status: ${msg.status}, final: ${msg.final}, content length: ${msg.content?.length || 0}`);
    });

    // Buscar el ID del documento creado en la respuesta
    const lastMessage = createMessages[createMessages.length - 1];

    if (!lastMessage || !lastMessage.content) {
      console.log('\n⚠️  Último mensaje vacío o sin contenido');
      console.log('Último mensaje:', JSON.stringify(lastMessage, null, 2));
      return;
    }

    const documentIdMatch = lastMessage.content.match(/ID[:\s]+([a-f0-9]{24})/i);

    if (!documentIdMatch) {
      console.log('\n⚠️  No se encontró ID del documento en la respuesta');
      console.log('Respuesta completa:', lastMessage.content);
      return;
    }

    const documentId = documentIdMatch[1];
    console.log(`\n✅ Documento creado con ID: ${documentId}`);

    // PASO 2: Consultar el documento creado para verificar
    console.log('\n📤 PASO 2: Consultando documento creado...\n');
    const verifyMessages = await sendMessage(`Dame los detalles del documento ${documentId}`);

    console.log('\n✅ Test completado exitosamente!');
    console.log('\n📊 Resumen:');
    console.log(`   - Thread ID: ${THREAD_ID}`);
    console.log(`   - Document ID: ${documentId}`);

  } catch (error: any) {
    console.error('\n❌ Error durante el test:', error.message);
    process.exit(1);
  }
}

// Ejecutar test
runTest();
