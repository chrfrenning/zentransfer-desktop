#!/usr/bin/env node

/**
 * Cloud Services Test Script
 * Tests upload, download, and shareable URL functionality for all cloud services
 * 
 * USAGE:
 *   node test.js
 * 
 * DESCRIPTION:
 *   This script tests the three new cloud service functions:
 *   - listFiles(path) - Lists files in a given path
 *   - downloadFile(filename, localPath) - Downloads a file from the service
 *   - createShareableUrl(filename, expiresAt) - Creates a shareable URL with expiration
 * 
 * CONFIGURATION:
 *   The script automatically loads cloud service configurations from config.json
 *   in the current directory. It will only test services that are enabled in the config.
 *   
 *   To test with your services:
 *   1. Ensure config.json exists in the current directory
 *   2. Enable the desired services by setting "enabled": true
 *   3. Configure proper credentials for each enabled service
 * 
 * REQUIREMENTS:
 *   - Node.js
 *   - config.json file with cloud service configurations
 *   - zentransfer-desktop.yml file in the current directory
 *   - Required npm packages: @aws-sdk/client-s3, @aws-sdk/s3-request-presigner,
 *     @azure/storage-blob, @google-cloud/storage
 * 
 * CONFIG.JSON STRUCTURE:
 *   {
 *     "cloudServices": {
 *       "aws-s3": {
 *         "enabled": true,
 *         "region": "us-east-1",
 *         "bucket": "your-bucket",
 *         "accessKey": "your-access-key",
 *         "secretKey": "your-secret-key",
 *         "storageClass": "STANDARD"
 *       },
 *       "azure-blob": {
 *         "enabled": true,
 *         "connectionString": "DefaultEndpointsProtocol=https;AccountName=...",
 *         "containerName": "your-container"
 *       },
 *       "gcp-storage": {
 *         "enabled": true,
 *         "bucketName": "your-bucket",
 *         "serviceAccountKey": "your-service-account-json-as-string"
 *       },
 *       "minio": {
 *         "enabled": true,
 *         "endpoint": "your-endpoint",
 *         "port": 9000,
 *         "bucket": "your-bucket",
 *         "accessKey": "your-access-key",
 *         "secretKey": "your-secret-key",
 *         "useSSL": false,
 *         "region": "us-east-1"
 *       }
 *     }
 *   }
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Import all cloud services
const { AwsS3Service } = require('./src/workers/services/aws-s3-service.js');
const { AzureBlobService } = require('./src/workers/services/azure-blob-service.js');
const { GcpStorageService } = require('./src/workers/services/gcp-storage-service.js');
const { MinioService } = require('./src/workers/services/minio-service.js');

/**
 * Load cloud service configurations from config.json
 * @returns {Object} Configurations for enabled services
 */
function loadConfigurationsFromFile() {
    const configPath = './config.json';
    
    if (!fs.existsSync(configPath)) {
        console.log(`❌ Config file ${configPath} not found!`);
        console.log('Please ensure config.json exists in the current directory.');
        return {};
    }
    
    try {
        const configData = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configData);
        
        if (!config.cloudServices) {
            console.log('❌ No cloudServices section found in config.json');
            return {};
        }
        
        const configurations = {};
        
        // Extract configurations for enabled services
        for (const [serviceType, serviceConfig] of Object.entries(config.cloudServices)) {
            if (serviceConfig.enabled) {
                configurations[serviceType] = { ...serviceConfig };
                delete configurations[serviceType].serviceType; // Remove redundant field
                delete configurations[serviceType].enabled; // Remove enabled flag
            }
        }
        
        return configurations;
    } catch (error) {
        console.log(`❌ Failed to load config.json: ${error.message}`);
        return {};
    }
}

// Load configurations from config.json
const TEST_CONFIGURATIONS = loadConfigurationsFromFile();

