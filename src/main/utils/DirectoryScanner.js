const fs = require('fs');
const path = require('path');
const logger = require('./Logger.js');

class DirectoryScanner {
    constructor() {
        this.isCancelled = false;
    }

  async scan(sourcePath, includeSubDirectories, includeExtensions = []) {

    if (!fs.existsSync(sourcePath)) {
      throw new Error('Source directory does not exist');
    }

    const stats = fs.statSync(sourcePath);
    if (!stats.isDirectory()) {
        throw new Error('Source path is not a directory');
    }

    const files = [];

    const scanDir = async (dirPath, relativePath = '') => {
        if ( this.isCancelled ) return; // Stop scanning if cancelled
        
        const items = await fs.promises.readdir(dirPath);
        logger.debug(`Scanning directory ${dirPath}, found ${items.length} items`);
        
        for (const item of items) {
            if ( this.isCancelled ) return; // Stop scanning if cancelled

            const fullPath = path.join(dirPath, item);
            const itemRelativePath = relativePath ? path.join(relativePath, item) : item;

            if ( item.startsWith('.') ) continue; // Skip hidden files and directories
            if ( item === 'Thumbs.db' ) continue; // Skip Windows thumbnail cache
            if ( item === 'desktop.ini' ) continue; // Skip Windows desktop.ini
            if ( item === 'zentransfer.hwm' ) continue; // Skip ZenTransfer high water mark
            
            try {
                const itemStats = await fs.promises.stat(fullPath);
                
                if ( itemStats.isFile() ) {
                    logger.silly(`Found file: ${fullPath}`);
                    if ( !this.checkFileType(item, includeExtensions) ) continue;

                    files.push({
                        name: item,
                        path: fullPath,
                        relativePath: itemRelativePath,
                        size: itemStats.size,
                        created: itemStats.birthtime,
                        modified: itemStats.mtime
                    });

                } else if (itemStats.isDirectory() && includeSubDirectories) {
                    logger.silly(`Scanning subdir: ${fullPath}`);
                    await scanDir(fullPath, itemRelativePath);
                } else {
                    logger.debug(`Skipping item: ${fullPath} (not a file or directory)`);
                }

            } catch (itemError) {
                console.warn(`Failed to process item: ${fullPath}`, itemError);
            }
        }
    };
    
    await scanDir(sourcePath);
    return files;
  }

  checkFileType(fileName, includeExtensions) {
    if ( !includeExtensions || includeExtensions.length === 0 ) {
        return true;
    }

    const ext = path.extname(fileName).toLowerCase();
    const ret = includeExtensions.includes(ext);
    return ret;
  }

  postCancelMessage() {
    this.isCancelled = true;
  }

}

module.exports = { DirectoryScanner };
