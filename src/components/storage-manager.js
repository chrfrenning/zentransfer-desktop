/**
 * Storage Manager
 * Handles localStorage operations for persisting app settings and state
 */

export class StorageManager {
    static KEYS = {
        DOWNLOAD_PATH: 'zentransfer_download_path',
        LAST_SYNC_TIME: 'zentransfer_last_sync_time',
        DOWNLOAD_QUEUE: 'zentransfer_download_queue',
        LAST_DOWNLOADED_FILE: 'zentransfer_last_downloaded_file',
        IMPORT_PATH: 'zentransfer_import_path',
        IMPORT_DESTINATION_PATH: 'zentransfer_import_destination_path',
        IMPORT_BACKUP_PATH: 'zentransfer_import_backup_path',
        IMPORT_BACKUP_ENABLED: 'zentransfer_import_backup_enabled',
        IMPORT_UPLOAD_ENABLED: 'zentransfer_import_upload_enabled',
        IMPORT_UPLOAD_TO_AWS_S3: 'zentransfer_import_upload_to_aws_s3',
        IMPORT_UPLOAD_TO_AZURE: 'zentransfer_import_upload_to_azure',
        IMPORT_UPLOAD_TO_GCP: 'zentransfer_import_upload_to_gcp',
        IMPORT_INCLUDE_SUBDIRECTORIES: 'zentransfer_import_include_subdirectories',
        IMPORT_ORGANIZE_INTO_FOLDERS: 'zentransfer_import_organize_into_folders',
        IMPORT_FOLDER_ORGANIZATION_TYPE: 'zentransfer_import_folder_organization_type',
        IMPORT_CUSTOM_FOLDER_NAME: 'zentransfer_import_custom_folder_name',
        IMPORT_DATE_FORMAT: 'zentransfer_import_date_format',
        IMPORT_SKIP_DUPLICATES: 'zentransfer_import_skip_duplicates'
    };

    /**
     * Get download path from storage
     * @returns {string|null} Download path or null if not set
     */
    static getDownloadPath() {
        return localStorage.getItem(this.KEYS.DOWNLOAD_PATH);
    }

    /**
     * Set download path in storage
     * @param {string} path - Download path
     */
    static setDownloadPath(path) {
        localStorage.setItem(this.KEYS.DOWNLOAD_PATH, path);
    }

    /**
     * Get last sync time from storage
     * @returns {string} ISO format datetime, defaults to 2025-01-01T00:00:00.000Z
     */
    static getLastSyncTime() {
        const stored = localStorage.getItem(this.KEYS.LAST_SYNC_TIME);
        return stored || '2025-01-01T00:00:00.000Z';
    }

    /**
     * Set last sync time in storage
     * @param {string} isoDateTime - ISO format datetime
     */
    static setLastSyncTime(isoDateTime) {
        localStorage.setItem(this.KEYS.LAST_SYNC_TIME, isoDateTime);
    }

    /**
     * Get download queue from storage
     * @returns {Array} Array of queued download items
     */
    static getDownloadQueue() {
        const stored = localStorage.getItem(this.KEYS.DOWNLOAD_QUEUE);
        return stored ? JSON.parse(stored) : [];
    }

    /**
     * Set download queue in storage
     * @param {Array} queue - Array of download items
     */
    static setDownloadQueue(queue) {
        localStorage.setItem(this.KEYS.DOWNLOAD_QUEUE, JSON.stringify(queue));
    }

    /**
     * Get last downloaded file info
     * @returns {Object|null} Last downloaded file info or null
     */
    static getLastDownloadedFile() {
        const stored = localStorage.getItem(this.KEYS.LAST_DOWNLOADED_FILE);
        return stored ? JSON.parse(stored) : null;
    }

    /**
     * Set last downloaded file info
     * @param {Object} fileInfo - File information with created property
     */
    static setLastDownloadedFile(fileInfo) {
        localStorage.setItem(this.KEYS.LAST_DOWNLOADED_FILE, JSON.stringify(fileInfo));
    }

