// config.js - Configuration file for API endpoints
const CONFIG = {
    // PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL HERE
    API_URL: 'https://script.google.com/macros/s/AKfycbyVshz5IexWQ_Kyq1M1T6TzFGl2R-DHqilu30dYPpm3TCQdvnoyF4Gbn1PMiHOmF0YQqQ/exec',

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