const fs = require('fs');
const path = require('path');
const logger = require('./Logger.js');

const HWM_FILE_NAME = 'zentransfer.hwm';

class HighWaterMark {
    constructor() {
    }

    async create(path, value) {    
        const hwmPath = path.join(path, HWM_FILE_NAME);
        if (fs.existsSync(hwmPath)) {
            return fs.readFileSync(hwmPath, 'utf8');
        }
        return 0;
    }

    async read(path) {
        const hwmPath = path.join(path, HWM_FILE_NAME);
        if (fs.existsSync(hwmPath)) {
            return fs.readFileSync(hwmPath, 'utf8');
        }
        return 0;
    }
}

module.exports = { HighWaterMark };