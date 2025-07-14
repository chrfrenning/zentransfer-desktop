/**
 * Metadata Service
 * Handles metadata extraction using exiftool-vendored
 */

const path = require('path');

class MetadataService {
    constructor() {
        this.exiftool = null;
        this.supportedFormats = [
            // Images
            'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif',
            'heic', 'heif', 'raw', 'dng', 'cr2', 'nef', 'arw', 'orf', 'rw2',
            'pef', 'raf', 'srw', '3fr', 'fff', 'iiq', 'k25', 'kdc', 'mef',
            'mos', 'mrw', 'nrw', 'ptx', 'pxn', 'r3d', 'rwl', 'rwz', 'sr2',
            'srf', 'x3f',
            // Videos
            'mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm', 'm4v',
            'mpg', 'mpeg', '3gp', 'asf', 'f4v', 'm2ts', 'mts', 'ts',
            // Audio
            'mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'wma', 'opus',
            // Documents (limited metadata)
            'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'
        ];
    }

    /**
     * Initialize exiftool library
     */
    async initialize() {
        if (!this.exiftool) {
            try {
                const { exiftool } = require('exiftool-vendored');
                this.exiftool = exiftool;
                console.log('ExifTool initialized successfully');
            } catch (error) {
                console.error('Failed to initialize ExifTool:', error);
                throw new Error('ExifTool is required for metadata extraction');
            }
        }
    }

    /**
     * Check if file format is supported for metadata extraction
     * @param {string} filePath - Path to the file
     * @param {string} mimeType - MIME type of the file
     * @returns {boolean} True if supported
     */
    isSupported(filePath, mimeType) {
        const ext = path.extname(filePath).toLowerCase().substring(1);
        return this.supportedFormats.includes(ext) || 
               (mimeType && (mimeType.startsWith('image/') || mimeType.startsWith('video/') || mimeType.startsWith('audio/')));
    }

    /**
     * Extract metadata from a file
     * @param {string} filePath - Path to the source file
     * @param {Object} options - Extraction options
     * @param {string} options.originalFilename - Original filename to use for naming (optional)
     * @returns {Promise<Object>} Result with { success: boolean, metadata?: Object, filename: string, error?: string }
     */
    async extractMetadata(filePath, options = {}) {
        await this.initialize();
        
        const { originalFilename = null } = options;

        try {
            console.log(`Extracting metadata from ${filePath}`);
            
            // Extract all available metadata
            const metadata = await this.exiftool.read(filePath);
            
            // Convert metadata to a clean JSON-serializable object
            const cleanMetadata = this.cleanMetadata(metadata);
            
            // Generate filename for metadata
            const baseFilename = originalFilename || path.basename(filePath);
            const filename = this.generateMetadataFilename(baseFilename);
            
            // Add extraction info
            const metadataWithInfo = {
                extractionInfo: {
                    extractedAt: new Date().toISOString(),
                    sourceFile: baseFilename,
                    library: 'exiftool-vendored',
                    tool: 'zentransfer'
                },
                metadata: cleanMetadata
            };
            
            console.log(`Metadata extracted successfully: ${filename} (${Object.keys(cleanMetadata).length} fields)`);
            
            return {
                success: true,
                metadata: metadataWithInfo,
                filename: filename,
                jsonString: JSON.stringify(metadataWithInfo, null, 2)
            };
            
        } catch (error) {
            console.error(`Failed to extract metadata from ${filePath}:`, error);
            return {
                success: false,
                error: error.message,
                filename: this.generateMetadataFilename(originalFilename || path.basename(filePath))
            };
        }
    }

    /**
     * Clean metadata object for JSON serialization
     * ExifTool returns objects with special properties that need cleaning
     * @param {Object} metadata - Raw metadata from exiftool
     * @returns {Object} Clean metadata object
     */
    cleanMetadata(metadata) {
        const cleaned = {};
        
        for (const [key, value] of Object.entries(metadata)) {
            // Skip special exiftool properties that start with underscore
            if (key.startsWith('_')) {
                continue;
            }
            
            try {
                // Handle different value types
                if (value === null || value === undefined) {
                    cleaned[key] = null;
                } else if (typeof value === 'object') {
                    // Handle dates, arrays, and objects
                    if (value instanceof Date) {
                        cleaned[key] = value.toISOString();
                    } else if (Array.isArray(value)) {
                        cleaned[key] = value.map(item => 
                            typeof item === 'object' && item instanceof Date 
                                ? item.toISOString() 
                                : item
                        );
                    } else {
                        // Convert object to string or clean recursively
                        cleaned[key] = JSON.parse(JSON.stringify(value));
                    }
                } else {
                    // Primitive values
                    cleaned[key] = value;
                }
            } catch (cleanError) {
                // If we can't clean the value, convert to string
                console.warn(`Failed to clean metadata field ${key}:`, cleanError);
                cleaned[key] = String(value);
            }
        }
        
        return cleaned;
    }

    /**
     * Generate filename for metadata JSON
     * @param {string} originalFilename - Original filename
     * @returns {string} Metadata filename
     */
    generateMetadataFilename(originalFilename) {
        const ext = path.extname(originalFilename);
        const nameWithoutExt = path.basename(originalFilename, ext);
        return `${nameWithoutExt}.metadata.json`;
    }

    /**
     * Get supported file formats
     * @returns {Array<string>} Array of supported extensions
     */
    getSupportedFormats() {
        return [...this.supportedFormats];
    }

    /**
     * Get version information
     * @returns {Promise<Object>} Version information
     */
    async getVersionInfo() {
        await this.initialize();
        try {
            const version = await this.exiftool.version();
            return {
                exiftool: version,
                service: '1.0.0'
            };
        } catch (error) {
            return {
                error: error.message,
                service: '1.0.0'
            };
        }
    }

    /**
     * Cleanup exiftool process (call when shutting down)
     */
    async cleanup() {
        if (this.exiftool) {
            try {
                await this.exiftool.end();
                console.log('ExifTool process ended');
            } catch (error) {
                console.warn('Failed to end ExifTool process:', error);
            }
        }
    }
}

module.exports = { MetadataService }; 