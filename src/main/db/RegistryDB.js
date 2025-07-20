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
const { randomUUID } = require('crypto');
const logger = require('../utils/Logger.js');

class RegistryDB {
    constructor(ztDatabase) {
        this.db = ztDatabase.db;
        
        // Initialize and prepare the database
        this.createTables();
        
        this.statements = {};
        this.prepareStatements();
    }
    
    createTables() {
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS registry (
                file_id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_name TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                file_date DATETIME NOT NULL,
                mime_type TEXT NOT NULL,
                system_uid TEXT UNIQUE NOT NULL,
                md5_checksum TEXT,
                sha512_checksum TEXT,
                tiny_th BLOB,
                source_id TEXT,
                source_fn TEXT,
                service_type TEXT NOT NULL,
                store_path TEXT NOT NULL,
                store_fn TEXT NOT NULL,
                url TEXT NOT NULL,
                th_url TEXT,
                pv_url TEXT,
                exif_json TEXT,
                doc_id TEXT,
                feat_algo INTEGER,
                feat_vector BLOB,
                sig_ca TEXT,
                sig_pgp TEXT,
                sig_c2pa TEXT,
                ledger_id INTEGER,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `;
        
        const createIndexesSQL = [
            'CREATE INDEX IF NOT EXISTS idx_file_name ON registry(file_name);',
            'CREATE INDEX IF NOT EXISTS idx_doc_id ON registry(doc_id);',
            'CREATE INDEX IF NOT EXISTS idx_file_date ON registry(service_type, file_date);',
            'CREATE INDEX IF NOT EXISTS idx_created_at ON registry(service_type, created_at);',
            'CREATE INDEX IF NOT EXISTS idx_store_path ON registry(service_type, store_path);',
        ];
        
        this.db.exec(createTableSQL);
        createIndexesSQL.forEach(sql => this.db.exec(sql));
    }
    
    prepareStatements() {
        this.statements = {
            add: this.db.prepare(`
                INSERT INTO registry (
                    file_name,
                    file_size,
                    file_date,
                    system_uid,
                    md5_checksum,
                    sha512_checksum,
                    tiny_th,
                    source_fn,
                    service_type,
                    store_path,
                    store_fn,
                    url,
                    th_url,
                    pv_url, 
                    exif_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `),
        };
    }

    add(fileName, fileSize, fileDate, md5, sha512, tinyThumbnail, sourceFolderName, serviceType, storePath, storeFileName, url, thumbnailUrl, previewUrl, exifJson) {
        const newSystemUniqueId = randomUUID();

        const result = this.statements.add.run(

            fileName,
            fileSize,
            fileDate,
            newSystemUniqueId,
            md5,
            sha512,
            tinyThumbnail,
            sourceFolderName,
            serviceType,
            storePath,
            storeFileName,
            url,
            thumbnailUrl,
            previewUrl,
            exifJson);

        return result.lastInsertRowid;
    }
}

module.exports = { RegistryDB };