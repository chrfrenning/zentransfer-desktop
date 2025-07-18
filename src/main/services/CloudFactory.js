const { AWSService } = require('../workers/clouds/AWSService.js');
const { AzureService } = require('../workers/clouds/AzureService.js');
const { GoogleService } = require('../workers/clouds/GoogleService.js');
const { MinioService } = require('../workers/clouds/MinioService.js');
const { ZenTransferService } = require('../workers/clouds/ZenTransferService.js');

class CloudFactory {
    constructor() {
    }

    /**
     * Returns a list of supported cloud service types.
     * This is used for populating service selectors and validation.
     * @returns {string[]}
     */
    static listCloudServices() {
        return [
            'zentransfer',
            'aws-s3',
            'azure-blob',
            'gcp-storage',
            'minio'
        ];
    }

    static getCloudService(serviceType, settings) {
        switch (serviceType) {
            case 'aws-s3':
                return new AWSService(settings);
            case 'azure-blob':
                return new AzureService(settings);
            case 'gcp-storage':
                return new GoogleService(settings);
            case 'minio':
                return new MinioService(settings);
            case 'zentransfer':
                return new ZenTransferService(settings);
        }
    }
}

module.exports = { CloudFactory };
