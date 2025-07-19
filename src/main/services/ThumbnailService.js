/**
 * Thumbnail Service
 * Handles thumbnail and preview generation using Sharp
 * Automatically handles EXIF orientation metadata for proper image rotation
 */

const path = require('path');
const fs = require('fs').promises;

class ThumbnailService {
    constructor() {
        this.sharp = null;
        this.supportedFormats = [
            'jpg', 'jpeg', 'png', 'webp', 'tiff', 'tif', 'bmp', 'gif'
        ];
    }
    
    async initialize() {
        if (!this.sharp) {
            try {
                this.sharp = require('sharp');
                console.log('Sharp library initialized successfully');
            } catch (error) {
                console.error('Failed to initialize Sharp library:', error);
                throw new Error('Sharp library is required for thumbnail generation');
            }
        }
    }
    
    isSupported(filePath, mimeType) {
        const ext = path.extname(filePath).toLowerCase().substring(1);
        return this.supportedFormats.includes(ext);
    }
    
    async generatePreview(filePath, options = {}) {
        // Make sure we're initialized
        if ( !this.sharp ) {
            this.initialize();
        }

        // Ensure correct options are passed
        const {
            size = 314, // if it is pi, then you didn't pass the options right
            quality = 80
        } = options;


        // Try preview generation
        try {
            console.log(`Generating thumbnail for ${filePath} (size: ${size}px, quality: ${quality})`);
            
            const buffer = await this.sharp(filePath)
                .rotate() // Automatically handle EXIF orientation
                .resize(size, size, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .webp({ quality })
                .toBuffer();

            console.log(`Thumbnail generated successfully on ${filePath} (${buffer.length} bytes)`);
            
            return {
                success: true,
                buffer,
                size: buffer.length,
                mimeType: 'image/webp'
            };

        } catch (error) {

            console.error('Failed to generate thumbnail:', error);
            
            return {
                success: false,
                error: error.message
            };

        }
    }

    generateThumbnailFilename(originalFilename) {
        return this.generateRenditionFilename(originalFilename, 'th');
    }
    
    generatePreviewFilename(originalFilename) {
        return this.generateRenditionFilename(originalFilename, 'pv');
    }
    
    generateRenditionFilename(originalFilename, renditionType = 'pv') {
        const ext = path.extname(originalFilename);
        const nameWithoutExt = path.basename(originalFilename, ext);
        const dirname = path.dirname(originalFilename);
        return path.join(dirname, `${nameWithoutExt}.${renditionType}.webp`);
    }
}

module.exports = { ThumbnailService }; 