/**
 * Download Worker for Main Process
 * Node.js worker thread for handling file download operations
 */

const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const workerId = workerData.workerId;
let currentJob = null;
let isProcessing = false;
let shouldCancel = false;

console.log(`Download worker ${workerId} started`);

// Message handler
parentPort.on('message', async (message) => {
    const { type, jobId } = message;
    
    console.log(`Download worker ${workerId}: Received message type: ${type}, jobId: ${jobId}`);
    
    try {
        switch (type) {
            case 'download-file':
                console.log(`Download worker ${workerId}: Handling download-file`);
                await handleDownloadFile(message);
                break;
            case 'cancel-download':
                console.log(`Download worker ${workerId}: Handling cancel-download for job ${jobId}`);
                handleCancelDownload(jobId);
                break;
            default:
                console.log(`Download worker ${workerId}: Unknown message type: ${type}`);
                sendMessage('error', { jobId, error: `Unknown message type: ${type}` });
        }
    } catch (error) {
        console.error(`Download worker ${workerId} error:`, error);
        sendMessage('error', { 
            jobId,
            error: error.message,
            stack: error.stack 
        });
    }
});

/**
 * Handle cancel download request
 */
function handleCancelDownload(jobId) {
    if (currentJob && currentJob.jobId === jobId) {
        console.log(`Download worker ${workerId}: Cancelling download for job ${jobId} (${currentJob.fileInfo.name})`);
        shouldCancel = true;
        
        // Send cancellation result
        sendMessage('error', {
            jobId,
            fileName: currentJob.fileInfo.name,
            status: 'cancelled',
            error: 'Download cancelled by user'
        });
    } else {
        console.log(`Download worker ${workerId}: No matching job found for cancellation: ${jobId}`);
    }
}

/**
 * Handle download file request
 */
async function handleDownloadFile(message) {
    const { jobId, fileInfo, downloadPath } = message;
    
    console.log(`Download worker ${workerId}: handleDownloadFile called for job ${jobId}`);
    
    if (isProcessing) {
        console.log(`Download worker ${workerId}: Worker busy, sending error`);
        sendMessage('error', { jobId, error: 'Worker is busy' });
        return;
    }
    
    try {
        isProcessing = true;
        shouldCancel = false; // Reset cancellation flag
        currentJob = { jobId, fileInfo, downloadPath };
        
        console.log(`Download worker ${workerId}: Starting download for ${fileInfo.name}`);
        
        // Check for cancellation before starting
        if (shouldCancel) {
            throw new Error('Download cancelled before starting');
        }
        
        // Send initial progress
        sendMessage('progress', {
            jobId,
            fileName: fileInfo.name,
            status: 'downloading',
            progress: 0,
            downloadedBytes: 0,
            totalBytes: fileInfo.size || 0
        });
        
        // Download the file
        const result = await downloadFile(fileInfo, downloadPath, jobId);
        
        // Check for cancellation after download
        if (shouldCancel) {
            throw new Error('Download cancelled');
        }
        
        console.log(`Download worker ${workerId}: Download completed for ${fileInfo.name}`);
        
        // Send completion result
        sendMessage('result', {
            jobId,
            fileName: fileInfo.name,
            status: 'completed',
            filePath: result.filePath,
            fileSize: result.fileSize
        });
        
    } catch (error) {
        console.error(`Download worker ${workerId}: Download failed:`, error);
        sendMessage('error', { 
            jobId,
            fileName: fileInfo.name,
            status: 'failed',
            error: error.message,
            stack: error.stack 
        });
    } finally {
        console.log(`Download worker ${workerId}: Finally block - resetting state`);
        isProcessing = false;
        currentJob = null;
        shouldCancel = false;
    }
}

/**
 * Download file from URL to destination
 */
