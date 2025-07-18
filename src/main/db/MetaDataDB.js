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

// PICK: 0 = not picked, 1 = rejected, 2 = picked
// STARS: 0 = not starred, 1..5 stars
// exif in json format
// xmp in xml format

class MetaDataDB {
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
                file_id INTEGER PRIMARY KEY,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                pick INTEGER NOT NULL DEFAULT 0,
                stars INTEGER NOT NULL DEFAULT 0,
                exif TEXT,
                xmp TEXT,
                revision INTEGER NOT NULL DEFAULT 0
            );
        `;
        
        const createIndexesSQL = [
            'CREATE INDEX IF NOT EXISTS idx_pick ON metadata(pick);',
            'CREATE INDEX IF NOT EXISTS idx_stars ON metadata(stars);',
        ];
        
        this.db.exec(createTableSQL);
        createIndexesSQL.forEach(sql => this.db.exec(sql));
    }
    
    prepareStatements() {
        this.statements = {
            get: this.db.prepare(`
                SELECT * FROM metadata
                WHERE file_id = ?
            `),

            add: this.db.prepare(`
                INSERT INTO metadata (file_id, exif, xmp)
                VALUES (?, ?, ?)
            `),
            
            update: this.db.prepare(`
                UPDATE metadata
                SET pick = ?, stars = ?, exif = ?, xmp = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
                WHERE file_id = ?
            `),

            delete: this.db.prepare(`
                DELETE FROM metadata
                WHERE file_id = ?
            `),

            pick: this.db.prepare(`
                UPDATE metadata
                SET pick = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
                WHERE file_id = ?
            `),

            star: this.db.prepare(`
                UPDATE metadata
                SET stars = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
                WHERE file_id = ?
            `),
        };
    }

    get(fileId) {
        return this.statements.get.get(fileId);
    }

    add(fileId, pick, stars, exif, xmp) {
        this.statements.add.run(fileId, pick, stars, exif, xmp);
    }

    update(fileId, pick, stars, exif, xmp) {
        this.statements.update.run(pick, stars, exif, xmp, fileId);
    }

    delete(fileId) {
        this.statements.delete.run(fileId);
    }

    pick(fileId, pick) {
        if (pick < 0 || pick > 2) {
            throw new Error('Invalid pick value');
        }

        this.statements.pick.run(pick, fileId);
    }

    star(fileId, stars) {
        if (stars < 0 || stars > 5) {
            throw new Error('Invalid stars value');
        }

        this.statements.star.run(stars, fileId);
    }
}

module.exports = { MetaDataDB };