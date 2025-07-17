/**
 * SQLite Download Queue
 * Manages persistent download queue with retry logic and exponential backoff
 */

const { app } = require('electron');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class DownloadQueue {
    constructor() {
        this.db = null;
        this.databasePath = null;
        this.isInitialized = false;
        this.statusValues = [ 'pending', 'processing', 'retry', 'completed', 'failed' ];

        // we need access to the configuration
        this.config = app.configurationManager.get('downloadSettings.downloadQueue');
        
        // Prepared statements for performance
        this.statements = {};
    }

    initialize() {
        if (this.isInitialized) return;
        
        try {
            // Get the database path from the configuration manager
            this.databasePath = path.join(app.configurationManager.getConfigDirectory(), 'download-queue.db');
            
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
            console.log(`Download queue database initialized: ${this.databasePath}`);
            
        } catch (error) {
            console.error('Failed to initialize download queue database:', error);
            throw error;
        }
    }
    
    /**
     * Create database tables
     */
    createTables() {
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS download_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_id TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                thumbnail_url TEXT,
                file_size INTEGER,
                created_at DATETIME NOT NULL,
                status TEXT NOT NULL,
                retry_count INTEGER DEFAULT 0,
                last_retry_at DATETIME,
                next_retry_at DATETIME,
                error_message TEXT,
                file_path TEXT
            );
        `;
        
        const createIndexesSQL = [
            'CREATE INDEX IF NOT EXISTS idx_status ON download_queue(status);',
            'CREATE INDEX IF NOT EXISTS idx_next_retry ON download_queue(next_retry_at);',
            'CREATE INDEX IF NOT EXISTS idx_file_id ON download_queue(file_id);',
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
                INSERT OR REPLACE INTO download_queue 
                (file_id, name, url, thumbnail_url, file_size, created_at, status)
                VALUES (?, ?, ?, ?, ?, ?, 'pending')
            `),
            
            getPendingFiles: this.db.prepare(`
                SELECT * FROM download_queue 
                WHERE status = 'pending' 
                ORDER BY created_at ASC
            `),
            
            getRetryableFiles: this.db.prepare(`
                SELECT * FROM download_queue 
                WHERE status = 'retry' 
                AND (next_retry_at IS NULL OR next_retry_at <= datetime('now'))
                ORDER BY next_retry_at ASC, created_at ASC
            `),

            updateFileProcessing: this.db.prepare(`
                UPDATE download_queue 
                SET status = 'processing'
                WHERE file_id = ?
            `),
            
            updateFileRetry: this.db.prepare(`
                UPDATE download_queue 
                SET status = 'retry', retry_count = retry_count + 1, last_retry_at = datetime('now'), next_retry_at = ?, error_message = ?
                WHERE file_id = ?
            `),
            
            updateFileFailure: this.db.prepare(`
                UPDATE download_queue 
                SET status = 'failed', 
                    error_message = ?, 
                    retry_count = retry_count + 1, 
                    last_retry_at = datetime('now'), 
                    next_retry_at = NULL
                WHERE file_id = ?
            `),
            
            updateFileCompleted: this.db.prepare(`
                UPDATE download_queue 
                SET status = 'completed', file_path = ?
                WHERE file_id = ?
            `),

            getMaxCreatedAt: this.db.prepare(`
                SELECT MAX(created_at) as created_at FROM download_queue
            `),
            
            getQueueStats: this.db.prepare(`
                SELECT 
                    status,
                    COUNT(*) as count
                FROM download_queue 
                GROUP BY status
            `),
            
            getIncompleteFiles: this.db.prepare(`
                SELECT * FROM download_queue 
                WHERE status IN ('pending', 'processing', 'retry')
                ORDER BY created_at ASC
            `),

            resetAllPending: this.db.prepare(`
                UPDATE download_queue 
                SET status = 'pending', retry_count = 0, last_retry_at = NULL, next_retry_at = NULL, error_message = NULL
                WHERE status in ('processing', 'retry')
            `),
            
            deleteFile: this.db.prepare(`
                DELETE FROM download_queue WHERE file_id = ?
            `),
            
            clearCompleted: this.db.prepare(`
                DELETE FROM download_queue WHERE status = 'completed'
            `),

            clearAll: this.db.prepare(`
                DELETE FROM download_queue
            `)
        };
    }
    
    /**
     * Convenience functions for our clients
     */

    addFiles(files) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        // query: file_id, name, url, thumbnail_url, file_size, created_at
        
        const transaction = this.db.transaction((files) => {
            const results = [];
            for (const file of files) {
                this.statements.addFile.run(
                    file.id,
                    file.name,
                    file.url,
                    file.thumbnail_url,
                    file.size,
                    file.created
                );
                results.push({ file_id: file.id, added: true });
            }
            
            return results;
        });
        
        return transaction(files);
    }
    
    getPendingFiles() {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        return this.statements.getPendingFiles.all();
    }
    
    markFileAsProcessing(fileId) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        return this.statements.updateFileProcessing.run(fileId);
    }
    
    markFileAsCompleted(fileId, filePath) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        return this.statements.updateFileCompleted.run(filePath, fileId);
    }

    markFileForRetry(fileId, nextRetryAt, errorMessage) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        return this.statements.updateFileRetry.run(nextRetryAt, errorMessage, fileId);
    }
    
    markFileAsFailed(fileId, errorMessage) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        return this.statements.updateFileFailure.run(errorMessage, fileId);
    }
    
    getFile(fileId) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        return this.db.prepare('SELECT * FROM download_queue WHERE file_id = ?').get(fileId);
    }
    
    removeFile(fileId) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        return this.statements.deleteFile.run(fileId);
    }

    getMaxCreatedAt() {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        const ret = this.statements.getMaxCreatedAt.get();
        if (ret['created_at']) {
            return new Date(ret['created_at']);
        }
        return new Date('2025-01-01T00:00:00.000Z');
    }

    resetAllPending() {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        return this.statements.resetAllPending.run();
    }
    
    clearCompleted() {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        return this.statements.clearCompleted.run();
    }
    
    clearAll() {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        // remove everything from the queue
        console.log('Clearing everything from the download queue');
        this.statements.clearAll.run();
        // do spring cleaning
        console.log('Compacting the download queue database');
        this.db.pragma('wal_checkpoint(TRUNCATE)');
        this.db.exec('VACUUM');
    }
    
    getStats() {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        const stats = this.statements.getQueueStats.all();
        const result = {
            pending: 0,
            downloading: 0,
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
    
    close() {
        if (this.db) {
            console.log("Truncating the download queue database");
            this.db.pragma('wal_checkpoint(TRUNCATE)');

            console.log("Closing the download queue database");
            this.db.close();
            this.db = null;
            this.isInitialized = false;
        }
    }
}

module.exports = { DownloadQueue }; 