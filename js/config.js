// config.js - Configuration file for API endpoints
const CONFIG = {
    // PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL HERE
    API_URL: 'https://script.google.com/macros/s/AKfycby54KvJdYqJ48YLe7IZrvSBYgT2-GvHjFdHMV8809ltIxJE2F-0tAGyZFHBqrg077UwEA/exec',

    // Set to false to use the real Google Sheets API
    USE_MOCK_API: false,

    // Timeout for API requests (in milliseconds)
    REQUEST_TIMEOUT: 10000,

    // Local storage keys
    USER_ID_KEY: 'toolCribUserId',
    USER_INFO_KEY: 'toolCribUserInfo',

    // LINE LIFF ID
    LIFF_ID: '2008523876-e0vK2yJL', // Replace with your LIFF ID

    // Admin Session Key
    SESSION_KEY: 'bctl_admin_session'
};

// Export CONFIG for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}