/**
 * Thumbnail Service
 * Handles thumbnail and preview generation using Sharp
 */

const path = require('path');
const fs = require('fs').promises;

class ThumbnailService {
    constructor() {
        this.sharp = null;
        this.supportedFormats = [
            'jpg', 'jpeg', 'png', 'webp', 'tiff', 'tif', 'bmp', 'gif', 'svg',
            'heic', 'heif', 'raw', 'dng', 'cr2', 'nef', 'arw', 'orf', 'rw2'
        ];
    }

    /**
     * Initialize Sharp library
     */
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

    /**
     * Check if file format is supported for thumbnail generation
     * @param {string} filePath - Path to the file
     * @param {string} mimeType - MIME type of the file
     * @returns {boolean} True if supported
     */
    isSupported(filePath, mimeType) {
        const ext = path.extname(filePath).toLowerCase().substring(1);
        return this.supportedFormats.includes(ext) || 
               (mimeType && mimeType.startsWith('image/'));
    }

    /**
     * Generate thumbnail for an image
     * @param {string} filePath - Path to the source image
     * @param {Object} options - Thumbnail options
     * @param {number} options.size - Maximum size (width/height) in pixels
     * @param {number} options.quality - Quality (0-100)
     * @param {string} options.originalFilename - Original filename to use for naming (optional)
     * @returns {Promise<Object>} Result with { success: boolean, buffer?: Buffer, filename: string, size?: number }
     */
    async generateThumbnail(filePath, options = {}) {
        await this.initialize();
        
        const {
            size = 400,
            quality = 90,
            originalFilename = null
        } = options;

        try {
            console.log(`Generating thumbnail for ${filePath} (size: ${size}px, quality: ${quality})`);
            
            const buffer = await this.sharp(filePath)
                .resize(size, size, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .webp({ quality })
                .toBuffer();

            const originalName = originalFilename || path.basename(filePath);
            const filename = this.generateThumbnailFilename(originalName);

            console.log(`Thumbnail generated successfully: ${filename} (${buffer.length} bytes)`);
            
            return {
                success: true,
                buffer,
                filename,
                size: buffer.length,
                mimeType: 'image/webp'
            };
        } catch (error) {
            console.error('Failed to generate thumbnail:', error);
            const originalName = originalFilename || path.basename(filePath);
            return {
                success: false,
                error: error.message,
                filename: this.generateThumbnailFilename(originalName)
            };
        }
    }

    /**
     * Generate preview for an image
     * @param {string} filePath - Path to the source image
     * @param {Object} options - Preview options
     * @param {number} options.size - Maximum size (width/height) in pixels
     * @param {number} options.quality - Quality (0-100)
     * @param {string} options.originalFilename - Original filename to use for naming (optional)
     * @returns {Promise<Object>} Result with { success: boolean, buffer?: Buffer, filename: string, size?: number }
     */
    async generatePreview(filePath, options = {}) {
        await this.initialize();
        
        const {
            size = 1920,
            quality = 90,
            originalFilename = null
        } = options;

        try {
            console.log(`Generating preview for ${filePath} (size: ${size}px, quality: ${quality})`);
            
            const buffer = await this.sharp(filePath)
                .resize(size, size, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .webp({ quality })
                .toBuffer();

            const originalName = originalFilename || path.basename(filePath);
            const filename = this.generatePreviewFilename(originalName);

            console.log(`Preview generated successfully: ${filename} (${buffer.length} bytes)`);
            
            return {
                success: true,
                buffer,
                filename,
                size: buffer.length,
                mimeType: 'image/webp'
            };
        } catch (error) {
            console.error('Failed to generate preview:', error);
            const originalName = originalFilename || path.basename(filePath);
            return {
                success: false,
                error: error.message,
                filename: this.generatePreviewFilename(originalName)
            };
        }
    }

    /**
     * Generate both thumbnail and preview
     * @param {string} filePath - Path to the source image
     * @param {Object} options - Options for both thumbnail and preview
     * @param {string} options.originalFilename - Original filename to use for naming (optional)
     * @returns {Promise<Object>} Result with { thumbnail: Object, preview: Object }
     */
    async generateBoth(filePath, options = {}) {
        const {
            thumbnailSize = 400,
            thumbnailQuality = 90,
            previewSize = 1920,
            previewQuality = 90,
            originalFilename = null
        } = options;

        const [thumbnailResult, previewResult] = await Promise.allSettled([
            this.generateThumbnail(filePath, { size: thumbnailSize, quality: thumbnailQuality, originalFilename }),
            this.generatePreview(filePath, { size: previewSize, quality: previewQuality, originalFilename })
        ]);

        const originalName = originalFilename || path.basename(filePath);
        return {
            thumbnail: thumbnailResult.status === 'fulfilled' ? thumbnailResult.value : {
                success: false,
                error: thumbnailResult.reason?.message || 'Unknown error',
                filename: this.generateThumbnailFilename(originalName)
            },
            preview: previewResult.status === 'fulfilled' ? previewResult.value : {
                success: false,
                error: previewResult.reason?.message || 'Unknown error', 
                filename: this.generatePreviewFilename(originalName)
            }
        };
    }

    /**
     * Generate thumbnail filename
     * @param {string} originalFilename - Original filename
     * @returns {string} Thumbnail filename
     */
    generateThumbnailFilename(originalFilename) {
        const parsed = path.parse(originalFilename);
        return `${parsed.name}.th.webp`;
    }

    /**
     * Generate preview filename
     * @param {string} originalFilename - Original filename
     * @returns {string} Preview filename
     */
    generatePreviewFilename(originalFilename) {
        const parsed = path.parse(originalFilename);
        return `${parsed.name}.pv.webp`;
    }

    /**
     * Get supported image formats
     * @returns {Array<string>} Array of supported file extensions
     */
    getSupportedFormats() {
        return [...this.supportedFormats];
    }

    /**
     * Get Sharp library version info
     * @returns {Object} Version information
     */
    getVersionInfo() {
        if (!this.sharp) {
            return { available: false };
        }
        
        return {
            available: true,
            version: this.sharp.versions
        };
    }
}

module.exports = { ThumbnailService }; 