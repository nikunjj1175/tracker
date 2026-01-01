import Tesseract from 'tesseract.js';

/**
 * Extract trading data from screenshot using OCR
 * This is a basic implementation - you may need to customize based on your trading platform
 * @param {Buffer} imageBuffer - Image buffer
 * @returns {Promise<object>} Extracted trade data
 */
export async function extractTradeDataFromImage(imageBuffer) {
  try {
    // Perform OCR on the image
    const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng', {
      logger: (m) => console.log(m), // Optional: log OCR progress
    });

    // Parse the extracted text
    const tradeData = parseTradeText(text);

    return {
      success: true,
      data: tradeData,
      rawText: text, // Include raw text for manual review
    };
  } catch (error) {
    console.error('OCR Error:', error);
    return {
      success: false,
      error: error.message,
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

/**
 * Manual data entry helper - for when OCR fails
 * This can be used to manually input trade data
 */
export function createManualTradeData(data) {
  return {
    symbol: data.symbol?.toUpperCase() || null,
    type: data.type || null,
    volumeLot: parseFloat(data.volumeLot) || null,
    openPrice: parseFloat(data.openPrice) || null,
    closePrice: parseFloat(data.closePrice) || null,
    takeProfit: data.takeProfit ? parseFloat(data.takeProfit) : null,
    stopLoss: data.stopLoss ? parseFloat(data.stopLoss) : null,
    profitLoss: parseFloat(data.profitLoss) || null,
    tradeDate: data.tradeDate ? new Date(data.tradeDate) : new Date(),
    openTime: data.openTime ? new Date(data.openTime) : null,
    closeTime: data.closeTime ? new Date(data.closeTime) : null,
  };
}

