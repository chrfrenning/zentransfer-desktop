/**
 * Download Worker for Main Process
 * Node.js worker thread for handling file download operations
 */

const { parentPort, workerData } = require('worker_threads');
const logger = require('./WorkerLogger.js');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Let the world know we're here
const { workerId } = workerData;
logger.info(`Download worker ${workerId} started`);

// How long can a download take?
const DOWNLOAD_TIMEOUT = 90000; // 30 seconds
const MAX_REDIRECTS = 5;

/* ********************************************************************

    DOWNLOAD WORKER DOCUMENTATION

    EXAMPLE MESSAGE RECEIVED:

    {
        type: 'download-file',
        fileRecord: {
            id: 3,
            file_id: 'c2YzdmXVjHvUKqadDNHF9m',
            name: 'DSCF3117.JPG',
            url: 'https://tmp.chph.dev/a/c2YzdmXVjHvUKqadDNHF9m',
            thumbnail_url: 'https://tmp.chph.dev/a/c2YzdmXVjHvUKqadDNHF9m/thumbnail',
            file_size: 15709876,
            created_at: '2025-07-14T04:19:42.789139+00:00',
            status: 'pending',
            retry_count: 0,
            last_retry_at: null,
            next_retry_at: null,
            error_message: null,
            file_path: null
        },
        downloadPath: undefined
    }

    RECEIVES MESSAGES:

        download-file:

    EMITS MESSAGES:

        progress { fileRecord, downloadedBytes, totalBytes }
        completed { fileRecord, filePath }
        error { fileRecord, errorMessage }
        worker-error { error, stack }

    ******************************************************************/



/*
 * Send messages to main thread / DownloadWorkerPool
 *
 */

function sendMessageToMainProcess(type, data) {
    parentPort.postMessage({ type, ...data });
}

// Send progress message to main thread
function sendProgressMessage(fileRecord, downloadedBytes, totalBytes) {
    sendMessageToMainProcess('progress', { fileRecord, downloadedBytes, totalBytes });
}

// Send completed message to main thread
function sendCompletedMessage(fileRecord, filePath) {
    sendMessageToMainProcess('completed', { fileRecord, filePath });
}

// Send error message to main thread
function sendErrorMessage(fileRecord, errorMessage) {
    sendMessageToMainProcess('error', { fileRecord, errorMessage });
}

// Send worker error message to main thread
function sendWorkerErrorMessage(error, stack) {
    sendMessageToMainProcess('worker-error', { error, stack });
}



/*
 * Receive messages from main thread
 *
 */

// Message handler
parentPort.on('message', async (message) => {
    const { type, fileRecord, downloadPath } = message;

    logger.info(`Download worker ${workerId}: Received message type: ${type}.`, message);

    try {
        switch (type) {
            case 'download-file':
                logger.info(`Download worker ${workerId}: Handling download-file`);
                await handleDownloadFile(fileRecord, downloadPath);
                break;
            default:
                logger.info(`Download worker ${workerId}: Unknown message type: ${type}`);
        }
    } catch (error) {
        logger.error(`Unexpected exception in download worker ${workerId}; error:`, error);

        sendMessageToMainProcess('worker-error', {
            type: "error",
            fileRecord: fileRecord,
            error: error.message,
            stack: error.stack
        });
    }
});



/*
 * Handle download file message
 *
 */

async function handleDownloadFile(fileRecord, downloadPath) {

    logger.info(`Starting download for ${fileRecord.file_id} with name ${fileRecord.name} in worker ${workerId}`);

    try {
        // Ensure download directory exists
        if (!fs.existsSync(downloadPath)) {
            fs.mkdirSync(downloadPath, { recursive: true });
        }

        // Send initial progress
        sendProgressMessage(fileRecord, 0, fileRecord.file_size);

        // Generate destination file path
        const fileName = fileRecord.name || `download_${Date.now()}.bin`;
        let destinationPath = path.join(downloadPath, fileName);

        // Handle file name conflicts
        if (fs.existsSync(destinationPath)) {
            destinationPath = generateUniqueFilename(destinationPath);
        }

        // Download the file
        const result = await downloadFile(fileRecord, destinationPath);

        // Send completion result
        sendCompletedMessage(fileRecord, result.filePath);

        logger.info(`Download worker ${workerId}: Download completed for ${fileRecord.name}`);

    } catch (error) {

        logger.error(`Download failed in worker ${workerId}:`, error);
        sendErrorMessage(fileRecord, error.message);

    }
}

