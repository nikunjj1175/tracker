const { createWorker } = require('tesseract.js');
const axios = require('axios');

let workerPromise = null;
let recognitionQueue = Promise.resolve();

async function getWorker() {
  if (!workerPromise) {
    // Configure worker for Node.js environment
    console.log('[DEBUG OCR] Creating Tesseract worker...');
    workerPromise = createWorker('eng', {
      logger: (m) => {
        // Only log important messages to avoid spam
        if (m.status === 'recognizing text') {
          console.log(`[OCR] Progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });
    // Initialize the worker
    await workerPromise;
    console.log('[DEBUG OCR] Worker created and initialized');
  } else {
    // Ensure worker is initialized
    await workerPromise;
  }
  return workerPromise;
}

function queueRecognition(task) {
  const job = recognitionQueue.then(() => task(), () => task());
  recognitionQueue = job.catch(() => {});
  return job;
}

/**
 * Extract trading data from screenshot using OCR
 * Uses singleton worker pattern with queue (same as mandal project)
 * @param {string|Buffer} imageInput - Image URL (Cloudinary URL or data URL) or Buffer
 * @returns {Promise<object>} Extracted trade data
 */
async function extractTradeDataFromImage(imageInput) {
  try {
    let imageBuffer;
    
    // Check if input is a Buffer or URL string
    if (Buffer.isBuffer(imageInput)) {
      console.log('[DEBUG OCR] Using provided image buffer, size:', imageInput.length, 'bytes');
      imageBuffer = imageInput;
    } else {
      // Fetch the image from URL
      console.log('[DEBUG OCR] Starting OCR extraction for URL:', imageInput);
      console.log('[DEBUG OCR] Fetching image from URL...');
      const imageResponse = await axios.get(imageInput, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 second timeout for URL fetch
      });
      
      imageBuffer = Buffer.from(imageResponse.data);
      console.log('[DEBUG OCR] Image fetched, size:', imageBuffer.length, 'bytes');
    }
    
    // Get or create worker
    const worker = await getWorker();
    console.log('[DEBUG OCR] Worker initialized');
    
    // Perform OCR recognition
    console.log('[DEBUG OCR] Starting text recognition...');
    const { data: { text } } = await queueRecognition(async () => {
      return await worker.recognize(imageBuffer);
    });
    
    console.log('[DEBUG OCR] OCR text extracted, length:', text.length);
    console.log('[DEBUG OCR] Extracted text preview:', text.substring(0, 200));
    
    // Parse the extracted text
    const parsedData = parseTradeText(text);
    
    console.log('[DEBUG OCR] Parsed trade data:', parsedData);
    
    return {
      success: true,
      data: parsedData,
      rawText: text,
    };
  } catch (error) {
    console.error('[DEBUG OCR] OCR error:', error.message);
    console.error('[DEBUG OCR] Error stack:', error.stack);
    
    return {
      success: false,
      error: error.message || 'OCR processing failed',
    };
  }
}

/**
 * Parse trade information from OCR text
 * This is a template - customize based on your trading platform format
 * @param {string} text - OCR extracted text
 * @returns {object} Parsed trade data
 */
function parseTradeText(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  
  // Initialize default values
  const tradeData = {
    symbol: null,
    type: null,
    volumeLot: null,
    openPrice: null,
    closePrice: null,
    takeProfit: null,
    stopLoss: null,
    profitLoss: null,
    tradeDate: new Date(),
    openTime: null,
    closeTime: null,
  };

  // Try to extract symbol (BTC, ETH, etc.)
  const symbolMatch = text.match(/\b(BTC|ETH|BNB|ADA|SOL|XRP|DOT|DOGE|MATIC|AVAX|LINK|UNI|LTC|ATOM|ETC|XLM|ALGO|FIL|TRX|EOS|AAVE|MKR|COMP|SUSHI|YFI|SNX|CRV|BAL|ZRX|BAT|ZEC|DASH|XMR|WAVES|NEAR|FTM|SAND|MANA|ENJ|AXS|GALA|CHZ|THETA|FLOW|ICP|HBAR|VET|TRX|IOTA|NEO|ONT|QTUM|ZIL|IOST|WAVES|KSM|DOT|LINK|UNI|SUSHI|CRV|COMP|MKR|AAVE|SNX|YFI|BAL|ZRX|BAT|ZEC|DASH|XMR)\b/i);
  if (symbolMatch) {
    tradeData.symbol = symbolMatch[1].toUpperCase();
  }

  // Try to extract trade type (Buy/Sell)
  const buyMatch = text.match(/\b(buy|long|purchase)\b/i);
  const sellMatch = text.match(/\b(sell|short|close)\b/i);
  if (buyMatch) tradeData.type = 'Buy';
  if (sellMatch) tradeData.type = 'Sell';

  // Try to extract prices (numbers with decimals)
  const pricePattern = /(\d+\.?\d*)/g;
  const prices = text.match(pricePattern);
  if (prices && prices.length > 0) {
    const numericPrices = prices.map(p => parseFloat(p)).filter(p => !isNaN(p) && p > 0);
    if (numericPrices.length >= 2) {
      tradeData.openPrice = numericPrices[0];
      tradeData.closePrice = numericPrices[1];
    }
    if (numericPrices.length >= 3) {
      tradeData.takeProfit = numericPrices[2];
    }
    if (numericPrices.length >= 4) {
      tradeData.stopLoss = numericPrices[3];
    }
  }

  // Try to extract volume/lot
  const volumeMatch = text.match(/(?:volume|lot|size|amount)[\s:]*(\d+\.?\d*)/i);
  if (volumeMatch) {
    tradeData.volumeLot = parseFloat(volumeMatch[1]);
  }

  // Try to extract profit/loss
  const profitMatch = text.match(/(?:profit|loss|p\/l|pnl)[\s:]*([+-]?\d+\.?\d*)/i);
  if (profitMatch) {
    tradeData.profitLoss = parseFloat(profitMatch[1]);
  }

  // Try to extract dates
  const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g;
  const dates = text.match(datePattern);
  if (dates && dates.length > 0) {
    try {
      tradeData.tradeDate = new Date(dates[0]);
    } catch (e) {
      // Keep default date
    }
  }

  // Try to extract times
  const timePattern = /(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?)/gi;
  const times = text.match(timePattern);
  if (times && times.length >= 2) {
    try {
      tradeData.openTime = new Date(`${tradeData.tradeDate.toDateString()} ${times[0]}`);
      tradeData.closeTime = new Date(`${tradeData.tradeDate.toDateString()} ${times[1]}`);
    } catch (e) {
      // Keep null
    }
  }

  return tradeData;
}

module.exports = {
  extractTradeDataFromImage,
};
