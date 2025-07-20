/**
 * Metadata Service
 * Handles metadata extraction using exiftool-vendored
 */

const path = require('path');
const tmp = require('tmp');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { ExifTool } = require('exiftool-vendored');

class MetadataService {
    constructor() {
        this.exiftool = null;
    }

    initialize() {
        this.exiftool = new ExifTool();
    }
    
    isSupported(filePath, mimeType) {
        return mimeType && (mimeType.startsWith('image/'));
    }

    async extractMetadata(filePath) {
        try {

            if ( !this.exiftool ) {
                this.initialize();
            }

            console.log(`Extracting metadata from ${filePath}`);
            
            // Extract all available metadata
            const metadata = await this.exiftool.read(filePath);
            const cleanMetadata = this.cleanMetadata(metadata);
            
            // Add extraction info
            const metadataWithInfo = {
                extractionInfo: {
                    extractedAt: new Date().toISOString(),
                    sourceFile: path.basename(filePath),
                    library: 'exiftool-vendored',
                    tool: 'zentransfer'
                },
                metadata: cleanMetadata
            };
            
            console.log(`Metadata extracted successfully from  ${filePath} (${Object.keys(cleanMetadata).length} fields)`);
            
            return {
                success: true,
                metadata: metadataWithInfo
            };
            
        } catch (error) {

            console.error(`Failed to extract metadata from ${filePath}:`, error);

            return {
                success: false,
                error: error.message
            };

        }
    }

    async extractThumbnailAndPreview(filePath) {
        try {

            if ( !this.exiftool ) {
                this.initialize();
            }

            const uuid = uuidv4();

            //let thumbnailTempFileName  = tmp.tmpNameSync({ prefix: 'ztth-', postfix: '.jpg' });
            let thumbnailTempFileName = path.join(tmp.tmpdir, `ztth-${uuid}.jpg`);
            await this.exiftool.extractThumbnail(filePath, thumbnailTempFileName);
            const thumbnailSize = fs.statSync(thumbnailTempFileName).size;
            if ( !thumbnailSize ) {
                fs.unlinkSync(thumbnailTempFileName);
                thumbnailTempFileName = null;
            }

            //let previewTempFileName = tmp.tmpNameSync({ prefix: 'ztpv-', postfix: '.jpg' });
            let previewTempFileName = path.join(tmp.tmpdir, `ztpv-${uuid}.jpg`);
            await this.exiftool.extractPreview(filePath, previewTempFileName);
            const previewSize = fs.statSync(previewTempFileName).size;
            if ( !previewSize ) {
                fs.unlinkSync(previewTempFileName);
                previewTempFileName = null;
            }

            return {
                success: true,
                thumbnail: thumbnailTempFileName,
                preview: previewTempFileName
            };

        }

        catch (error) {

            console.error(`Failed to extract thumbnail and preview from ${filePath}:`, error);
            return {
                success: false,
                thumbnail: null,
                preview: null,
                error: error.message
            };

        }
    }
    
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
    
    static generateMetadataFilename(originalFilename) {
        const ext = path.extname(originalFilename);
        const nameWithoutExt = path.basename(originalFilename, ext);
        const dirname = path.dirname(originalFilename);
        return path.join(dirname, `${nameWithoutExt}.metadata.json`);
    }

    /**
     * IMPORTANT: Cleanup exiftool process (call when shutting down)
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