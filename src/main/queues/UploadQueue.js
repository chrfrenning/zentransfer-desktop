/**
 * SQLite Upload Queue
 * Manages persistent upload queue with retry logic and global exponential backoff
 */

const { app } = require('electron');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/Logger.js');

class UploadQueue {
    constructor() {
        this.db = null;
        this.databasePath = path.join(app.configurationManager.getConfigDirectory(), 'upload-queue.db');
        this.isInitialized = false;
        
        // Prepared statements for performance
        this.statements = {};

        this.initialize();
    }
    
    /**
     * Initialize the database and create tables
     */
    initialize() {
        if (this.isInitialized) return;
        
        try {
            // Open database
            this.db = new Database(this.databasePath);
            
            // Enable WAL mode for better performance
            this.db.pragma('journal_mode = WAL');
            this.db.pragma('synchronous = NORMAL');
            this.db.pragma('cache_size = 1000');
            this.db.pragma('temp_store = memory');
            
            // Create tables
            this.createTables();
            
            // Prepare statements
            this.prepareStatements();
            
            this.isInitialized = true;
            logger.info(`Upload queue database initialized: ${this.databasePath}`);
            
        } catch (error) {
            console.error('Failed to initialize upload queue database:', error);
            throw error;
        }
    }
    
    /**
     * Create database tables
     */
    createTables() {
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS upload_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT NOT NULL,
                filename TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                mime_type TEXT,
                service_type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'queued',
                retry_count INTEGER DEFAULT 0,
                date_added TEXT NOT NULL,
                last_retry_at TEXT,
                error_message TEXT,
                final_url TEXT,
                import_settings TEXT
            );
        `;
        
        const createIndexesSQL = [
            'CREATE INDEX IF NOT EXISTS idx_status ON upload_queue(status);',
            'CREATE INDEX IF NOT EXISTS idx_filename ON upload_queue(filename);',
            'CREATE INDEX IF NOT EXISTS idx_service_type ON upload_queue(service_type);',
            'CREATE INDEX IF NOT EXISTS idx_date_added ON upload_queue(date_added);'
        ];
        
        this.db.exec(createTableSQL);
        createIndexesSQL.forEach(sql => this.db.exec(sql));
    }
    
    /**
     * Prepare frequently used statements
     */
    prepareStatements() {
        this.statements = {
            addFile: this.db.prepare(`
                INSERT INTO upload_queue 
                (file_path, filename, file_size, mime_type, service_type, date_added, import_settings)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `),
            
            getQueuedFiles: this.db.prepare(`
                SELECT * FROM upload_queue 
                WHERE status = 'queued' 
                ORDER BY date_added ASC
            `),
            
            getFailedFiles: this.db.prepare(`
                SELECT * FROM upload_queue 
                WHERE status = 'failed' 
                ORDER BY date_added ASC
            `),
            
            updateFileStatus: this.db.prepare(`
                UPDATE upload_queue 
                SET status = ?
                WHERE id = ?
            `),
            
            updateUploadSuccess: this.db.prepare(`
                UPDATE upload_queue 
                SET status = 'completed', final_url = ?
                WHERE id = ?
            `),
            
            updateUploadFailure: this.db.prepare(`
                UPDATE upload_queue 
                SET status = 'failed', error_message = ?, retry_count = retry_count + 1, 
                    last_retry_at = datetime('now')
                WHERE id = ?
            `),
            
            getFileById: this.db.prepare(`
                SELECT * FROM upload_queue WHERE id = ?
            `),
            
            getQueueStats: this.db.prepare(`
                SELECT 
                    status,
                    COUNT(*) as count
                FROM upload_queue 
                GROUP BY status
            `),
            
            getIncompleteFiles: this.db.prepare(`
                SELECT * FROM upload_queue 
                WHERE status IN ('queued', 'processing', 'failed')
                AND (status != 'failed' OR retry_count < ?)
                ORDER BY date_added ASC
            `),
            
            deleteFile: this.db.prepare(`
                DELETE FROM upload_queue WHERE id = ?
            `),
            
            clearCompleted: this.db.prepare(`
                DELETE FROM upload_queue WHERE status = 'completed'
            `),
            
            resetProcessingFiles: this.db.prepare(`
                UPDATE upload_queue 
                SET status = 'queued'
                WHERE status = 'processing'
            `)
        };
    }
    
    /**
     * Add files to the queue
     */
    addFiles(files) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        const transaction = this.db.transaction((files) => {
            const results = [];
            for (const file of files) {
                try {
                    const result = this.statements.addFile.run(
                        file.filePath,
                        file.filename,
                        file.fileSize,
                        file.mimeType,
                        file.serviceType,
                        file.dateAdded,
                        file.importSettings || null
                    );
                    results.push({ id: result.lastInsertRowid, added: true });
                } catch (error) {
                    console.error(`Failed to add file ${file.filename} to queue:`, error);
                    results.push({ filename: file.filename, added: false, reason: 'error', error: error.message });
                }
            }
            return results;
        });
        
        return transaction(files);
    }
    
    /**
     * Get files ready for upload (only queued files)
     */
    getReadyFiles(limit = null) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        const queuedFiles = this.statements.getQueuedFiles.all();
        
        if (limit && limit > 0) {
            return queuedFiles.slice(0, limit);
        }
        
        return queuedFiles;
    }
    
    /**
     * Mark file as processing
     */
    startUpload(fileId) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        return this.statements.updateFileStatus.run('processing', fileId);
    }
    
    /**
     * Mark upload as completed
     */
    completeUpload(fileId, finalUrl) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        return this.statements.updateUploadSuccess.run(finalUrl, fileId);
    }
    
    /**
     * Mark upload as failed with retry logic
     */
    failUpload(fileId, errorMessage) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        return this.statements.updateUploadFailure.run(errorMessage, fileId);
    }
    
    /**
     * Get file by ID
     */
    getFileById(fileId) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        return this.statements.getFileById.get(fileId);
    }
    
    /**
     * Get queue statistics
     */
    getStats() {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        const stats = this.statements.getQueueStats.all();
        const result = {
            queued: 0,
            processing: 0,
            completed: 0,
            failed: 0,
            total: 0
        };
        
        stats.forEach(stat => {
            result[stat.status] = stat.count;
            result.total += stat.count;
        });
        
        return result;
    }
    
    /**
     * Get all incomplete files (for app restart recovery)
     */
    getIncompleteFiles(maxUploadRetries) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        return this.statements.getIncompleteFiles.all(maxUploadRetries);
    }
    
    /**
     * Clean up completed uploads
     */
    clearCompleted() {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        return this.statements.clearCompleted.run();
    }
    
    /**
     * Clear all entries from the upload queue
     */
    clearAll() {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        logger.info('UploadQueue.clearAll() called');
        const result = this.db.prepare('DELETE FROM upload_queue').run();
        logger.info('UploadQueue.clearAll() result:', result);
        
        // Verify the deletion worked
        const count = this.db.prepare('SELECT COUNT(*) as count FROM upload_queue').get();
        logger.info('Rows remaining after clearAll():', count.count);
        
        return result;
    }
    
    /**
     * Remove file from queue
     */
    removeFile(fileId) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        return this.statements.deleteFile.run(fileId);
    }
    
    /**
     * Reset processing files to queued (for app restart)
     */
    resetProcessingFiles() {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        return this.statements.resetProcessingFiles.run();
    }
    
    /**
     * Get all failed files (for external retry logic)
     */
    getFailedFiles() {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        return this.statements.getFailedFiles.all();
    }
    
    /**
     * Reset a specific file from failed to queued status (for external retry logic)
     */
    retryFile(fileId) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        return this.db.prepare(`
            UPDATE upload_queue 
            SET status = 'queued', error_message = NULL
            WHERE id = ?
        `).run(fileId);
    }
    
    /**
     * Close database connection
     */
    close() {
        if (this.db) {

            console.log("Compacting the upload queue database");
            this.db.pragma('wal_checkpoint(TRUNCATE)');
            this.db.exec('VACUUM');
            
            console.log("Closing the upload queue database");
            this.db.close();

            this.db = null;
            this.isInitialized = false;
        }
    }
    
    /**
     * Get database path
     */
    getDatabasePath() {
        return this.databasePath;
    }
}

module.exports = { UploadQueue }; 