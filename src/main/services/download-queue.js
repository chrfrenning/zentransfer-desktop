/**
 * SQLite Download Queue
 * Manages persistent download queue with retry logic and exponential backoff
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { getConfig } = require('../app/main-config-setup.js');

class DownloadQueue {
    constructor() {
        this.databasePath = null;  // Will be set in initialize()
        this.db = null;
        this.isInitialized = false;
        
        // Prepared statements for performance
        this.statements = {};
        
        // Default configuration (can be overridden by config)
        this.config = {
            maxRetries: 5,
            initialRetryDelay: 1000,        // 1 second
            maxRetryDelay: 300000,          // 5 minutes
            retryBackoffMultiplier: 2.0,
            maxConcurrentDownloads: 3,
            retryOn404: false
        };
        
        this.loadConfiguration();
    }
    
    /**
     * Load configuration from config system
     */
    loadConfiguration() {
        try {
            const downloadSettings = getConfig('downloadSettings');
            if (downloadSettings && downloadSettings.downloadQueue) {
                this.config = { ...this.config, ...downloadSettings.downloadQueue };
            }
        } catch (error) {
            console.warn('Failed to load download queue configuration, using defaults:', error);
        }
    }
    
    /**
     * Initialize the database and create tables
     */
    initialize(configManager) {
        if (this.isInitialized) return;
        
        try {
            // Use provided path or generate one based on server hostname
            if (!this.databasePath) {
                const hostname = configManager.getHostname();
                const serverConfigPath = path.join(configManager.userDataPath, 'Configuration', hostname);
                this.databasePath = path.join(serverConfigPath, 'download-queue.db');
            }
            
            // Ensure directory exists
            const dbDir = path.dirname(this.databasePath);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }
            
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
                created_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                retry_count INTEGER DEFAULT 0,
                max_retries INTEGER DEFAULT ${this.config.maxRetries},
                last_retry_at TEXT,
                next_retry_at TEXT,
                error_message TEXT,
                file_path TEXT,
                download_started_at TEXT,
                download_completed_at TEXT,
                added_to_queue_at TEXT DEFAULT CURRENT_TIMESTAMP,
                job_id INTEGER
            );
        `;
        
        const createIndexesSQL = [
            'CREATE INDEX IF NOT EXISTS idx_status ON download_queue(status);',
            'CREATE INDEX IF NOT EXISTS idx_next_retry ON download_queue(next_retry_at);',
            'CREATE INDEX IF NOT EXISTS idx_file_id ON download_queue(file_id);',
            'CREATE INDEX IF NOT EXISTS idx_job_id ON download_queue(job_id);'
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
                (file_id, name, url, thumbnail_url, file_size, created_at, status, max_retries)
                VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
            `),
            
            getPendingFiles: this.db.prepare(`
                SELECT * FROM download_queue 
                WHERE status = 'pending' 
                ORDER BY added_to_queue_at ASC
            `),
            
            getRetryableFiles: this.db.prepare(`
                SELECT * FROM download_queue 
                WHERE status = 'failed' 
                AND retry_count < max_retries 
                AND (next_retry_at IS NULL OR next_retry_at <= datetime('now'))
                AND (error_message NOT LIKE '%404%' OR max_retries > 0)
                ORDER BY next_retry_at ASC, added_to_queue_at ASC
            `),
            
            updateFileStatus: this.db.prepare(`
                UPDATE download_queue 
                SET status = ?, job_id = ?, download_started_at = CASE WHEN ? = 'downloading' THEN datetime('now') ELSE download_started_at END
                WHERE file_id = ?
            `),
            
            updateDownloadProgress: this.db.prepare(`
                UPDATE download_queue 
                SET file_path = ?, file_size = ?, download_completed_at = datetime('now'), status = 'completed'
                WHERE file_id = ?
            `),
            
            updateDownloadFailure: this.db.prepare(`
                UPDATE download_queue 
                SET status = 'failed', error_message = ?, retry_count = retry_count + 1, 
                    last_retry_at = datetime('now'), next_retry_at = ?
                WHERE file_id = ?
            `),
            
            getFileByJobId: this.db.prepare(`
                SELECT * FROM download_queue WHERE job_id = ?
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
                WHERE status IN ('pending', 'downloading', 'failed')
                AND (status != 'failed' OR retry_count < max_retries)
                ORDER BY added_to_queue_at ASC
            `),
            
            deleteFile: this.db.prepare(`
                DELETE FROM download_queue WHERE file_id = ?
            `),
            
            clearCompleted: this.db.prepare(`
                DELETE FROM download_queue WHERE status = 'completed'
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
                    this.statements.addFile.run(
                        file.id,
                        file.name,
                        file.url || file.downloadUrl,
                        file.thumbnail_url,
                        file.size || 0,
                        file.created,
                        this.config.maxRetries
                    );
                    results.push({ file_id: file.id, added: true });
                } catch (error) {
                    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                        // File already exists in queue
                        results.push({ file_id: file.id, added: false, reason: 'already_exists' });
                    } else {
                        console.error(`Failed to add file ${file.id} to queue:`, error);
                        results.push({ file_id: file.id, added: false, reason: 'error', error: error.message });
                    }
                }
            }
            return results;
        });
        
        return transaction(files);
    }
    
    /**
     * Get files ready for download (pending + retryable failed files)
     */
    getReadyFiles(limit = null) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        const pendingFiles = this.statements.getPendingFiles.all();
        const retryableFiles = this.statements.getRetryableFiles.all();
        
        const allReadyFiles = [...pendingFiles, ...retryableFiles];
        
        if (limit && limit > 0) {
            return allReadyFiles.slice(0, limit);
        }
        
        return allReadyFiles;
    }
    
    /**
     * Mark file as downloading and assign job ID
     */
    startDownload(fileId, jobId) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        return this.statements.updateFileStatus.run('downloading', jobId, 'downloading', fileId);
    }
    
    /**
     * Mark download as completed
     */
    completeDownload(fileId, filePath, fileSize) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        return this.statements.updateDownloadProgress.run(filePath, fileSize, fileId);
    }
    
    /**
     * Mark download as failed with retry logic
     */
    failDownload(fileId, errorMessage) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        const file = this.getFileById(fileId);
        if (!file) return;
        
        // Check if this is a 404 error and we shouldn't retry
        const is404 = errorMessage && (errorMessage.includes('404') || errorMessage.includes('Not Found'));
        if (is404 && !this.config.retryOn404) {
            // Mark as permanently failed
            return this.statements.updateDownloadFailure.run(errorMessage, null, fileId);
        }
        
        // Calculate next retry time with exponential backoff
        const retryCount = file.retry_count + 1;
        const delay = Math.min(
            this.config.initialRetryDelay * Math.pow(this.config.retryBackoffMultiplier, retryCount - 1),
            this.config.maxRetryDelay
        );
        
        const nextRetryAt = new Date(Date.now() + delay).toISOString();
        
        return this.statements.updateDownloadFailure.run(errorMessage, nextRetryAt, fileId);
    }
    
    /**
     * Get file by ID
     */
    getFileById(fileId) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        return this.db.prepare('SELECT * FROM download_queue WHERE file_id = ?').get(fileId);
    }
    
    /**
     * Get file by job ID
     */
    getFileByJobId(jobId) {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        return this.statements.getFileByJobId.get(jobId);
    }
    
    /**
     * Get queue statistics
     */
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
    
    /**
     * Get all incomplete files (for app restart recovery)
     */
    getIncompleteFiles() {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        return this.statements.getIncompleteFiles.all();
    }
    
    /**
     * Clean up completed downloads
     */
    clearCompleted() {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        return this.statements.clearCompleted.run();
    }
    
    /**
     * Clear all entries from the download queue
     */
    clearAll() {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        console.log('DownloadQueue.clearAll() called');
        const result = this.db.prepare('DELETE FROM download_queue').run();
        console.log('DownloadQueue.clearAll() result:', result);
        
        // Verify the deletion worked
        const count = this.db.prepare('SELECT COUNT(*) as count FROM download_queue').get();
        console.log('Rows remaining after clearAll():', count.count);
        
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
     * Reset downloading files to pending (for app restart)
     */
    resetDownloadingFiles() {
        if (!this.isInitialized) throw new Error('Queue manager not initialized');
        
        return this.db.prepare(`
            UPDATE download_queue 
            SET status = 'pending', job_id = NULL, download_started_at = NULL
            WHERE status = 'downloading'
        `).run();
    }
    
    /**
     * Close database connection
     */
    close() {
        if (this.db) {
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

module.exports = { DownloadQueue }; 