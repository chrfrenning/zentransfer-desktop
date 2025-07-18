/**
 * MimeTypesService
 * Loads and provides MIME type lookups from resources/mime.types
 */

const fs = require('fs');
const path = require('path');

class MimeTypesService {
    constructor() {
        this.mimeMap = new Map();
        this.extensionMap = new Map();
        this.loaded = false;
        this.loadMimeTypes();
    }

    /**
     * Loads the mime.types file from resources
     */
    loadMimeTypes() {
        if (this.loaded) return;
        try {

            // Find the root directory relative to this file
            const rootDir = path.resolve(__dirname, '../../');
            const mimeTypesPath = path.join(rootDir, 'resources', 'mime.types');
            if (!fs.existsSync(mimeTypesPath)) {
                console.warn(`MimeTypesService: mime.types file not found at ${mimeTypesPath}`);
                return;
            }

            const content = fs.readFileSync(mimeTypesPath, 'utf8');
            const lines = content.split('\n');
            for (const line of lines) {
                // Skip comments and empty lines
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;
                // Format: mimetype [ext1 ext2 ...]
                const parts = trimmed.split(/\s+/);
                if (parts.length < 2) continue;
                const mimeType = parts[0];
                const extensions = parts.slice(1);
                this.mimeMap.set(mimeType, extensions);
                for (const ext of extensions) {
                    this.extensionMap.set(ext.toLowerCase(), mimeType);
                }
            }

            this.loaded = true;

            console.log('MimeTypesService: Loaded mime.types file with ' + this.mimeMap.size + ' mime types');

        } catch (err) {
            console.error('MimeTypesService: Failed to load mime.types:', err);
        }
    }

    /**
     * Get MIME type for a given filename or extension
     * @param {string} fileNameOrExt
     * @returns {string} MIME type or 'application/octet-stream'
     */
    getMimeType(fileNameOrExt) {
        let ext = fileNameOrExt;
        if (fileNameOrExt.includes('.')) {
            ext = path.extname(fileNameOrExt).slice(1);
        }
        ext = ext.toLowerCase();
        
        if (this.extensionMap.has(ext)) {
            return this.extensionMap.get(ext);
        }

        return 'application/octet-stream';
    }

    /**
     * Get extensions for a given MIME type
     * @param {string} mimeType
     * @returns {Array<string>} Array of extensions or []
     */
    getExtensions(mimeType) {
        return this.mimeMap.get(mimeType) || [];
    }
}

module.exports = { MimeTypesService };