async function downloadFile(fileInfo, downloadPath, jobId) {
    return new Promise((resolve, reject) => {
        try {
            // Ensure download directory exists
            if (!fs.existsSync(downloadPath)) {
                fs.mkdirSync(downloadPath, { recursive: true });
            }
            
            // Generate destination file path
            const fileName = fileInfo.name || `download_${Date.now()}`;
            let destinationPath = path.join(downloadPath, fileName);
            
            // Handle file name conflicts
            if (fs.existsSync(destinationPath)) {
                destinationPath = generateUniqueFilename(destinationPath);
            }
            
            // Determine protocol
            const url = fileInfo.downloadUrl || fileInfo.url;
            if (!url) {
                throw new Error('No download URL provided');
            }
            
            const protocol = url.startsWith('https:') ? https : http;
            
            console.log(`Download worker ${workerId}: Downloading from ${url} to ${destinationPath}`);
            
            // Create write stream
            const fileStream = fs.createWriteStream(destinationPath);
            let downloadedBytes = 0;
            const totalBytes = fileInfo.size || 0;
            
            // Make HTTP request with redirect handling
            makeRequest(url, 0);
            
            function makeRequest(requestUrl, redirectCount) {
                if (redirectCount > 5) {
                    reject(new Error('Too many redirects'));
                    return;
                }
                
                const requestProtocol = requestUrl.startsWith('https:') ? https : http;
                console.log(`Download worker ${workerId}: Making request to ${requestUrl} (redirect count: ${redirectCount})`);
                
                const request = requestProtocol.get(requestUrl, (response) => {
                    // Handle redirects (301, 302, 303, 307, 308)
                    if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
                        console.log(`Download worker ${workerId}: Redirect ${response.statusCode} to ${response.headers.location}`);
                        
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
                    console.error(`Download worker ${workerId}: Request error:`, error);
                    fileStream.destroy();
                    fs.unlinkSync(destinationPath).catch(() => {}); // Clean up partial file
                    reject(error);
                });
                
                // Set timeout
                request.setTimeout(30000, () => {
                    request.destroy();
                    fileStream.destroy();
                    fs.unlinkSync(destinationPath).catch(() => {}); // Clean up partial file
                    reject(new Error('Download timeout'));
                });
            }
            
            function handleResponse(response) {
                if (response.statusCode !== 200) {
                    fileStream.destroy();
                    fs.unlinkSync(destinationPath).catch(() => {}); // Clean up partial file
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }
                
                // Get actual file size from headers if not provided
                const contentLength = parseInt(response.headers['content-length']) || totalBytes;
                
                // Pipe response to file
                response.pipe(fileStream);
                
                // Track progress
                response.on('data', (chunk) => {
                    // Check for cancellation during download
                    if (shouldCancel) {
                        console.log(`Download worker ${workerId}: Cancellation detected during download of ${fileInfo.name}`);
                        response.destroy();
                        fileStream.destroy();
                        fs.unlinkSync(destinationPath).catch(() => {}); // Clean up partial file
                        reject(new Error('Download cancelled by user'));
                        return;
                    }
                    
                    downloadedBytes += chunk.length;
                    
                    const progress = contentLength > 0 ? Math.round((downloadedBytes / contentLength) * 100) : 0;
                    
                    // Send progress update every 1MB or 10% progress
                    if (downloadedBytes % (1024 * 1024) < chunk.length || progress % 10 === 0) {
                        sendMessage('progress', {
                            jobId,
                            fileName: fileInfo.name,
                            status: 'downloading',
                            progress,
                            downloadedBytes,
                            totalBytes: contentLength
                        });
                    }
                });
                
                response.on('end', () => {
                    console.log(`Download worker ${workerId}: Response ended for ${fileInfo.name}`);
                });
                
                response.on('error', (error) => {
                    console.error(`Download worker ${workerId}: Response error:`, error);
                    fileStream.destroy();
                    fs.unlinkSync(destinationPath).catch(() => {}); // Clean up partial file
                    reject(error);
                });
            }
            
            fileStream.on('finish', () => {
                console.log(`Download worker ${workerId}: File stream finished for ${fileInfo.name}`);
                
                // Get final file stats
                const stats = fs.statSync(destinationPath);
                
                resolve({
                    filePath: destinationPath,
                    fileSize: stats.size
                });
            });
            
            fileStream.on('error', (error) => {
                console.error(`Download worker ${workerId}: File stream error:`, error);
                fs.unlinkSync(destinationPath).catch(() => {}); // Clean up partial file
                reject(error);
            });
            
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Generate unique filename if file already exists
 */
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

/**
 * Send message to main thread
 */
function sendMessage(type, data) {
    parentPort.postMessage({ type, ...data });
} 