async function downloadFile(fileRecord, destinationPath) {
    return new Promise((resolve, reject) => {
        try {

            logger.info(`Download worker ${workerId}: Downloading from ${fileRecord.url} to ${destinationPath}`);

            // Create write stream
            const fileStream = fs.createWriteStream(destinationPath);
            let downloadedBytes = 0;
            const totalBytes = fileRecord.size || 0;

            // Make HTTP request with redirect handling
            makeRequest(fileRecord.url, 0);

            function makeRequest(requestUrl, redirectCount) {
                if (redirectCount > MAX_REDIRECTS) {
                    reject(new Error('Too many redirects'));
                    return;
                }

                const requestProtocol = requestUrl.startsWith('https:') ? https : http;
                logger.info(`Download worker ${workerId}: Making request to ${requestUrl} (redirect count: ${redirectCount})`);

                const request = requestProtocol.get(requestUrl, (response) => {
                    // Handle redirects (301, 302, 303, 307, 308)
                    if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
                        logger.info(`Download worker ${workerId}: Redirect ${response.statusCode} to ${response.headers.location}`);

                        // Resolve relative URLs
                        let redirectUrl = response.headers.location;
                        if (!redirectUrl.startsWith('http')) {
                            const urlObj = new URL(requestUrl);
                            if (redirectUrl.startsWith('/')) {
                                redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`;
                            } else {
                                redirectUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}/${redirectUrl}`;
                            }
                        }

                        // Follow redirect
                        makeRequest(redirectUrl, redirectCount + 1);
                        return;
                    }

                    handleResponse(response);
                });

                request.on('error', (error) => {
                    logger.error(`Download worker ${workerId}: Request error:`, error);
                    
                    // Clean up partial file
                    fileStream.destroy();
                    fs.unlinkSync(destinationPath).catch(() => { }); 
                    
                    reject(error);
                });

                // Set timeout
                request.setTimeout(DOWNLOAD_TIMEOUT, () => {
                    request.destroy();

                    // Clean up partial file
                    fileStream.destroy();
                    fs.unlinkSync(destinationPath).catch(() => { });

                    reject(new Error('Download timeout'));
                });
            }

            function handleResponse(response) {

                if (response.statusCode !== 200) {

                    // Clean up partial file
                    fileStream.destroy();
                    fs.unlinkSync(destinationPath).catch(() => { });
                    
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }

                // Get actual file size from headers if not provided
                const contentLength = parseInt(response.headers['content-length']) || totalBytes;

                // Pipe response to file
                response.pipe(fileStream);

                // Track progress
                response.on('data', (chunk) => {

                    downloadedBytes += chunk.length;

                    // Send progress update every 1MB or 10% progress
                    
                    const progress = contentLength > 0 ? Math.round((downloadedBytes / contentLength) * 100) : 0;
                    if (downloadedBytes % (1024 * 1024) < chunk.length || progress % 10 === 0) {
                        sendProgressMessage(fileRecord, downloadedBytes, contentLength);
                    }

                });

                response.on('end', () => {
                    logger.info(`Download worker ${workerId}: Response ended for ${fileRecord.name}`);
                });

                response.on('error', (error) => {
                    logger.error(`Download worker ${workerId}: Response error:`, error);

                    // Clean up partial file
                    fileStream.destroy();
                    fs.unlinkSync(destinationPath).catch(() => { });

                    reject(error);
                });
            }

            fileStream.on('finish', () => {
                logger.info(`Download worker ${workerId}: File stream finished for ${fileRecord.name}`);

                // Get final file stats
                const stats = fs.statSync(destinationPath);

                resolve({
                    filePath: destinationPath,
                    fileSize: stats.size
                });
            });

            fileStream.on('error', (error) => {
                logger.error(`Download worker ${workerId}: File stream error:`, error);

                // Clean up partial file
                fs.unlinkSync(destinationPath).catch(() => { });

                reject(error);
            });

        } catch (error) {

            reject(error);

        }
    });
}

// Generate unique filename if file already exists
function generateUniqueFilename(filePath) {

    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);

    const nameWithoutExt = path.basename(filePath, ext);

    let counter = 1;
    let uniquePath;

    do {
        uniquePath = path.join(dir, `${nameWithoutExt} (${counter})${ext}`);
        counter++;
    } while (fs.existsSync(uniquePath));

    return uniquePath;

}