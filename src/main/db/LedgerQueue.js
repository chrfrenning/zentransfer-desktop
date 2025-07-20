/**
 * SQLite Ledger Queue
 * 
 * Maintains a list of files that have been uploaded, and are now pending
 * for minting and being included in the ledger. 
 * 
 */

const { app } = require('electron');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/Logger.js');

class LedgerQueue {
    constructor(ztDatabase) {
        this.db = ztDatabase.db;
        
        // Initialize and prepare the database
        this.createTables();
        
        this.statements = {};
        this.prepareStatements();
    }

    createTables() {
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS ledger_queue (
                seq_id INTEGER PRIMARY KEY AUTOINCREMENT,
                service_type TEXT NOT NULL,
                file_id INTEGER NOT NULL
            );
        `;
        
        const createIndexesSQL = [
            'CREATE INDEX IF NOT EXISTS idx_service_type ON ledger_queue(service_type);',
        ];
        
        this.db.exec(createTableSQL);
        createIndexesSQL.forEach(sql => this.db.exec(sql));
    }
    
    prepareStatements() {
        this.statements = {
            addFile: this.db.prepare(`
                INSERT INTO ledger_queue 
                (service_type, file_id)
                VALUES (?, ?)
            `),

            deleteBySeqId: this.db.prepare(`
                DELETE FROM ledger_queue 
                WHERE seq_id = ?
            `),
            
            getQueue: this.db.prepare(`
                SELECT seq_id, file_id FROM ledger_queue
                WHERE service_type = ?
                ORDER BY seq_id ASC
            `),

            clearQueue: this.db.prepare(`
                DELETE FROM ledger_queue
            `),
        };
    }

    add(serviceType, fileId) {
        this.statements.addFile.run(serviceType, fileId);
    }

    delete(seqNo) {
        this.statements.deleteBySeqId.run(seqNo);
    }

    getQueue(serviceType) {
        return this.statements.getQueue.all(serviceType);
    }

    clear() {
        this.statements.clearQueue.run();
    }
}

module.exports = { LedgerQueue };