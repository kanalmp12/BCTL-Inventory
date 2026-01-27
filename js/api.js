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
let mockUsers = [
    { userId: 'admin01', fullName: 'Super Admin', department: 'IT', cohort: 'Staff', role: 'admin', pictureUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDuyniwJBrmKrULjsWGIvIXwaqeDNoXO7Ocy3MOlwn4apu68QNbYqbKI4exb2cmw9WxtV7ck2tU4-0E8kzHhqJt-Shr-ls6Oeh8tL3mrxxu9cLOncEeiUVl1Q7yy0ZsdXSEn-BBBTEgn5LQsyrmPqhUyeb3IVX2-RGinTRvE_1FNEKm9CL8dDbFvgxNqwkoR0VjFX-LOlsEl1yBaG_GrMQXikkQ5Sm1dqQQ0g6DHK9Zaog1kwG0dFSP__0JOhqZ9f3Der2fc7AjAIWO' }
];
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
            const user = mockUsers.find(u => u.userId === payload.userId);
            if (user && !user.role) user.role = 'user';
            return { exists: !!user, user: user };
        case 'registerUser':
             const existingIdx = mockUsers.findIndex(u => u.userId === payload.userId);
             if (existingIdx !== -1) mockUsers[existingIdx] = { ...payload };
             else mockUsers.push({ ...payload });
             return { success: true };
        case 'updateUserPin':
             const uIdx = mockUsers.findIndex(u => u.userId === payload.userId);
             if (uIdx !== -1) {
                 mockUsers[uIdx].pin = payload.pin;
                 return { success: true };
             }
             return { success: false, error: 'User not found' };
        case 'borrowTool':
        case 'borrowToolBatch':
             // Handle both legacy and batch in mock
             const borrowItems = payload.items || [{...payload}];
             
             for (const item of borrowItems) {
                 const tIdx = mockTools.findIndex(t => t.toolId === item.toolId);
                 if (tIdx === -1) throw new Error(`Tool not found: ${item.toolId}`);
                 
                 // Handle unlimited stock
                 if (mockTools[tIdx].availableQty !== 'จำนวนมาก') {
                     if (mockTools[tIdx].availableQty < item.quantity) throw new Error(`Not enough stock for ${item.toolId}`);
                     mockTools[tIdx].availableQty -= item.quantity;
                     // Only update status if not unlimited
                     mockTools[tIdx].status = mockTools[tIdx].availableQty > 0 ? 'Available' : 'Borrowed';
                 }
                 
                 mockTransactions.push({
                    toolId: item.toolId,
                    userId: payload.userId, // userId is top-level in batch
                    quantity: item.quantity,
                    status: 'Borrowed',
                    timestamp: new Date()
                 });
             }
             return { success: true };

        case 'returnTool':
        case 'returnToolBatch':
             // Handle both legacy and batch in mock
             const returnItems = payload.items || [{...payload}];

             for (const item of returnItems) {
                 const rIdx = mockTools.findIndex(t => t.toolId === item.toolId);
                 if (rIdx === -1) throw new Error(`Tool not found: ${item.toolId}`);
                 
                 // Handle unlimited stock (do not increment)
                 if (mockTools[rIdx].availableQty !== 'จำนวนมาก') {
                     mockTools[rIdx].availableQty += 1; // Simplify mock return to +1 per call or need complex logic? Batch mock simplification: just +1 per item instance
                     mockTools[rIdx].status = 'Available';
                 }
                 
                 // Update transaction
                 const transIdx = mockTransactions.findIndex(t => t.toolId === item.toolId && t.userId === payload.userId && t.status === 'Borrowed');
                 if (transIdx !== -1) {
                     mockTransactions.splice(transIdx, 1);
                 }
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
 * Check if a user exists and get their data
 */
async function checkUserExists(userId) {
    const result = await callGoogleScript('checkUser', { userId });
    return result; // Return full result { exists: bool, user: {...} }
}

/**
 * Borrow a tool (Legacy Wrapper)
 */
async function borrowTool(borrowData) {
    // Wrap single item as batch
    const batchData = {
        userId: borrowData.userId,
        reason: borrowData.reason,
        expectedReturnDate: borrowData.expectedReturnDate,
        items: [{
            toolId: borrowData.toolId,
            quantity: borrowData.quantity,
            imageBase64: borrowData.imageBase64,
            imageName: borrowData.imageName
        }]
    };
    return await callGoogleScript('borrowToolBatch', batchData);
}

/**
 * Borrow multiple tools (Batch)
 * @param {Object} batchData - { userId, reason, expectedReturnDate, items: [{toolId, quantity, imageBase64, imageName}] }
 */
async function borrowToolBatch(batchData) {
    return await callGoogleScript('borrowToolBatch', batchData);
}

/**
 * Return a tool (Legacy Wrapper)
 */
async function returnTool(returnData) {
    // Wrap single item as batch
    const batchData = {
        userId: returnData.userId,
        items: [{
            toolId: returnData.toolId,
            condition: returnData.condition,
            notes: returnData.notes,
            imageBase64: returnData.imageBase64,
            imageName: returnData.imageName
        }]
    };
    return await callGoogleScript('returnToolBatch', batchData);
}

/**
 * Return multiple tools (Batch)
 * @param {Object} batchData - { userId, items: [{toolId, condition, notes, imageBase64, imageName}] }
 */
async function returnToolBatch(batchData) {
    return await callGoogleScript('returnToolBatch', batchData);
}

/**
 * Update user PIN
 */
async function updateUserPin(userId, pin) {
    return await callGoogleScript('updateUserPin', { userId, pin });
}

// For non-module environments
if (typeof module === 'undefined') {
    window.apiFunctions = {
        getTools,
        getUserActiveBorrows,
        registerUser,
        checkUserExists,
        borrowTool,
        borrowToolBatch,
        returnTool,
        returnToolBatch,
        updateUserPin
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
        borrowToolBatch,
        returnTool,
        returnToolBatch,
        updateUserPin
    };
}
