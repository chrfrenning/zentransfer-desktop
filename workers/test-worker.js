/**
 * Test Worker
 * Minimal worker to test if worker environment is functioning
 */

console.log('Test worker starting...');

// Send initialization message
self.postMessage({ 
    type: 'test-ready', 
    data: { message: 'Test worker initialized successfully' } 
});

// Message handler
self.onmessage = function(e) {
    console.log('Test worker received message:', e.data);
    
    try {
        const { type, data } = e.data;
        
        switch (type) {
            case 'ping':
                self.postMessage({ 
                    type: 'pong', 
                    data: { message: 'Test worker responding', receivedData: data } 
                });
                break;
            default:
                self.postMessage({ 
                    type: 'error', 
                    data: { error: `Unknown message type: ${type}` } 
                });
        }
    } catch (error) {
        console.error('Test worker error:', error);
        self.postMessage({ 
            type: 'error', 
            data: { 
                error: error.message,
                stack: error.stack 
            } 
        });
    }
};

// Error handler
self.onerror = function(error) {
    console.error('Test worker global error:', error);
    self.postMessage({ 
        type: 'error', 
        data: { 
            error: `Global error: ${error.message}`,
            filename: error.filename,
            lineno: error.lineno
        } 
    });
};

console.log('Test worker setup complete'); 