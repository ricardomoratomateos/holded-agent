import express from 'express';
import { chromium } from 'playwright';

const app = express();
app.use(express.json());

/**
 * POST /scrape
 * Body: { url: string, waitTime?: number }
 * Returns: { success: boolean, content?: string, error?: string }
 */
app.post('/scrape', async (req, res) => {
  const { url, waitTime = 3000 } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'URL es requerida'
    });
  }

  console.log(`📄 Scraping: ${url}`);
  let browser;

  try {
    // Lanzar navegador
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });

    const page = await context.newPage();

    // Navegar
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Esperar a que se renderice (ReadMe.io es React)
    await page.waitForTimeout(waitTime);

    // Extraer todo el texto del body
    const content = await page.evaluate(() => document.body.innerText);

    console.log(`✅ Contenido extraído: ${content.length} caracteres`);

    await browser.close();

    return res.json({
      success: true,
      content,
      length: content.length
    });

  } catch (error) {
    console.error('❌ Error al scrapear:', error.message);

    if (browser) {
      await browser.close();
    }

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'browser-service' });
});

const PORT = 3400;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Browser service running on http://0.0.0.0:${PORT}`);
});
