// api.js - API functions for interacting with the backend

// Mock data storage (Fallback)
let mockTools = [
    { toolId: "T001", toolName: "Makita Cordless Drill 18V", availableQty: 3, location: "Cabinet A-12", status: "Available", unit: "เครื่อง" },
    { toolId: "T002", toolName: "Fluke Digital Multimeter", availableQty: 1, location: "Cabinet B-05", status: "Available", unit: "เครื่อง" },
    { toolId: "T003", toolName: "Angle Grinder 4.5\"", availableQty: 0, location: "Cabinet C-08", status: "Borrowed", unit: "เครื่อง" },
    { toolId: "T004", toolName: "Socket Set Metric", availableQty: 2, location: "Cabinet D-15", status: "Available", unit: "ชุด" },
    { toolId: "T005", toolName: "Welding Mask", availableQty: 0, location: "Safety Station", status: "Overdue", unit: "อัน" },
    { toolId: "T006", toolName: "Hammer Drill 20V", availableQty: 0, location: "Cabinet A-03", status: "Overdue", unit: "เครื่อง" }
];
let mockUsers = [];
let mockTransactions = [];

/**
 * Simulate network delay for mock
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Helper to call Google Apps Script
 */
async function callGoogleScript(action, payload = {}) {
    if (CONFIG.USE_MOCK_API || CONFIG.API_URL.includes('YOUR_SCRIPT_ID')) {
        console.warn('Using MOCK API. Please configure API_URL in config.js');
        return callMockApi(action, payload);
    }

    try {
        const body = JSON.stringify({ action, ...payload });
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: body,
            // Using text/plain to avoid CORS preflight (OPTIONS) requests which GAS doesn't handle
            headers: {
                'Content-Type': 'text/plain;charset=utf-8', 
            },
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        if (result.error) {
            throw new Error(result.error);
        }
        return result;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

/**
 * Mock API Router
 */
async function callMockApi(action, payload) {
    await delay(500);
    switch (action) {
        case 'getTools':
            return { tools: [...mockTools] };
        case 'checkUser':
            const user = mockUsers.find(u => u.userId === payload);
            return { exists: !!user, user: user };
        case 'registerUser':
             const existingIdx = mockUsers.findIndex(u => u.userId === payload.userId);
             if (existingIdx !== -1) mockUsers[existingIdx] = { ...payload };
             else mockUsers.push({ ...payload });
             return { success: true };
        case 'borrowTool':
             const tIdx = mockTools.findIndex(t => t.toolId === payload.toolId);
             if (tIdx === -1) throw new Error('Tool not found');
             if (mockTools[tIdx].availableQty < payload.quantity) throw new Error('Not enough stock');
             
             mockTools[tIdx].availableQty -= payload.quantity;
             mockTools[tIdx].status = mockTools[tIdx].availableQty > 0 ? 'Available' : 'Borrowed';
             
             mockTransactions.push({
                toolId: payload.toolId,
                userId: payload.userId,
                quantity: payload.quantity,
                status: 'Borrowed',
                timestamp: new Date()
             });
             return { success: true };
        case 'returnTool':
             const rIdx = mockTools.findIndex(t => t.toolId === payload.toolId);
             if (rIdx === -1) throw new Error('Tool not found');
             
             mockTools[rIdx].availableQty += 1; // Assuming returning 1 unit at a time or strictly managing per item
             mockTools[rIdx].status = 'Available';
             
             // Update transaction
             const transIdx = mockTransactions.findIndex(t => t.toolId === payload.toolId && t.userId === payload.userId && t.status === 'Borrowed');
             if (transIdx !== -1) {
                 // In a real app we might mark it returned, here we just remove it or mark returned to clear "active" list
                 mockTransactions.splice(transIdx, 1);
             }
             return { success: true };
        case 'getUserActiveBorrows':
             const borrows = mockTransactions.filter(t => t.userId === payload.userId && t.status === 'Borrowed');
             return { borrows };
        default:
            throw new Error('Mock Action not found');
    }
}

/**
 * Fetch all tools
 */
async function getTools() {
    const result = await callGoogleScript('getTools');
    // Adapt result if needed (GAS returns {tools: []})
    return result.tools || result; 
}

/**
 * Get active borrows for a user
 */
async function getUserActiveBorrows(userId) {
    return await callGoogleScript('getUserActiveBorrows', { userId });
}

/**
 * Register a new user
 */
async function registerUser(userData) {
    return await callGoogleScript('registerUser', userData);
}

/**
 * Check if a user exists
 */
async function checkUserExists(userId) {
    const result = await callGoogleScript('checkUser', { userId });
    return result.exists;
}

/**
 * Borrow a tool
 */
async function borrowTool(borrowData) {
    return await callGoogleScript('borrowTool', borrowData);
}

/**
 * Return a tool
 */
async function returnTool(returnData) {
    return await callGoogleScript('returnTool', returnData);
}

// For non-module environments
if (typeof module === 'undefined') {
    window.apiFunctions = {
        getTools,
        getUserActiveBorrows,
        registerUser,
        checkUserExists,
        borrowTool,
        returnTool
    };
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getTools,
        getUserActiveBorrows,
        registerUser,
        checkUserExists,
        borrowTool,
        returnTool
    };
}