    /**
     * Get import path from storage
     * @returns {string|null} Import path or null if not set
     */
    static getImportPath() {
        return localStorage.getItem(this.KEYS.IMPORT_PATH);
    }

    /**
     * Set import path in storage
     * @param {string} path - Import path
     */
    static setImportPath(path) {
        localStorage.setItem(this.KEYS.IMPORT_PATH, path);
    }

    /**
     * Get import destination path from storage
     * @returns {string|null} Import destination path or null if not set
     */
    static getImportDestinationPath() {
        return localStorage.getItem(this.KEYS.IMPORT_DESTINATION_PATH);
    }

    /**
     * Set import destination path in storage
     * @param {string} path - Import destination path
     */
    static setImportDestinationPath(path) {
        localStorage.setItem(this.KEYS.IMPORT_DESTINATION_PATH, path);
    }

    /**
     * Get import backup path from storage
     * @returns {string|null} Import backup path or null if not set
     */
    static getImportBackupPath() {
        return localStorage.getItem(this.KEYS.IMPORT_BACKUP_PATH);
    }

    /**
     * Set import backup path in storage
     * @param {string} path - Import backup path
     */
    static setImportBackupPath(path) {
        localStorage.setItem(this.KEYS.IMPORT_BACKUP_PATH, path);
    }

    /**
     * Get import backup enabled setting from storage
     * @returns {boolean} Whether backup is enabled
     */
    static getImportBackupEnabled() {
        const stored = localStorage.getItem(this.KEYS.IMPORT_BACKUP_ENABLED);
        return stored === 'true';
    }

    /**
     * Set import backup enabled setting in storage
     * @param {boolean} enabled - Whether backup is enabled
     */
    static setImportBackupEnabled(enabled) {
        localStorage.setItem(this.KEYS.IMPORT_BACKUP_ENABLED, enabled.toString());
    }

    /**
     * Get import upload enabled setting from storage
     * @returns {boolean} Whether upload to ZenTransfer is enabled
     */
    static getImportUploadEnabled() {
        const stored = localStorage.getItem(this.KEYS.IMPORT_UPLOAD_ENABLED);
        return stored === 'true';
    }

    /**
     * Set import upload enabled setting in storage
     * @param {boolean} enabled - Whether upload to ZenTransfer is enabled
     */
    static setImportUploadEnabled(enabled) {
        localStorage.setItem(this.KEYS.IMPORT_UPLOAD_ENABLED, enabled.toString());
    }

    /**
     * Get import upload to AWS S3 enabled setting from storage
     * @returns {boolean} Whether upload to AWS S3 is enabled
     */
    static getImportUploadToAwsS3() {
        const stored = localStorage.getItem(this.KEYS.IMPORT_UPLOAD_TO_AWS_S3);
        return stored === 'true';
    }

    /**
     * Set import upload to AWS S3 enabled setting in storage
     * @param {boolean} enabled - Whether upload to AWS S3 is enabled
     */
    static setImportUploadToAwsS3(enabled) {
        localStorage.setItem(this.KEYS.IMPORT_UPLOAD_TO_AWS_S3, enabled.toString());
    }

    /**
     * Get import upload to Azure enabled setting from storage
     * @returns {boolean} Whether upload to Azure is enabled
     */
    static getImportUploadToAzure() {
        const stored = localStorage.getItem(this.KEYS.IMPORT_UPLOAD_TO_AZURE);
        return stored === 'true';
    }

    /**
     * Set import upload to Azure enabled setting in storage
     * @param {boolean} enabled - Whether upload to Azure is enabled
     */
    static setImportUploadToAzure(enabled) {
        localStorage.setItem(this.KEYS.IMPORT_UPLOAD_TO_AZURE, enabled.toString());
    }

    /**
     * Get import upload to GCP enabled setting from storage
     * @returns {boolean} Whether upload to GCP is enabled
     */
    static getImportUploadToGcp() {
        const stored = localStorage.getItem(this.KEYS.IMPORT_UPLOAD_TO_GCP);
        return stored === 'true';
    }

