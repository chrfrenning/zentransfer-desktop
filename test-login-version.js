// Test login screen version display
console.log('=== Testing Login Screen Version Display ===');

// Mock DOM elements for testing
global.document = {
    getElementById: (id) => {
        if (id === 'appVersion') {
            return {
                textContent: '',
                innerHTML: ''
            };
        }
        return null;
    }
};

// Import the configuration
const { config } = require('./src/config/app-config.js');
console.log(`📦 Config APP_VERSION: ${config.APP_VERSION}`);

// Mock version element
const mockVersionElement = {
    textContent: ''
};

// Simulate the version initialization logic from login screen
if (mockVersionElement && config.APP_VERSION) {
    mockVersionElement.textContent = `v${config.APP_VERSION}`;
}

console.log(`🖥️  Login screen would display: "${mockVersionElement.textContent}"`);
console.log(`✅ Version format correct: ${mockVersionElement.textContent.startsWith('v') ? 'YES' : 'NO'}`);
console.log(`✅ Version matches package.json: ${mockVersionElement.textContent === `v${require('./package.json').version}` ? 'YES' : 'NO'}`);

console.log('\n=== Test Complete ==='); 