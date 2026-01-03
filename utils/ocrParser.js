const { createWorker } = require('tesseract.js');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

let workerPromise = null;
let recognitionQueue = Promise.resolve();

async function getWorker() {
  if (!workerPromise) {
    
    // Use path.resolve to get absolute file system path (avoid webpack internal paths)
    // Next.js webpack intercepts require.resolve, so we use path.resolve directly
    const workerPath = path.resolve(
      process.cwd(),
      'node_modules',
      'tesseract.js',
      'src',
      'worker-script',
      'node',
      'index.js'
    );
    
    // Verify the file exists and get real path
    let realWorkerPath;
    try {
      if (fs.existsSync(workerPath)) {
        realWorkerPath = fs.realpathSync(workerPath);
      } else {
        throw new Error(`Worker file not found at: ${workerPath}`);
      }
    } catch (error) {
      realWorkerPath = workerPath; // Fallback to original path
    }
    
    
    workerPromise = createWorker('eng', 1, {
      workerPath: realWorkerPath,
    });
    // Initialize the worker
    await workerPromise;
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
      imageBuffer = imageInput;
    } else {
      // Fetch the image from URL
      const imageResponse = await axios.get(imageInput, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 second timeout for URL fetch
      });
      
      imageBuffer = Buffer.from(imageResponse.data);
    }
    
    // Get or create worker
    const worker = await getWorker();
    
    // Perform OCR recognition
    const { data: { text } } = await queueRecognition(async () => {
      return await worker.recognize(imageBuffer);
    });
    
    
    // Parse the extracted text
    const parsedData = parseTradeText(text);
    
    
    return {
      success: true,
      data: parsedData,
      rawText: text,
    };
  } catch (error) {
    
    return {
      success: false,
      error: error.message || 'OCR processing failed',
    };
  }
}