    /**
     * Set import upload to GCP enabled setting in storage
     * @param {boolean} enabled - Whether upload to GCP is enabled
     */
    static setImportUploadToGcp(enabled) {
        localStorage.setItem(this.KEYS.IMPORT_UPLOAD_TO_GCP, enabled.toString());
    }

    /**
     * Get import include subdirectories setting from storage
     * @returns {boolean} Whether to include subdirectories
     */
    static getImportIncludeSubdirectories() {
        const stored = localStorage.getItem(this.KEYS.IMPORT_INCLUDE_SUBDIRECTORIES);
        return stored !== 'false'; // Default to true
    }

    /**
     * Set import include subdirectories setting in storage
     * @param {boolean} enabled - Whether to include subdirectories
     */
    static setImportIncludeSubdirectories(enabled) {
        localStorage.setItem(this.KEYS.IMPORT_INCLUDE_SUBDIRECTORIES, enabled.toString());
    }

    /**
     * Get import organize into folders setting from storage
     * @returns {boolean} Whether to organize into folders
     */
    static getImportOrganizeIntoFolders() {
        const stored = localStorage.getItem(this.KEYS.IMPORT_ORGANIZE_INTO_FOLDERS);
        return stored === 'true';
    }

    /**
     * Set import organize into folders setting in storage
     * @param {boolean} enabled - Whether to organize into folders
     */
    static setImportOrganizeIntoFolders(enabled) {
        localStorage.setItem(this.KEYS.IMPORT_ORGANIZE_INTO_FOLDERS, enabled.toString());
    }

    /**
     * Get import folder organization type from storage
     * @returns {string} Folder organization type ('custom' or 'date')
     */
    static getImportFolderOrganizationType() {
        const stored = localStorage.getItem(this.KEYS.IMPORT_FOLDER_ORGANIZATION_TYPE);
        return stored || 'custom';
    }

    /**
     * Set import folder organization type in storage
     * @param {string} type - Folder organization type ('custom' or 'date')
     */
    static setImportFolderOrganizationType(type) {
        localStorage.setItem(this.KEYS.IMPORT_FOLDER_ORGANIZATION_TYPE, type);
    }

    /**
     * Get import custom folder name from storage
     * @returns {string|null} Custom folder name or null if not set
     */
    static getImportCustomFolderName() {
        return localStorage.getItem(this.KEYS.IMPORT_CUSTOM_FOLDER_NAME);
    }

    /**
     * Set import custom folder name in storage
     * @param {string} name - Custom folder name
     */
    static setImportCustomFolderName(name) {
        localStorage.setItem(this.KEYS.IMPORT_CUSTOM_FOLDER_NAME, name);
    }

    /**
     * Get import date format from storage
     * @returns {string} Date format
     */
    static getImportDateFormat() {
        const stored = localStorage.getItem(this.KEYS.IMPORT_DATE_FORMAT);
        return stored || '2025-05-26';
    }

    /**
     * Set import date format in storage
     * @param {string} format - Date format
     */
    static setImportDateFormat(format) {
        localStorage.setItem(this.KEYS.IMPORT_DATE_FORMAT, format);
    }

    /**
     * Get import skip duplicates setting from storage
     * @returns {boolean} Whether to skip duplicates
     */
    static getImportSkipDuplicates() {
        const stored = localStorage.getItem(this.KEYS.IMPORT_SKIP_DUPLICATES);
        return stored !== 'false'; // Default to true
    }

    /**
     * Set import skip duplicates setting in storage
     * @param {boolean} enabled - Whether to skip duplicates
     */
    static setImportSkipDuplicates(enabled) {
        localStorage.setItem(this.KEYS.IMPORT_SKIP_DUPLICATES, enabled.toString());
    }

    /**
     * Clear all stored data
     */
    static clearAll() {
        Object.values(this.KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
    }
} 