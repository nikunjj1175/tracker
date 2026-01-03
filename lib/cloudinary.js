const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const DEFAULT_OPTIONS = {
  resource_type: 'image',
  format: 'jpg',
  quality: 'auto:good',
  fetch_format: 'auto',
  width: 1920,
  height: 1920,
  crop: 'limit',
};

function dataUrlToBuffer(dataUrl) {
  const base64String = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  return Buffer.from(base64String, 'base64');
}

function uploadBuffer(buffer, options) {
  return new Promise((resolve, reject) => {
    try {
      const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(error);
        } else if (result) {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        } else {
          reject(new Error('Upload failed'));
        }
      });

      const bufferStream = new Readable();
      bufferStream.push(buffer);
      bufferStream.push(null);
      bufferStream.pipe(uploadStream);
    } catch (error) {
      console.error('Cloudinary upload exception:', error);
      reject(error);
    }
  });
}

/**
 * Upload image to Cloudinary (same pattern as mandal project)
 * Supports Buffer, base64 string, or URL string
 * @param {Buffer|string} source - Image buffer, base64 string, or URL
 * @param {string} folder - Folder path in Cloudinary
 * @param {string} publicId - Public ID for the image
 * @returns {Promise<{secure_url: string, public_id: string}>}
 */
async function uploadToCloudinary(source, folder, publicId) {
  
  const options = {
    ...DEFAULT_OPTIONS,
    folder,
    public_id: publicId,
  };

  if (Buffer.isBuffer(source)) {
    const result = await uploadBuffer(source, options);
    return {
      secure_url: result.url || result.secure_url,
      public_id: result.publicId || result.public_id,
    };
  }

  if (typeof source === 'string') {
    const trimmed = source.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      const result = await cloudinary.uploader.upload(trimmed, options);
      return {
        secure_url: result.secure_url,
        public_id: result.public_id,
      };
    }

    if (trimmed.startsWith('data:') || /^[A-Za-z0-9+/]+=*$/.test(trimmed)) {
      const buffer = dataUrlToBuffer(trimmed);
      const result = await uploadBuffer(buffer, options);
      return {
        secure_url: result.url || result.secure_url,
        public_id: result.publicId || result.public_id,
      };
    }
  }

  throw new Error('Unsupported file type for Cloudinary upload');
}

/**
 * Delete image from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 */
async function deleteFromCloudinary(publicId) {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return { success: true };
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
  cloudinary,
};
