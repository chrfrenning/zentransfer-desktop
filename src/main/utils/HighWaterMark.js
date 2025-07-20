const fs = require('fs');
const path = require('path');
const logger = require('./Logger.js');
const { v4: uuidv4 } = require('uuid');

const HWM_VERSION = '1';
const HWM_FILE_NAME = '.zentransfer';
const BEGINNING_OF_TIME = new Date('1970-01-01T00:00:00.000Z');

class HighWaterMark {
    constructor() {
    }

    async upsert(directoryPath, highWaterMarkDate) {
        const hwmPath = path.join(directoryPath, HWM_FILE_NAME);
        
        try {
            let sourceId = uuidv4(); // Default to new UUID

            // If file exists, preserve the existing sourceId
            if (fs.existsSync(hwmPath)) {
                try {
                    const existingData = JSON.parse(fs.readFileSync(hwmPath, 'utf8'));
                    if (existingData.sourceId) {
                        sourceId = existingData.sourceId;
                    }
                } catch (error) {
                    logger.warn(`Failed to read existing HWM file, creating new one: ${error.message}`);
                }
            }

            let hwmData = {
                version: HWM_VERSION,
                sourceId: sourceId,
                highWaterMark: new Date(highWaterMarkDate).toISOString()
            };

            fs.writeFileSync(hwmPath, JSON.stringify(hwmData, null, 2), 'utf8');
            logger.debug(`High water mark updated: ${hwmPath}`);
            return hwmData;
        } catch (error) {
            logger.error(`Failed to upsert high water mark: ${error.message}`);
            //throw error; // we silently fail here, worst case is data duplication
        }
    }
    
    async read(directoryPath) {
        const hwmPath = path.join(directoryPath, HWM_FILE_NAME);
        
        try {
            if (fs.existsSync(hwmPath)) {
                const hwmData = JSON.parse(fs.readFileSync(hwmPath, 'utf8'));
                
                // Validate the structure
                if (!hwmData.version || !hwmData.sourceId || !hwmData.highWaterMark) {
                    logger.warn(`Invalid HWM file structure, returning beginning of time`);
                    return this._getDefaultHWM();
                }
                
                return hwmData;
            } else {
                logger.debug(`HWM file does not exist: ${hwmPath}, returning beginning of time`);
                return this._getDefaultHWM();
            }
        } catch (error) {
            logger.error(`Failed to read high water mark: ${error.message}`);
            return this._getDefaultHWM();
        }
    }
    
    async getHighWaterMarkDate(directoryPath) {
        const hwmData = await this.read(directoryPath);
        return new Date(hwmData.highWaterMark);
    }

    static beginningOfTime() {
        return BEGINNING_OF_TIME;
    }
    
    _getDefaultHWM() {
        return {
            version: HWM_VERSION,
            sourceId: null,
            highWaterMark: BEGINNING_OF_TIME.toISOString()
        };
    }
}

module.exports = { HighWaterMark };