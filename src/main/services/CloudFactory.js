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
}

module.exports = { CloudFactory };
