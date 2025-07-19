class DateFormatter {
    constructor() {
    }

    /**
     * Returns a list of supported cloud service types.
     * This is used for populating service selectors and validation.
     * @returns {string[]}
     */
    static listDateFormats() {
        return [
            'YYYY',
            'YYYY/MM',
            'YYYY/MM/DD',
            'YYYY/YYYY-MM/DD',
            'YYYY/YYYY-MM-DD',

            'YYYY-MM',
            'YYYY-MM-DD',

            'YYYY/mmm',
            'YYYY/mmm/dd',

            'YYYYMMDD',
            'YYYY mmm dd',
        ];
    }

    static formatDate(date, dateFormat) {
        return date.toISOString().split('T')[0];
    }
}

module.exports = { DateFormatter };