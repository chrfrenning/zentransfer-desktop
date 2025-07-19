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

            'YYYY/mmmm',
            'YYYY/mmmm/dd',

            'YYYY/mmm',
            'YYYY/mmm/dd',
            'YYYY/mmm/dd (dn)',

            'YYYY/lmmm',
            'YYYY/lmmm/dd',
            'YYYY/lmmm/dd (ldn)',

            'YYYYMMDD',
            'YYYY mmm dd',

            'MM',
            'MM/DD',
            'MM-DD',

            'DD',
            'dn',
            'ldn'
        ];
    }

    static formatDate(date, dateFormat) {
        // Extract date components
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // getMonth() returns 0-11, so add 1
        const day = date.getDate();
        
        // Setup formatting variables
        const YYYY = year.toString();
        const YY = (year - 2000).toString().padStart(2, '0');
        const MM = month.toString().padStart(2, '0');
        const DD = day.toString().padStart(2, '0');
        const dd = day.toString(); // day without leading zero
        const mmmm = date.toLocaleDateString('en-US', { month: 'long' });
        const mmm = date.toLocaleDateString('en-US', { month: 'short' });
        const lmmmm = date.toLocaleDateString(undefined, { month: 'long' });
        const lmmm = date.toLocaleDateString(undefined, { month: 'short' });
        const dn = date.toLocaleDateString('en-US', { weekday: 'long' });
        const ldn = date.toLocaleDateString(undefined, { weekday: 'long' });
        
        // Perform string replacement
        let formattedDate = dateFormat
            .replace(/YYYY/g, YYYY)
            .replace(/YY/g, YY)
            .replace(/MM/g, MM)
            .replace(/DD/g, DD)
            .replace(/ldn/g, ldn)
            .replace(/dn/g, dn)
            .replace(/lmmmm/g, lmmmm)
            .replace(/lmmm/g, lmmm)
            .replace(/mmmm/g, mmmm)
            .replace(/mmm/g, mmm)
            .replace(/dd/g, dd);
            
        return formattedDate;
    }

    static test() {
        const date = new Date();
        console.log(`Testing date: ${date}`);

        for ( const format of this.listDateFormats() ) {
            //console.log(`${format} -> ${this.formatDate(date, format)}`);
            console.log(`${this.formatDate(date, format)}`);
        }
    }
}

module.exports = { DateFormatter };