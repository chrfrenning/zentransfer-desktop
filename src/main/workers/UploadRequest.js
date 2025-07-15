const { v4: uuidv4 } = require('uuid');

class UploadRequest {
    /**
     * Create a new UploadJob
     * @param {string} fileName - The name of the file to upload
     * @param {string} serviceName - The name of the cloud service (e.g., 'ZenTransfer', 'AWS S3')
     * @param {object} serviceConfig - The configuration object for the target service
     * @param {object} sessionInfo - The session information (e.g., auth token, user/session context)
     */
    constructor(jobId = uuidv4(), fileName, serviceName, serviceConfig, sessionInfo) {
        this.jobId = jobId;
        this.fileName = fileName;
        this.serviceName = serviceName;
        this.serviceConfig = serviceConfig;
        this.sessionInfo = sessionInfo;
    }
}

module.exports = { UploadRequest };
