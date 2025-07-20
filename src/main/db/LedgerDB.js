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

class LedgerDB {
    constructor(ztDatabase) {
        this.db = ztDatabase.db;
        
        // Initialize and prepare the database
        this.createTables();
        
        this.statements = {};
        this.prepareStatements();
    }
    
    createTables() {
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS ledger (
                seq_id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_name TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                checksum TEXT NOT NULL,
                salt TEXT NOT NULL,
                nonce TEXT NOT NULL,
                pow_hash TEXT NOT NULL,
                complexity INTEGER NOT NULL,
                service_type TEXT NOT NULL,
                url TEXT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `;
        
        const createIndexesSQL = [
            'CREATE INDEX IF NOT EXISTS idx_service_type ON ledger(service_type);',
        ];
        
        this.db.exec(createTableSQL);
        createIndexesSQL.forEach(sql => this.db.exec(sql));
    }
    
    prepareStatements() {
        this.statements = {
            add: this.db.prepare(`
                INSERT INTO ledger 
                (file_name, file_size, checksum, salt, nonce, pow_hash, complexity, service_type, url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `),

            list: this.db.prepare(`
                SELECT * FROM ledger
                WHERE service_type = ? AND seq_id > ?
                ORDER BY seq_id ASC
                LIMIT ?
            `),
        };
    }

    add(fileId) {
       const result = this.statements.add.run(fileId);
       return result.lastInsertRowid;
    }

    list(serviceType, lastSeqNo = 0, limit = 10000) {
        return this.statements.list.all(serviceType, lastSeqNo, limit);
    }

}

module.exports = { LedgerDB };