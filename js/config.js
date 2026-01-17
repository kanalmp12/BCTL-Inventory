// config.js - Configuration file for API endpoints
const CONFIG = {
    // PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL HERE
    API_URL: 'https://script.google.com/macros/s/AKfycbwmRSjPGT9dfSLIqGVcmXyeTqUYRaG4hD8H53OQLR1iY5h2ciyDU9UBTo6dIzBmOfZmpg/exec',

    // Set to false to use the real Google Sheets API
    USE_MOCK_API: false,

    // Timeout for API requests (in milliseconds)
    REQUEST_TIMEOUT: 10000,

    // Local storage keys
    USER_ID_KEY: 'toolCribUserId',
    USER_INFO_KEY: 'toolCribUserInfo',

    // LINE LIFF ID
    LIFF_ID: '2008523876-e0vK2yJL' // Replace with your LIFF ID
};

// Export CONFIG for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}