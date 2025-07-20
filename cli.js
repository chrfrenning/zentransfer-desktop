const { app, ipcMain, BrowserWindow } = require('electron');
const { ZenTransferAuthenticationService } = require('./src/main/services/auth/ZenTransferAuthenticationService.js');
const { UploadSession } = require('./src/main/services/auth/UploadSession.js');
const { TokenManager } = require('./src/main/services/auth/TokenManager.js');
const { UploadWorkerPool } = require('./src/main/pools/UploadWorkerPool.js');
const { DownloadWorkerPool } = require('./src/main/pools/DownloadWorkerPool.js');
const { ImportWorkerPool } = require('./src/main/pools/ImportWorkerPool.js');

function runInCommandLineMode() {
    console.log('Running in command line mode');
    app.isCommandLineMode = true;

    // all the services
    const authenticationService = app.authenticationService;
    const uploadSession = app.uploadSession;
    const tokenManager = app.tokenManager;
    const uploadWorkerPool = app.uploadWorkerPool;
    const downloadWorkerPool = app.downloadWorkerPool;
    const importWorkerPool = app.importWorkerPool;

    // ipc handlers we need to listen for
    ipcMain.on('info-message', (event, message) => {
        console.log(message);
    });

    app.whenReady().then(() => {
        const hiddenWindow = createHiddenWindow();
        console.log('Command line mode ready - hidden window created');
        
        // Now you can use your services normally
        startCommandLineInterface(hiddenWindow);
    });

    // Handle app events
    app.on('window-all-closed', () => {
        // Don't quit on window-all-closed in command line mode
        console.log('Hidden window closed, but staying alive for command line mode');
    });
}

function checkCommandLineArgument(arg) {
    if (process.argv.includes(arg)) {
        return true;
    }

    return false;
}

function getNamedArgument(arg) {
    const index = process.argv.indexOf(arg);
    if (index > -1) {
        return process.argv[index + 1];
    }
    return null;
}

function startCommandLineInterface(hiddenWindow) {
    console.log('Starting command line interface');

    // send some messages every second
    setInterval(() => {
        BrowserWindow.getAllWindows().forEach(window => {
            window.webContents.send('info-message', 'Hello from the command line mode');
        });
    }, 1000);

    // start downloads
    console.log(process.argv);
    if (false && checkCommandLineArgument('download')) {
        const downloadPath = app.configurationManager.get('downloadSettings.downloadPath');
        console.log(`Downloading files to ${downloadPath}`);
        app.downloadWorkerPool.startMonitoring();
    } else if (false || checkCommandLineArgument('upload')) {
        const uploadPath = "D:\\ZenTransfer Test\\ZT Source\\DSCF3116.JPG"
        console.log('Uploading files simulation...');
        app.uploadWorkerPool.addFiles([uploadPath], 'minio');
    } else if ( true || checkCommandLineArgument('import')) {
        const importPath = "D:\\ZenTransfer Test\\ZT Source"
        console.log('Importing files simulation...');
        app.importWorkerPool.startImport({
            sourcePath: importPath
        });
    }

    // ask user for input
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('Enter a command: ', (command) => {
        console.log(`Received command: ${command}`);
        rl.close();
    });
}

function createHiddenWindow() {
    // Create a hidden window so IPC communication works
    const hiddenWindow = new BrowserWindow({
        width: 1,
        height: 1,
        show: false, // Hidden window
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            //preload: path.join(__dirname, 'src/preload/preload.js')
        }
    });

    // Load a minimal HTML page
    hiddenWindow.loadURL('data:text/html,<html><body>Command Line Mode</body></html>');
    
    // Set up IPC message listeners on the hidden window
    setupWorkerMessageListeners(hiddenWindow);
    
    console.log('Hidden window created - workers can now send IPC messages');

    return hiddenWindow;
}

function setupWorkerMessageListeners(hiddenWindow) {
    // Listen for upload progress messages
    hiddenWindow.webContents.on('ipc-message', (event, channel, ...args) => {
        handleWorkerMessage(channel, ...args);
    });

    // Alternative approach - listen for specific channels via IPC
    // We need to set up listeners in the preload script, but for command line
    // we can also intercept the webContents.send calls directly
    
    // Override webContents.send to capture all IPC messages
    const originalSend = hiddenWindow.webContents.send;
    hiddenWindow.webContents.send = function(channel, ...args) {
        // Handle the message in command line
        handleWorkerMessage(channel, ...args);
        
        // Still call original to maintain normal flow
        return originalSend.call(this, channel, ...args);
    };
}

function handleWorkerMessage(channel, data) {
    //console.log(`[IPC] ${channel}:`, data);
}

module.exports = { runInCommandLineMode };