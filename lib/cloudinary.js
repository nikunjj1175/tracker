import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
  timeout: 60000, // 60 seconds timeout
  chunk_size: 6000000, // 6MB chunks
});

/**
 * Upload image to Cloudinary with organized folder structure
 * Uses base64 upload for better reliability with smaller files
 * @param {Buffer} imageBuffer - Image file buffer
 * @param {string} originalName - Original filename
 * @param {Date} tradeDate - Trade date for folder structure
 * @returns {Promise<{url: string, publicId: string}>}
 */
export async function uploadToCloudinary(imageBuffer, originalName, tradeDate = new Date()) {
  return new Promise(async (resolve, reject) => {
    // Set overall timeout (50 seconds - less than Cloudinary's 60s)
    const timeout = setTimeout(() => {
      reject(new Error('Upload timeout: Cloudinary upload took too long. Please try again with a smaller image (max 5MB recommended).'));
    }, 50000);

    try {
      const date = new Date(tradeDate);
      const year = date.getFullYear();
      const month = date.toLocaleString('default', { month: 'long' });
      const day = date.toLocaleDateString('en-GB').replace(/\//g, '-');

      // Create folder path: crypto-trades/2026/January/01-01-2026
      const folderPath = `crypto-trades/${year}/${month}/${day}`;

      // Generate unique filename
      const timestamp = Date.now();
      const extension = originalName.split('.').pop() || 'jpg';
      const baseName = originalName.split('.')[0] || 'trade';
      const filename = `${baseName}_${timestamp}`;

      // For files smaller than 5MB, use base64 upload (more reliable)
      // For larger files, use stream upload
      const fileSize = imageBuffer.length;
      const useBase64 = fileSize < 5 * 1024 * 1024; // 5MB threshold

      if (useBase64) {
        // Convert buffer to base64 data URI
        const base64Data = imageBuffer.toString('base64');
        const dataUri = `data:image/${extension};base64,${base64Data}`;

        // Use upload method with base64
        cloudinary.uploader.upload(
          dataUri,
          {
            folder: folderPath,
            public_id: filename,
            resource_type: 'image',
            timeout: 50000,
            invalidate: true,
          },
          (error, result) => {
            clearTimeout(timeout);
            
            if (error) {
              console.error('Cloudinary base64 upload error:', error);
              handleUploadError(error, reject);
            } else if (!result) {
              reject(new Error('Upload failed: No result from Cloudinary'));
            } else {
              resolve({
                url: result.secure_url,
                publicId: result.public_id,
              });
            }
          }
        );
      } else {
        // Use stream upload for larger files
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: folderPath,
            public_id: filename,
            resource_type: 'image',
            timeout: 50000,
            chunk_size: 5000000, // 5MB chunks
            invalidate: true,
          },
          (error, result) => {
            clearTimeout(timeout);
            
            if (error) {
              console.error('Cloudinary stream upload error:', error);
              handleUploadError(error, reject);
            } else if (!result) {
              reject(new Error('Upload failed: No result from Cloudinary'));
            } else {
              resolve({
                url: result.secure_url,
                publicId: result.public_id,
              });
            }
          }
        );

        // Handle stream errors
        uploadStream.on('error', (error) => {
          clearTimeout(timeout);
          console.error('Upload stream error:', error);
          handleUploadError(error, reject);
        });

        // Convert buffer to stream
        const stream = Readable.from(imageBuffer);
        
        // Handle stream errors
        stream.on('error', (error) => {
          clearTimeout(timeout);
          console.error('Buffer stream error:', error);
          reject(new Error(`Buffer stream error: ${error.message || 'Unknown error'}`));
        });

        stream.pipe(uploadStream);
      }
    } catch (error) {
      clearTimeout(timeout);
      console.error('Upload setup error:', error);
      reject(new Error(`Upload setup failed: ${error.message || 'Unknown error'}`));
    }
  });
}

/**
 * Handle Cloudinary upload errors with specific messages
 */
function handleUploadError(error, reject) {
  if (error.http_code === 499 || error.name === 'TimeoutError' || error.message?.includes('Timeout') || error.message?.includes('timeout')) {
    reject(new Error('Upload timeout: The image upload took too long. Please try with a smaller image (max 5MB recommended) or check your internet connection.'));
  } else if (error.http_code === 400) {
    reject(new Error('Invalid image format. Please upload JPG, PNG, GIF, or WEBP files.'));
  } else if (error.http_code === 401) {
    reject(new Error('Cloudinary authentication failed. Please check your API credentials.'));
  } else if (error.http_code === 403) {
    reject(new Error('Cloudinary access denied. Please check your API permissions.'));
  } else if (error.http_code === 413 || error.message?.includes('too large')) {
    reject(new Error('File too large. Maximum size is 10MB. Please compress your image.'));
  } else {
    reject(new Error(`Cloudinary upload failed: ${error.message || 'Unknown error. Please try again.'}`));
  }
}

/**
 * Delete image from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 */
export async function deleteFromCloudinary(publicId) {
  try {
    await cloudinary.uploader.destroy(publicId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export default cloudinary;

