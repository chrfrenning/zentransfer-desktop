const crypto = require('crypto');
const fs = require('fs').promises;

/**
 * Calculates MD5, SHA256, and SHA512 hashes for a given file
 * @param {string} filename - Path to the file to hash
 * @returns {Promise<{md5: string, sha256: string, sha512: string}>} Object containing the hash values
 * @throws {Error} If file cannot be read or hashed
 */
async function calculateFileHashes(filename) {
    try {
        // Read the file content
        const fileBuffer = await fs.readFile(filename);
        
        // Calculate hashes
        const md5 = crypto.createHash('md5').update(fileBuffer).digest('hex');
        const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        const sha512 = crypto.createHash('sha512').update(fileBuffer).digest('hex');
        
        return {
            md5,
            sha256,
            sha512
        };
    } catch (error) {
        throw new Error(`Failed to calculate hashes for file "${filename}": ${error.message}`);
    }
}

/**
 * Calculates a single hash for a given file
 * @param {string} filename - Path to the file to hash
 * @param {string} algorithm - Hash algorithm ('md5', 'sha256', 'sha512', etc.)
 * @returns {Promise<string>} The hash value as a hex string
 * @throws {Error} If file cannot be read or hashed
 */
async function calculateFileHash(filename, algorithm) {
    try {
        const fileBuffer = await fs.readFile(filename);
        return crypto.createHash(algorithm).update(fileBuffer).digest('hex');
    } catch (error) {
        throw new Error(`Failed to calculate ${algorithm} hash for file "${filename}": ${error.message}`);
    }
}

module.exports = { calculateFileHashes };
