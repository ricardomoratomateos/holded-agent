import { pdf } from 'pdf-to-img';
import fs from 'fs';
import path from 'path';

// Crear carpeta tmp si no existe
const tmpDir = './tmp';
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

export async function convertPdfToImages(pdfBuffer: Buffer): Promise<string[]> {
  try {
    // Cargar el PDF con pdf-to-img
    const document = await pdf(pdfBuffer, { scale: 2.0 });
    const images: string[] = [];
    let pageNum = 1;

    console.log('📄 Procesando PDF...');

    // Iterar sobre cada página del PDF
    for await (const imageBuffer of document) {
      // Guardar imagen en tmp para debugging
      const timestamp = Date.now();
      const tmpFilePath = path.join(tmpDir, `pdf_page_${timestamp}_${pageNum}.png`);
      fs.writeFileSync(tmpFilePath, imageBuffer);

      // Convertir buffer a base64 con prefijo data URL
      const base64 = imageBuffer.toString('base64');
      const imageBase64 = `data:image/png;base64,${base64}`;
      images.push(imageBase64);

      console.log(`✅ Página ${pageNum} convertida y guardada en: ${tmpFilePath}`);
      pageNum++;
    }

    console.log(`📄 PDF tiene ${pageNum - 1} página(s)`);
    return images;
  } catch (error) {
    console.error('Error converting PDF to images:', error);
    throw new Error('No se pudo convertir el PDF a imágenes');
  }
}
