/**
 * ZenTransfer Database
 * 
 * Runtime master object
 * 
 */

const { app } = require('electron');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/Logger.js');

class ZTDatabase {
    constructor() {

        // Open database
        logger.info(`Opening ZenTransfer database from ${app.configurationManager.getConfigDirectory()}`);
        this.databasePath = path.join(app.configurationManager.getConfigDirectory(), 'zentransfer.db');
        this.db = new Database(this.databasePath);
        this.initialize();

    }
    
    /**
     * Initialize the database
     */
    initialize() {
        if (this.isInitialized) return;
        
        try {
            // Enable WAL mode for better performance
            this.db.pragma('journal_mode = WAL');
            this.db.pragma('synchronous = NORMAL');
            this.db.pragma('cache_size = 1000');
            this.db.pragma('temp_store = memory');
            
            this.isInitialized = true;
            logger.info(`ZenTransfer database initialized: ${this.databasePath}`);
            
        } catch (error) {
            console.error('Failed to initialize ZenTransfer database:', error);
            throw error;
        }
    }

    /**
     * Compact the database
     */

    compact() {
        logger.info(`Compacting ZenTransfer database`);
        this.db.pragma('wal_checkpoint(TRUNCATE)');
        this.db.exec('VACUUM');
        logger.info(`ZenTransfer database compacted`);
    }

    /**
     * Close the database
     */

    close(quick=false) {

        if (!quick) {
            this.compact();
        }

        logger.info(`Closing ZenTransfer database`);
        this.db.close();
        logger.info(`ZenTransfer database closed`);
    }
}

module.exports = { ZTDatabase };