class CloudServiceTester {
    constructor() {
        this.testFile = 'zentransfer-desktop.yml';
        this.tempDir = path.join(os.tmpdir(), 'zentransfer-test');
        this.results = {};
        
        // Ensure temp directory exists
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    /**
     * Print a section header
     */
    printHeader(title) {
        console.log('\n' + '='.repeat(60));
        console.log(`  ${title}`);
        console.log('='.repeat(60));
    }

    /**
     * Print a subsection header
     */
    printSubHeader(title) {
        console.log('\n' + '-'.repeat(40));
        console.log(`  ${title}`);
        console.log('-'.repeat(40));
    }

    /**
     * Print test result
     */
    printResult(serviceName, operation, result) {
        const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
        console.log(`[${serviceName}] ${operation}: ${status}`);
        
        if (result.success) {
            console.log(`  Message: ${result.message}`);
            if (result.details) {
                console.log(`  Details:`, JSON.stringify(result.details, null, 2));
            }
        } else {
            console.log(`  Error: ${result.message}`);
        }
        console.log();
    }

    /**
     * Create a service instance
     */
    createService(serviceName, config) {
        switch (serviceName) {
            case 'aws-s3':
                return new AwsS3Service(config);
            case 'azure-blob':
                return new AzureBlobService(config);
            case 'gcp-storage':
                return new GcpStorageService(config);
            case 'minio':
                return new MinioService(config);
            default:
                throw new Error(`Unknown service: ${serviceName}`);
        }
    }

    /**
     * Test connection to a service
     */
    async testConnection(serviceName, service) {
        console.log(`Testing connection to ${serviceName}...`);
        
        try {
            const result = await service.testConnection();
            this.printResult(serviceName, 'Connection Test', result);
            return result.success;
        } catch (error) {
            this.printResult(serviceName, 'Connection Test', {
                success: false,
                message: error.message
            });
            return false;
        }
    }

    /**
     * Test file upload
     */
    async testUpload(serviceName, service) {
        console.log(`Testing upload to ${serviceName}...`);
        
        try {
            const remoteName = `test-${Date.now()}-${this.testFile}`;
            const result = await service.uploadFile(
                this.testFile,
                remoteName,
                'application/x-yaml',
                { skipDuplicates: false }
            );
            
            this.printResult(serviceName, 'Upload', result);
            
            if (result.success) {
                // Store the remote name for download test
                this.results[serviceName] = { remoteName, uploadResult: result };
            }
            
            return result.success;
        } catch (error) {
            this.printResult(serviceName, 'Upload', {
                success: false,
                message: error.message
            });
            return false;
        }
    }

    /**
     * Test file listing
     */
    async testListFiles(serviceName, service) {
        console.log(`Testing file listing for ${serviceName}...`);
        
        try {
            const result = await service.listFiles('');
            this.printResult(serviceName, 'List Files', result);
            
            if (result.success) {
                console.log(`  Found ${result.files.length} files/directories:`);
                result.files.slice(0, 5).forEach(file => {
                    console.log(`    - ${file.name} (${file.size} bytes, ${file.isDirectory ? 'DIR' : 'FILE'})`);
                });
                if (result.files.length > 5) {
                    console.log(`    ... and ${result.files.length - 5} more`);
                }
            }
            
            return result.success;
        } catch (error) {
            this.printResult(serviceName, 'List Files', {
                success: false,
                message: error.message
            });
            return false;
        }
    }

    /**
     * Test file download
     */
    async testDownload(serviceName, service) {
        if (!this.results[serviceName] || !this.results[serviceName].remoteName) {
            console.log(`Skipping download test for ${serviceName} - no uploaded file`);
            return false;
        }

        console.log(`Testing download from ${serviceName}...`);
        
        try {
            const { remoteName } = this.results[serviceName];
            const localPath = path.join(this.tempDir, `downloaded-${serviceName}-${this.testFile}`);
            
            const result = await service.downloadFile(remoteName, localPath);
            this.printResult(serviceName, 'Download', result);
            
            if (result.success) {
                // Verify file exists and has content
                if (fs.existsSync(localPath)) {
                    const stats = fs.statSync(localPath);
                    console.log(`  Downloaded file size: ${stats.size} bytes`);
                    
                    // Compare with original file
                    const originalStats = fs.statSync(this.testFile);
                    const sizeMatch = stats.size === originalStats.size;
                    console.log(`  Size matches original: ${sizeMatch ? '✅' : '❌'}`);
                    
                    if (sizeMatch) {
                        const originalContent = fs.readFileSync(this.testFile, 'utf8');
                        const downloadedContent = fs.readFileSync(localPath, 'utf8');
                        const contentMatch = originalContent === downloadedContent;
                        console.log(`  Content matches original: ${contentMatch ? '✅' : '❌'}`);
                    }
                }
            }
            
            return result.success;
        } catch (error) {
            this.printResult(serviceName, 'Download', {
                success: false,
                message: error.message
            });
            return false;
        }
    }

    /**
     * Test shareable URL creation
     */
    async testShareableUrl(serviceName, service) {
        if (!this.results[serviceName] || !this.results[serviceName].remoteName) {
            console.log(`Skipping shareable URL test for ${serviceName} - no uploaded file`);
            return false;
        }

        console.log(`Testing shareable URL creation for ${serviceName}...`);
        
        try {
            const { remoteName } = this.results[serviceName];
            const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now
            
            const result = await service.createShareableUrl(remoteName, expiresAt);
            this.printResult(serviceName, 'Shareable URL', result);
            
            if (result.success) {
                console.log(`  Shareable URL: ${result.url}`);
                console.log(`  Expires at: ${result.expiresAt}`);
            }
            
            return result.success;
        } catch (error) {
            this.printResult(serviceName, 'Shareable URL', {
                success: false,
                message: error.message
            });
            return false;
        }
    }

    /**
     * Sanitize configuration for display (hide sensitive data)
     */
    sanitizeConfigForDisplay(config) {
        const sanitized = { ...config };
        
        // Hide sensitive fields
        const sensitiveFields = ['accessKey', 'secretKey', 'connectionString', 'serviceAccountKey'];
        sensitiveFields.forEach(field => {
            if (sanitized[field]) {
                const value = sanitized[field].toString();
                if (value.length > 8) {
                    sanitized[field] = value.substring(0, 8) + '...[REDACTED]';
                } else {
                    sanitized[field] = '[REDACTED]';
                }
            }
        });
        
        return sanitized;
    }

    /**
     * Test a single service
     */
    async testService(serviceName, config) {
        this.printSubHeader(`Testing ${serviceName.toUpperCase()}`);
        
        console.log(`Configuration:`, JSON.stringify(this.sanitizeConfigForDisplay(config), null, 2));
        
        try {
            const service = this.createService(serviceName, config);
            
            // Test connection
            const connectionSuccess = await this.testConnection(serviceName, service);
            if (!connectionSuccess) {
                console.log(`❌ Skipping further tests for ${serviceName} due to connection failure`);
                return false;
            }
            
            // Test upload
            const uploadSuccess = await this.testUpload(serviceName, service);
            
            // Test listing files
            await this.testListFiles(serviceName, service);
            
            // Test download (only if upload succeeded)
            if (uploadSuccess) {
                await this.testDownload(serviceName, service);
                await this.testShareableUrl(serviceName, service);
            }
            
            return true;
        } catch (error) {
            console.log(`❌ Failed to test ${serviceName}: ${error.message}`);
            return false;
        }
    }

    /**
     * Run all tests
     */
    async runTests() {
        this.printHeader('ZenTransfer Cloud Services Test Suite');
        
        // Check if test file exists
        if (!fs.existsSync(this.testFile)) {
            console.log(`❌ Test file ${this.testFile} not found!`);
            console.log('Please ensure the zentransfer-desktop.yml file exists in the current directory.');
            return;
        }
        
        const testFileStats = fs.statSync(this.testFile);
        console.log(`📁 Test file: ${this.testFile} (${testFileStats.size} bytes)`);
        console.log(`🗂️  Temp directory: ${this.tempDir}`);
        
        // Show loaded configurations
        const enabledServices = Object.keys(TEST_CONFIGURATIONS);
        if (enabledServices.length === 0) {
            console.log('\n❌ No enabled cloud services found in config.json');
            console.log('Please ensure config.json exists and has enabled cloud services.');
            return;
        }
        
        console.log(`\n📝 Loaded ${enabledServices.length} enabled service(s) from config.json:`);
        enabledServices.forEach(service => {
            console.log(`  - ${service}`);
        });
        
        const results = {};
        
        // Test each service
        for (const [serviceName, config] of Object.entries(TEST_CONFIGURATIONS)) {
            try {
                const success = await this.testService(serviceName, config);
                results[serviceName] = success;
            } catch (error) {
                console.log(`❌ Unexpected error testing ${serviceName}: ${error.message}`);
                results[serviceName] = false;
            }
        }
        
        // Print summary
        this.printHeader('Test Summary');
        console.log('Service Test Results:');
        
        for (const [serviceName, success] of Object.entries(results)) {
            const status = success ? '✅ PASSED' : '❌ FAILED';
            console.log(`  ${serviceName.padEnd(15)} ${status}`);
        }
        
        const totalTests = Object.keys(results).length;
        const passedTests = Object.values(results).filter(Boolean).length;
        
        console.log(`\n📊 Overall: ${passedTests}/${totalTests} services passed`);
        
        if (passedTests === totalTests) {
            console.log('🎉 All tests passed!');
        } else {
            console.log('⚠️  Some tests failed. Check the logs above for details.');
        }
        
        // Cleanup
        this.cleanup();
    }

    /**
     * Clean up temporary files
     */
    cleanup() {
        try {
            const files = fs.readdirSync(this.tempDir);
            files.forEach(file => {
                const filePath = path.join(this.tempDir, file);
                fs.unlinkSync(filePath);
            });
            console.log(`\n🧹 Cleaned up ${files.length} temporary files`);
        } catch (error) {
            console.log(`⚠️  Cleanup warning: ${error.message}`);
        }
    }
}

// Run the tests
async function main() {
    const tester = new CloudServiceTester();
    await tester.runTests();
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Run the main function
main().catch(error => {
    console.error('Test script failed:', error);
    process.exit(1);
}); 