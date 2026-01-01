import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { extractTradeDataFromImage } from '@/utils/ocrParser';
import connectDB from '@/lib/mongodb';
import Trade from '@/models/Trade';

export async function POST(request) {
  try {
    // Check authentication
    const auth = await requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    const formData = await request.formData();
    const file = formData.get('screenshot');
    const tradeDate = formData.get('tradeDate') || new Date().toISOString();
    const manualData = formData.get('manualData');
    const extractOnly = formData.get('extractOnly') === 'true';

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Check file size (max 5MB for better reliability)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, message: 'File too large. Maximum size is 5MB for reliable upload. Please compress your image and try again.' },
        { status: 400 }
      );
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, message: 'Invalid file type. Please upload JPG, PNG, GIF, or WEBP images only.' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    let buffer;
    try {
      const bytes = await file.arrayBuffer();
      buffer = Buffer.from(bytes);
    } catch (error) {
      console.error('Buffer conversion error:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to process image file. Please try again.' },
        { status: 400 }
      );
    }

    // Upload to Cloudinary with error handling and promise rejection handling
    let url, publicId;
    try {
      // Wrap in Promise to handle any unhandled rejections
      const uploadResult = await Promise.resolve(uploadToCloudinary(
        buffer,
        file.name,
        new Date(tradeDate)
      )).catch((error) => {
        // Catch any unhandled rejections
        console.error('Cloudinary upload promise rejection:', error);
        throw error;
      });
      
      url = uploadResult.url;
      publicId = uploadResult.publicId;
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      
      // Provide user-friendly error message
      let errorMessage = 'Failed to upload image to cloud storage. ';
      if (error.message) {
        errorMessage = error.message;
      } else if (error.name === 'TimeoutError' || error.http_code === 499) {
        errorMessage = 'Upload timeout: The image upload took too long. Please try with a smaller image (max 5MB recommended) or check your internet connection.';
      } else {
        errorMessage += 'Please check your internet connection and try again.';
      }
      
      return NextResponse.json(
        { 
          success: false, 
          message: errorMessage
        },
        { status: 500 }
      );
    }

    // If extractOnly flag is set, just return the image URL and extracted data
    if (extractOnly) {
      // Try OCR extraction (with timeout handling)
      let ocrResult;
      try {
        // Set a timeout for OCR processing (30 seconds)
        ocrResult = await Promise.race([
          extractTradeDataFromImage(buffer),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('OCR processing timeout')), 30000)
          )
        ]);
      } catch (error) {
        console.error('OCR extraction error:', error);
        // If OCR fails or times out, still return image URL for manual entry
        return NextResponse.json({
          success: true,
          imageUrl: url,
          publicId: publicId,
          extractedData: null,
          message: 'Image uploaded successfully. OCR extraction failed or timed out. Please enter data manually.',
        });
      }
      
      if (ocrResult && ocrResult.success && ocrResult.data) {
        return NextResponse.json({
          success: true,
          imageUrl: url,
          publicId: publicId,
          extractedData: ocrResult.data,
          message: 'Image uploaded and data extracted successfully',
        });
      } else {
        // If OCR fails, still return image URL for manual entry
        return NextResponse.json({
          success: true,
          imageUrl: url,
          publicId: publicId,
          extractedData: null,
          message: 'Image uploaded. OCR extraction failed. Please enter data manually.',
        });
      }
    }

    let tradeData;

    // If manual data is provided, use it; otherwise try OCR
    if (manualData) {
      const parsed = JSON.parse(manualData);
      tradeData = {
        ...parsed,
        tradeDate: new Date(parsed.tradeDate || tradeDate),
        screenshotUrl: url,
        cloudinaryPublicId: publicId,
      };
    } else {
      // Try OCR extraction with timeout handling
      let ocrResult;
      try {
        // Set a timeout for OCR processing (30 seconds)
        ocrResult = await Promise.race([
          extractTradeDataFromImage(buffer),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('OCR processing timeout')), 30000)
          )
        ]);
      } catch (error) {
        console.error('OCR extraction error:', error);
        // If OCR fails or times out, return with image URL for manual entry
        return NextResponse.json({
          success: false,
          message: 'OCR extraction failed or timed out. Please enter data manually.',
          imageUrl: url,
          publicId: publicId,
        });
      }
      
      if (ocrResult && ocrResult.success) {
        tradeData = {
          ...ocrResult.data,
          tradeDate: ocrResult.data.tradeDate || new Date(tradeDate),
          screenshotUrl: url,
          cloudinaryPublicId: publicId,
        };
      } else {
        // If OCR fails, return with image URL for manual entry
        return NextResponse.json({
          success: false,
          message: 'OCR extraction failed. Please enter data manually.',
          imageUrl: url,
          publicId: publicId,
        });
      }
    }

    // Validate required fields
    if (!tradeData.symbol || !tradeData.type || !tradeData.openPrice || !tradeData.closePrice) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Missing required trade data. Please ensure Symbol, Type, Open Price, and Close Price are provided.',
          imageUrl: url,
          publicId: publicId,
        },
        { status: 400 }
      );
    }

    // Create trade record with error handling
    let trade;
    try {
      trade = await Trade.create(tradeData);
    } catch (dbError) {
      console.error('Database error:', dbError);
      // If database save fails, we should still have the image uploaded
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to save trade to database. Image was uploaded successfully. Please try again.',
          imageUrl: url,
          publicId: publicId,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      trade: trade,
      message: 'Trade uploaded successfully',
    });
  } catch (error) {
    console.error('Upload error:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Internal server error';
    if (error.message) {
      errorMessage = error.message;
    } else if (error.name === 'TimeoutError') {
      errorMessage = 'Request timeout. The operation took too long. Please try again with a smaller image.';
    } else if (error.message?.includes('timeout')) {
      errorMessage = 'Operation timed out. Please try again.';
    }
    
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}

