/**
 * Get folder name for file organization based on import settings
 */
function getFolderName(file, importSettings) {
    if (!importSettings || !importSettings.organizeIntoFolders) {
        return ''; // No folder organization
    }
    
    const { folderOrganizationType, customFolderName, dateFormat } = importSettings;
    
    if (folderOrganizationType === 'custom') {
        return customFolderName || 'Imported Files';
    } else {
        // Use file creation/modification date or current date
        const fileStats = require('fs').statSync(file.path);
        const date = fileStats.birthtime || fileStats.mtime || new Date();
        return formatDateForFolder(date, dateFormat);
    }
}

/**
 * Format date according to the selected format
 */
function formatDateForFolder(date, format) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 
                       'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthName = monthNames[date.getMonth()];

    switch (format) {
        case '2025/05/26': return `${year}/${month}/${day}`;
        case '2025-05-26': return `${year}-${month}-${day}`;
        case '2025/2025-05-26': return `${year}/${year}-${month}-${day}`;
        case '2025/may 26': return `${year}/${monthName} ${day}`;
        case '2025/05': return `${year}/${month}`;
        case '2025/may': return `${year}/${monthName}`;
        case '2025/may/26': return `${year}/${monthName}/${day}`;
        case '2025/2025-05/2025-05-26': return `${year}/${year}-${month}/${year}-${month}-${day}`;
        case '2025 may 26': return `${year} ${monthName} ${day}`;
        case '20250526': return `${year}${month}${day}`;
        default: return `${year}/${month}/${day}`;
    }
}

/**
 * Generate remote name with folder organization
 */
function generateRemoteName(fileName, importSettings) {
    // Get folder name based on import settings
    const folderName = getFolderName({ path: fileName }, importSettings);
    
    if (folderName) {
        // Use forward slashes for cloud storage paths (works for S3, Azure, GCP)
        return `${folderName}/${fileName}`.replace(/\\/g, '/');
    } else {
        return fileName;
    }
}

module.exports = { getFolderName, formatDateForFolder, generateRemoteName };