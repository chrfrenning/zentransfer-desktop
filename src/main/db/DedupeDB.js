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

class DedupeDB {
    constructor(ztDatabase) {
        this.db = ztDatabase;
        
        // Initialize and prepare the database
        this.createTables();
        
        this.statements = {};
        this.prepareStatements();
    }
    
    createTables() {
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS dedupe (
                file_name TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                file_date DATETIME NOT NULL,
                md5_checksum TEXT,
                unique_id TEXT,
                feat_algo INTEGER,
                feat_vector BLOB,
                PRIMARY KEY (file_name, file_size, file_date)
            );
        `;
        
        const createIndexesSQL = [
            'CREATE INDEX IF NOT EXISTS idx_md5_checksum ON dedupe(md5_checksum);',
            'CREATE INDEX IF NOT EXISTS idx_unique_id ON dedupe(unique_id);',
        ];
        
        this.db.exec(createTableSQL);
        createIndexesSQL.forEach(sql => this.db.exec(sql));
    }
    
    prepareStatements() {
        this.statements = {
            add: this.db.prepare(`
                INSERT INTO dedupe 
                (file_name, file_size, file_date)
                VALUES (?, ?, ?)
            `),

            get: this.db.prepare(`
                SELECT * FROM dedupe
                WHERE file_name = ? AND file_size = ? AND file_date = ?
            `),
        };
    }

    add(fileName, fileSize, fileDate) {
       const result = this.statements.add.run(fileName, fileSize, fileDate);
       return result.lastInsertRowid;
    }

    check(fileName, fileSize, fileDate) {
        const result = this.statements.get.get(fileName, fileSize, fileDate);
        return result;
    }

    clear() {
        this.db.exec('DELETE FROM dedupe');
    }

}

module.exports = { DedupeDB };