/**
 * SQLite Upload Queue
 * Manages persistent upload queue with retry logic and global exponential backoff
 */

const { app } = require('electron');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/Logger.js');

/* DATABASE SCHEMA


    0	id	                INTEGER	    0		  1	Unique identifier for the file
    1	file_path	        TEXT	    1		  0
    2	filename	        TEXT	    1		  0
    3	file_size	        INTEGER	    1		  0
    4	mime_type	        TEXT	    0		  0
    5	service_type	    TEXT	    1		  0
    6	status	            TEXT	    1	      'queued'	0
    7	retry_count	        INTEGER	    0	      0	0
    8	date_added	        TEXT	    1		  0
    9	last_retry_at	    TEXT	    0		  0
    10	error_message	    TEXT	    0		  0
    11	final_url	        TEXT	    0		  0
    12	import_settings	    TEXT	    0		  0

*/

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
     * 
     * status: queued, processing, retry, completed, failed
     * 
     * Not quite sure how to empty the info_cache, but one way may be to
     * delete all rows when the queue length is 0
     * 
     */
    createTables() {
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS upload_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_path TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                file_date DATETIME NOT NULL,
                mime_type TEXT,
                service_type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'queued',
                retry_count INTEGER DEFAULT 0,
                date_added DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                last_retry_at DATETIME DEFAULT NULL,
                error_message TEXT DEFAULT NULL,
                final_url TEXT DEFAULT NULL
            );

            CREATE TABLE IF NOT EXISTS info_cache (
                source_path TEXT PRIMARY KEY,
                checksum_md5 TEXT,
                checksum_sha256 TEXT,
                checksum_sha512 TEXT,
                tiny_thumb BLOB,
                thumbnail BLOB,
                preview BLOB,
                exif TEXT
            );
        `;
        
        const createIndexesSQL = [
            'CREATE INDEX IF NOT EXISTS idx_uq_status ON upload_queue(status);',
            'CREATE INDEX IF NOT EXISTS idx_uq_source_path ON upload_queue(source_path);',
            'CREATE INDEX IF NOT EXISTS idx_ic_source_path ON info_cache(source_path);',
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
                INSERT INTO upload_queue (
                    source_path,
                    file_name,
                    file_size,
                    file_date,
                    mime_type,
                    service_type
                )
                VALUES (?, ?, ?, ?, ?, ?)
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

            getAllFiles: this.db.prepare(`
                SELECT * FROM upload_queue
                ORDER BY date_added DESC
                LIMIT 5000
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
            
            updateUploadRetry: this.db.prepare(`
                UPDATE upload_queue 
                SET status = 'retry', error_message = ?, retry_count = retry_count + 1, last_retry_at = datetime('now')
                WHERE id = ?
            `),
            
            updateUploadFailure: this.db.prepare(`
                UPDATE upload_queue 
                SET status = 'failed', error_message = ?, retry_count = retry_count + 1, last_retry_at = datetime('now')
                WHERE id = ?
            `),
            
            getFileById: this.db.prepare(`
                SELECT * FROM upload_queue WHERE id = ?
            `),

            countFileInQueue: this.db.prepare(`
                SELECT COUNT(*) as count FROM upload_queue WHERE source_path = ? and status in ('queued', 'retry')
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
                WHERE status IN ('queued', 'processing', 'retry')
                ORDER BY date_added ASC
            `),
            
            deleteFile: this.db.prepare(`
                DELETE FROM upload_queue WHERE id = ?
            `),

            cancelJob: this.db.prepare(`
                UPDATE upload_queue SET status = 'cancelled' WHERE id = ?
            `),

            cancelAll: this.db.prepare(`
                UPDATE upload_queue SET status = 'cancelled' WHERE status IN ('queued', 'retry')
            `),
            
            clearCompleted: this.db.prepare(`
                DELETE FROM upload_queue WHERE status = 'completed'
            `),

            clearFailed: this.db.prepare(`
                DELETE FROM upload_queue WHERE status = 'failed'
            `),

            clearAll: this.db.prepare(`
                DELETE FROM upload_queue
            `),
            
            resetProcessingFiles: this.db.prepare(`
                UPDATE upload_queue 
                SET status = 'queued'
                WHERE status = 'processing'
            `),

            /* Info cache */

            addToCache: this.db.prepare(`
                INSERT INTO info_cache (
                    source_path,
                    checksum_md5,
                    checksum_sha256,
                    checksum_sha512,
                    tiny_thumb,
                    thumbnail,
                    preview,
                    exif
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `),

            getFromCache: this.db.prepare(`
                SELECT * FROM info_cache WHERE source_path = ?
            `)
        };
    }
    


    /* Add files to the queue - this is time sensitive, we will get many files at the same time */

    addFiles(files) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        const transaction = this.db.transaction((files) => {
            const results = [];

            for (const file of files) {
                try {
                    /*
                        source_path,
                        file_name,
                        file_size,
                        file_date,
                        mime_type,
                        service_type
                    */
                    console.log("Adding file to queue:", file);

                    const result = this.statements.addFile.run(
                        file.source_path,
                        file.file_name,
                        file.file_size,
                        file.file_date.toISOString(),
                        file.mime_type,
                        file.service_type
                    );

                    results.push(result.lastInsertRowid);

                } catch (error) {
                    console.error(`Failed to add file ${file.source_path} to queue:`, error);
                }
            }
            return results;
        });
        
        return transaction(files);
    }
    

    
    /* Manage a specific file in the queue*/
    
    startUpload(fileId) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        return this.statements.updateFileStatus.run('processing', fileId);
    }
    
    completeUpload(fileId, finalUrl) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        return this.statements.updateUploadSuccess.run(finalUrl, fileId);
    }
    
    retryUpload(fileId) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        return this.statements.updateUploadRetry.run(fileId);
    }
    
    failUpload(fileId, errorMessage) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        return this.statements.updateUploadFailure.run(errorMessage, fileId);
    }

    cancelUpload(fileId) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        return this.statements.cancelJob.run(fileId);
    }



    /* Managing specific files */

    getFileById(fileId) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        return this.statements.getFileById.get(fileId);
    }
    
    removeFile(fileId) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        return this.statements.deleteFile.run(fileId);
    }



    /* Managing the queue / dataset */
    
    getQueuedFiles() {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        const queuedFiles = this.statements.getQueuedFiles.all();
        return queuedFiles;
    }

    getFailedFiles() {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        return this.statements.getFailedFiles.all();
    }

    getAllFiles() {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        return this.statements.getAllFiles.all();
    }
    
    resetProcessingFiles() {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        return this.statements.resetProcessingFiles.run();
    }

    clearCompleted() {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        return this.statements.clearCompleted.run();
    }

    clearFailed() {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        return this.statements.clearFailed.run();
    }

    clearAll() {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        return this.statements.clearAll.run();
    }



    /* Statistics */
    
    getStats() {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        const stats = this.statements.getQueueStats.all();
        const result = {
            queued: 0,
            processing: 0,
            retry: 0,
            completed: 0,
            failed: 0,
            cancelled: 0,
            total: 0
        };
        
        stats.forEach(stat => {
            result[stat.status] = stat.count;
            result.total += stat.count;
        });
        
        return result;
    }



    /* Cache */

    addToCache(source_path, checksumMD5, checksumSHA256, checksumSHA512, tiny_thumbnail, thumbnail, preview, exif) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        try {
            this.statements.addToCache.run(source_path, checksumMD5, checksumSHA256, checksumSHA512, tiny_thumbnail, thumbnail, preview, exif);
        } catch (error) {
            console.warn('Failed to add file to cache:', error);
        }
    }

    getFromCache(source_path) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        return this.statements.getFromCache.get(source_path);
    }

    flushCache() {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');

        this.db.prepare(`DELETE FROM info_cache;`).run();
        this.db.pragma('wal_checkpoint(TRUNCATE)');
        this.db.exec('VACUUM');
    }



    /* We're done, do housekeeping */

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
}

module.exports = { UploadQueue }; 