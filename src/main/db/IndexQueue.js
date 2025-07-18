/**
 * SQLite Index Queue
 * 
 * Maintains a list of files that have been uploaded, and are now pending
 * to have their pointers appended to the cloud index.
 * 
 */

const { app } = require('electron');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/Logger.js');

class IndexQueue {
    constructor(ztDatabase) {
        this.db = ztDatabase;
        
        // Initialize and prepare the database
        this.createTables();
        
        this.statements = {};
        this.prepareStatements();
    }
    
    createTables() {
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS index_queue (
                seq_id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_id INTEGER NOT NULL,
            );
        `;
        
        const createIndexesSQL = [
            //'CREATE INDEX IF NOT EXISTS idx_status ON index_queue(status);',
        ];
        
        this.db.exec(createTableSQL);
        createIndexesSQL.forEach(sql => this.db.exec(sql));
    }
    
    prepareStatements() {
        this.statements = {
            addFile: this.db.prepare(`
                INSERT INTO index_queue 
                (file_id)
                VALUES (?)
            `),
            
            deleteByFileId: this.db.prepare(`
                DELETE FROM index_queue 
                WHERE file_id = ?
            `),

            deleteBySeqId: this.db.prepare(`
                DELETE FROM index_queue 
                WHERE seq_id = ?
            `),
            
            getQueue: this.db.prepare(`
                SELECT seq_id, file_id FROM index_queue
                ORDER BY seq_id ASC
            `),

            clearQueue: this.db.prepare(`
                DELETE FROM index_queue
            `),
        };
    }

    add(fileId) {
        this.statements.addFile.run(fileId);
    }

    delete(seqNo) {
        this.statements.deleteBySeqId.run(seqNo);
    }

    getQueue() {
        return this.statements.getQueue.all();
    }

    clear() {
        this.statements.clearQueue.run();
    }
}

module.exports = { IndexQueue };