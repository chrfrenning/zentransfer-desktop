/**
 * Import System Type Definitions
 * Defines interfaces and types used throughout the import system
 */

/**
 * Import job configuration
 * @typedef {Object} ImportJobConfig
 * @property {string} id - Unique job identifier
 * @property {string} sourcePath - Source directory path
 * @property {Array<DestinationConfig>} destinations - Array of destination configurations
 * @property {ImportOptions} options - Import options
 */

/**
 * Import options
 * @typedef {Object} ImportOptions
 * @property {boolean} includeSubdirectories - Whether to scan subdirectories
 * @property {Array<string>} fileExtensions - Allowed file extensions
 * @property {FolderOrganization} folderOrganization - Folder organization settings
 */

/**
 * Folder organization settings
 * @typedef {Object} FolderOrganization
 * @property {boolean} enabled - Whether folder organization is enabled
 * @property {string} type - Organization type ('date' or 'custom')
 * @property {string} customName - Custom folder name (if type is 'custom')
 * @property {string} dateFormat - Date format (if type is 'date')
 */

/**
 * Destination configuration
 * @typedef {Object} DestinationConfig
 * @property {string} type - Destination type ('local', 'backup', 'zentransfer')
 * @property {string} path - Destination path (for local/backup)
 * @property {Object} options - Destination-specific options
 * @property {boolean} enabled - Whether this destination is enabled
 */

/**
 * File information
 * @typedef {Object} FileInfo
 * @property {string} name - File name
 * @property {string} path - Full file path
 * @property {string} relativePath - Relative path from source
 * @property {number} size - File size in bytes
 * @property {string} type - File type ('image', 'video', 'other')
 * @property {string} extension - File extension
 * @property {Date} created - Creation date
 * @property {Date} modified - Modification date
 */

/**
 * Import progress information
 * @typedef {Object} ImportProgress
 * @property {string} jobId - Job identifier
 * @property {string} phase - Current phase ('scanning', 'copying', 'uploading', 'completed', 'failed')
 * @property {number} totalFiles - Total number of files to process
 * @property {number} processedFiles - Number of files processed
 * @property {number} successfulFiles - Number of successfully processed files
 * @property {number} failedFiles - Number of failed files
 * @property {FileInfo|null} currentFile - Currently processing file
 * @property {string} currentDestination - Current destination being processed
 * @property {number} bytesProcessed - Total bytes processed
 * @property {number} totalBytes - Total bytes to process
 * @property {Array<string>} errors - Array of error messages
 */

/**
 * Destination processing result
 * @typedef {Object} DestinationResult
 * @property {boolean} success - Whether the operation was successful
 * @property {string} destinationPath - Final destination path
 * @property {string} error - Error message (if failed)
 * @property {Object} metadata - Additional metadata
 */

/**
 * Import job status
 * @enum {string}
 */
export const ImportJobStatus = {
    PENDING: 'pending',
    SCANNING: 'scanning',
    COPYING: 'copying',
    UPLOADING: 'uploading',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
};

/**
 * Destination types
 * @enum {string}
 */
export const DestinationType = {
    LOCAL: 'local',
    BACKUP: 'backup',
    ZENTRANSFER: 'zentransfer'
};

/**
 * File types
 * @enum {string}
 */
export const FileType = {
    IMAGE: 'image',
    VIDEO: 'video',
    OTHER: 'other'
};

/**
 * Supported file extensions by type
 */
export const SupportedExtensions = {
    [FileType.IMAGE]: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.raw', '.cr2', '.nef', '.arw', '.dng'],
    [FileType.VIDEO]: ['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v'],
    [FileType.OTHER]: []
};

/**
 * Get all supported extensions
 * @returns {Array<string>} Array of supported file extensions
 */
export function getAllSupportedExtensions() {
    return [
        ...SupportedExtensions[FileType.IMAGE],
        ...SupportedExtensions[FileType.VIDEO]
    ];
}

/**
 * Get file type from extension
 * @param {string} extension - File extension (with dot)
 * @returns {string} File type
 */
export function getFileType(extension) {
    const ext = extension.toLowerCase();
    
    if (SupportedExtensions[FileType.IMAGE].includes(ext)) {
        return FileType.IMAGE;
    }
    
    if (SupportedExtensions[FileType.VIDEO].includes(ext)) {
        return FileType.VIDEO;
    }
    
    return FileType.OTHER;
} 