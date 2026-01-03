import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
const { uploadToCloudinary } = require('@/lib/cloudinary');
const { extractTradeDataFromImage } = require('@/utils/ocrParser');
import connectDB from '@/lib/mongodb';
import Trade from '@/models/Trade';

// Force dynamic rendering since we use request.headers for auth
export const dynamic = 'force-dynamic';

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

    let url, publicId;
    try {
      const date = new Date(tradeDate);
      const year = date.getFullYear();
      const month = date.toLocaleString('default', { month: 'long' });
      const day = date.toLocaleDateString('en-GB').replace(/\//g, '-');
      const folderPath = `crypto-trades/${year}/${month}/${day}`;
      const timestamp = Date.now();
      const extension = file.name.split('.').pop() || 'jpg';
      const baseName = file.name.split('.')[0] || 'trade';
      const filename = `${baseName}_${timestamp}`;
      
      // Upload using mandal project pattern
      const uploadResult = await uploadToCloudinary(
        buffer,
        folderPath,
        filename
      );
      
      url = uploadResult.url || uploadResult.secure_url;
      publicId = uploadResult.publicId || uploadResult.public_id;
    } catch (error) {
      
      return NextResponse.json(
        { 
          success: false, 
          message: `Failed to upload image: ${error.message || 'Unknown error'}`
        },
        { status: 500 }
      );
    }

    // If extractOnly flag is set, just return the image URL and extracted data
    if (extractOnly) {
      // Perform OCR with timeout (30 seconds for OCR processing)
      let ocrResult = null;
      
      try {
        // Pass the buffer directly instead of URL to avoid fetch timeout
        // Set timeout to 30 seconds for OCR processing (OCR can take time)
        ocrResult = await Promise.race([
          extractTradeDataFromImage(buffer),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('OCR timeout')), 30000)
          )
        ]);
        
        
        if (ocrResult && ocrResult.success && ocrResult.data) {
          return NextResponse.json({
            success: true,
            imageUrl: url,
            publicId: publicId,
            extractedData: ocrResult.data,
            message: 'Image uploaded and data extracted successfully',
          });
        }
      } catch (ocrError) {
        // Continue without OCR - user can enter data manually
      }
      
      // Return success with image URL (OCR failed, but upload succeeded)
      return NextResponse.json({
        success: true,
        imageUrl: url,
        publicId: publicId,
        extractedData: null,
        message: 'Image uploaded successfully. Please enter trade data manually.',
      });
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
      // If no manual data, require manual entry (OCR disabled due to worker issues)
      return NextResponse.json({
        success: false,
        message: 'Please provide trade data. OCR is currently unavailable.',
        imageUrl: url,
        publicId: publicId,
      });
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