/**
 * Parse trade information from OCR text
 * Specifically designed to parse table row format from Closed tab
 * Format: @BTC © Buy 0.02 87.526.77 87.461.90 106997749 Jan 1, 12:37:44 PM Jan 1, 12:41:33 PM 87,598.54 87,482.01 -1.30
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

  // Find the table row in Closed tab - look for line containing BTC and Buy/Sell
  // Pattern: @BTC © Buy 0.02 87.526.77 87.461.90 ... or similar
  let tableRow = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Look for lines that contain symbol (BTC) and type (Buy/Sell)
    if (/\b(BTC|ETH|BNB|ADA|SOL|XRP|DOT|DOGE|MATIC|AVAX|LINK|UNI|LTC|ATOM|ETC)\b/i.test(line) && 
        /\b(Buy|Sell)\b/i.test(line) &&
        /\d+\.\d+/.test(line)) { // Contains decimal numbers (prices)
      tableRow = line;
      break;
    }
  }

  if (!tableRow) {
    // Fallback to old method if table row not found
    return parseTradeTextFallback(text);
  }

  // Parse the table row
  // Remove special characters and normalize spaces
  let normalizedRow = tableRow.replace(/[@©]/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Extract symbol (BTC, ETH, etc.)
  const symbolMatch = normalizedRow.match(/\b(BTC|ETH|BNB|ADA|SOL|XRP|DOT|DOGE|MATIC|AVAX|LINK|UNI|LTC|ATOM|ETC|XLM|ALGO|FIL|TRX|EOS|AAVE|MKR|COMP|SUSHI|YFI|SNX|CRV|BAL|ZRX|BAT|ZEC|DASH|XMR|WAVES|NEAR|FTM|SAND|MANA|ENJ|AXS|GALA|CHZ|THETA|FLOW|ICP|HBAR|VET|IOTA|NEO|ONT|QTUM|ZIL|IOST|KSM)\b/i);
  if (symbolMatch) {
    tradeData.symbol = symbolMatch[1].toUpperCase();
  }

  // Extract trade type (Buy/Sell)
  const typeMatch = normalizedRow.match(/\b(Buy|Sell)\b/i);
  if (typeMatch) {
    tradeData.type = typeMatch[1].charAt(0).toUpperCase() + typeMatch[1].slice(1).toLowerCase();
  }

  // Helper function to parse number string (handle dots/commas)
  function parseNumber(str) {
    // Remove all commas (thousands separators)
    let cleaned = str.replace(/,/g, '');
    
    // Handle multiple dots: 87.526.77 -> treat all dots except last as thousands separators
    if (cleaned.match(/^\d+\.\d+\.\d+$/)) {
      // Remove all dots, then add decimal point before last 2 digits
      cleaned = cleaned.replace(/\./g, '');
      cleaned = cleaned.slice(0, -2) + '.' + cleaned.slice(-2);
    }
    
    return parseFloat(cleaned);
  }

  // Extract all numbers from the row (in order)
  // Pattern: @BTC © Buy 0.02 87.526.77 87.461.90 106997749 Jan 1, 12:37:44 PM Jan 1, 12:41:33 PM 87,598.54 87,482.01 -1.30
  const numberPattern = /([+-]?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+\.\d+(?:\.\d+)?|\d+)/g;
  const numberMatches = [];
  let match;
  while ((match = numberPattern.exec(normalizedRow)) !== null) {
    numberMatches.push(match[1]);
  }

  const prices = [];
  let volumeFound = false;
  let dateTimeStarted = false;

  for (let i = 0; i < numberMatches.length; i++) {
    const numStr = numberMatches[i];
    const num = parseNumber(numStr);

    if (isNaN(num)) continue;

    // Skip if we're in date/time section (after first date pattern appears)
    if (!dateTimeStarted && /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(normalizedRow.substring(normalizedRow.indexOf(numStr) - 10))) {
      dateTimeStarted = true;
    }

    // Volume: small decimal (0.01 to 10), appears early
    if (!volumeFound && num > 0 && num < 100 && numStr.includes('.')) {
      tradeData.volumeLot = num;
      volumeFound = true;
      continue;
    }

    // Position ID: very large integer without decimals (skip)
    if (num > 100000000 && !numStr.includes('.')) {
      continue;
    }

    // P/L: negative number
    if (num < 0) {
      tradeData.profitLoss = num;
      continue;
    }

    // Price: large number (typically 1000+ for crypto prices)
    if (num > 1000 && numStr.includes('.')) {
      prices.push(num);
    }
  }

  // Assign prices in order: Open, Close, Take Profit, Stop Loss
  // Prices appear in sequence: volume, open, close, (position skipped), take profit, stop loss
  if (prices.length >= 1) {
    tradeData.openPrice = prices[0];
  }
  if (prices.length >= 2) {
    tradeData.closePrice = prices[1];
  }
  if (prices.length >= 3) {
    tradeData.takeProfit = prices[2];
  }
  if (prices.length >= 4) {
    tradeData.stopLoss = prices[3];
  }

  // Extract dates and times
  // Pattern: "Jan 1, 12:37:44 PM" or similar
  const dateTimePattern = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)/gi;
  const dateTimeMatches = [];
  let dtMatch;
  while ((dtMatch = dateTimePattern.exec(tableRow)) !== null) {
    dateTimeMatches.push({
      month: dtMatch[1],
      day: dtMatch[2],
      hour: dtMatch[3],
      minute: dtMatch[4],
      second: dtMatch[5],
      ampm: dtMatch[6]
    });
  }

  if (dateTimeMatches.length >= 2) {
    try {
      // Parse open time
      const openDT = dateTimeMatches[0];
      const openDate = parseDateTime(openDT.month, openDT.day, openDT.hour, openDT.minute, openDT.second, openDT.ampm);
      if (openDate) {
        tradeData.openTime = openDate;
        tradeData.tradeDate = new Date(openDate);
        tradeData.tradeDate.setHours(0, 0, 0, 0); // Set to start of day
      }

      // Parse close time
      const closeDT = dateTimeMatches[1];
      const closeDate = parseDateTime(closeDT.month, closeDT.day, closeDT.hour, closeDT.minute, closeDT.second, closeDT.ampm);
      if (closeDate) {
        tradeData.closeTime = closeDate;
      }
    } catch (e) {
      console.error('Error parsing dates:', e);
    }
  }

  return tradeData;
}

/**
 * Parse date/time string to Date object
 */
function parseDateTime(month, day, hour, minute, second, ampm) {
  const monthMap = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
  };

  let h = parseInt(hour, 10);
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;

  const year = new Date().getFullYear(); // Use current year
  const date = new Date(year, monthMap[month], parseInt(day, 10), h, parseInt(minute, 10), parseInt(second, 10));
  return date;
}

/**
 * Fallback parsing method (old logic)
 */
function parseTradeTextFallback(text) {
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

  // Try to extract symbol
  const symbolMatch = text.match(/\b(BTC|ETH|BNB|ADA|SOL|XRP|DOT|DOGE|MATIC|AVAX|LINK|UNI|LTC|ATOM|ETC)\b/i);
  if (symbolMatch) {
    tradeData.symbol = symbolMatch[1].toUpperCase();
  }

  // Try to extract trade type
  const buyMatch = text.match(/\b(buy|long|purchase)\b/i);
  const sellMatch = text.match(/\b(sell|short|close)\b/i);
  if (buyMatch) tradeData.type = 'Buy';
  if (sellMatch) tradeData.type = 'Sell';

  return tradeData;
}

module.exports = {
  extractTradeDataFromImage,
};
