/**
 * MinIO Upload Service
 * Handles uploads to MinIO (S3-compatible storage)
 */

const { GenericS3Service } = require('./GenericS3Service.js');

class MinioService extends GenericS3Service {
    constructor(settings = {}) {
        super(settings);
    }

    getServiceName() {
        return 'MinIO';
    }
}

module.exports = { MinioService }; 