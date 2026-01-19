// user.js - Functions for managing user ID and registration via LINE LIFF

let liffInitialized = false;

/**
 * Initialize LINE LIFF
 * @returns {Promise<boolean>} - True if initialized and logged in
 */
async function initLiff() {
    if (liffInitialized) return liff.isLoggedIn();

    try {
        if (!CONFIG.LIFF_ID || CONFIG.LIFF_ID === 'YOUR_LIFF_ID_HERE') {
            console.warn('LIFF_ID is not configured. Using fallback ID generation.');
            return false;
        }

        await liff.init({ liffId: CONFIG.LIFF_ID });
        liffInitialized = true;

        if (liff.isLoggedIn()) {
            const profile = await liff.getProfile();
            localStorage.setItem(CONFIG.USER_ID_KEY, profile.userId);
            // Optionally update user info with display name if not set
            const currentInfo = getUserInfo();
            if (!currentInfo) {
                // If we don't have local info, we might want to temporarily save display name
                // but we wait for registration to finalize details.
            }
            return true;
        }
        return false;
    } catch (error) {
        console.error('LIFF Initialization failed:', error);
        return false;
    }
}

/**
 * Login with LINE
 */
function loginWithLine() {
    if (!liffInitialized) {
        console.error('LIFF not initialized');
        return;
    }
    if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: window.location.href });
    }
}

/**
 * Logout from LINE
 */
function logoutFromLine() {
    if (liffInitialized && liff.isLoggedIn()) {
        liff.logout();
        localStorage.removeItem(CONFIG.USER_ID_KEY);
        localStorage.removeItem(CONFIG.USER_INFO_KEY);
        window.location.reload();
    }
}

/**
 * Generate a unique user ID (Fallback)
 * @returns {string} - Generated user ID
 */
function generateUserId() {
    // Create a timestamp-based ID with random component
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substr(2, 5);
    return `user_${timestamp}${randomPart}`;
}

/**
 * Get user ID from localStorage or generate a new one
 * @returns {string} - User ID
 */
function getUserId() {
    // 1. If LIFF is initialized and logged in, we trust the stored ID (set by initLiff)
    if (typeof liff !== 'undefined' && liffInitialized && liff.isLoggedIn()) {
        const userId = localStorage.getItem(CONFIG.USER_ID_KEY);
        if (userId) return userId;
    }

    // 2. If LIFF is configured (Production) but we are NOT logged in:
    // Return null. Do NOT return a stale ID from localStorage.
    if (CONFIG.LIFF_ID && CONFIG.LIFF_ID !== 'YOUR_LIFF_ID_HERE') {
        return null;
    }

    // 3. Fallback (Only for Dev/Local mode where LIFF_ID is missing)
    let userId = localStorage.getItem(CONFIG.USER_ID_KEY);
    
    if (!userId) {
        userId = generateUserId();
        localStorage.setItem(CONFIG.USER_ID_KEY, userId);
    }
    
    return userId;
}

/**
 * Save user info to localStorage
 * @param {Object} userInfo - User information (name, department, cohort, etc.)
 */
function saveUserInfo(userInfo) {
    const userId = getUserId();
    const dataToSave = {
        ...userInfo,
        userId: userId
    };
    localStorage.setItem(CONFIG.USER_INFO_KEY, JSON.stringify(dataToSave));
}

/**
 * Get user info from localStorage
 * @returns {Object|null} - User information or null if not found
 */
function getUserInfo() {
    const userInfoStr = localStorage.getItem(CONFIG.USER_INFO_KEY);
    return userInfoStr ? JSON.parse(userInfoStr) : null;
}

/**
 * Check if user is registered
 * @returns {Promise<boolean>} - True if user is registered, false otherwise
 */
async function isUserRegistered() {
    // Ensure LIFF is initialized to get the correct User ID first
    await initLiff();

    const userId = getUserId();
    if (!userId) return false;

    try {
        const result = await checkUserExists(userId);
        
        if (result.exists && result.user) {
            // Save user info found in backend to local storage
            saveUserInfo(result.user);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Error checking user registration:', error);
        // If API fails, check if we have local info
        return getUserInfo() !== null;
    }
}

/**
 * Register a new user
 * @param {Object} userData - User data (name, department)
 * @returns {Promise<Object>} - API response
 */
async function registerNewUser(userData) {
    const userId = getUserId();
    const userDataWithId = {
        ...userData,
        userId: userId
    };
    
    try {
        const response = await registerUser(userDataWithId);
        saveUserInfo(userData);
        return response;
    } catch (error) {
        console.error('Registration failed:', error);
        throw error;
    }
}

/**
 * Update the UI with user information
 */
async function updateUserUI() {
    const userInfo = getUserInfo();
    const userNameElement = document.getElementById('userName');
    const userProfileImg = document.getElementById('userProfileImg');
    const userInfoContainer = document.getElementById('userInfoContainer');
    const loginTriggerBtn = document.getElementById('loginTriggerBtn');
    
    // Check if user is logged in (either via local storage or LIFF)
    const isLoggedIn = (liffInitialized && liff.isLoggedIn()) || !!userInfo;

    if (isLoggedIn) {
        if (userInfoContainer) userInfoContainer.classList.remove('hidden');
        if (loginTriggerBtn) loginTriggerBtn.classList.add('hidden');

        if (userInfo && userNameElement) {
            userNameElement.textContent = userInfo.fullName || 'User';
            
            // Handle Admin Button
            const userDropdown = document.getElementById('userDropdown');
            const logoutBtn = document.getElementById('logoutBtn');
            const existingAdminBtn = document.getElementById('adminPortalBtn');

            if (userInfo.role === 'admin') {
                if (!existingAdminBtn && logoutBtn) {
                    const adminBtn = document.createElement('a');
                    adminBtn.id = 'adminPortalBtn';
                    adminBtn.href = './admin/index.html';
                    adminBtn.className = 'dropdown-item flex items-center gap-2';
                    adminBtn.innerHTML = `
                        <span class="material-symbols-outlined">admin_panel_settings</span>
                        Admin Portal
                    `;
                    logoutBtn.parentNode.insertBefore(adminBtn, logoutBtn);
                }
            } else if (existingAdminBtn) {
                existingAdminBtn.remove();
            }
        } else if (liffInitialized && liff.isLoggedIn()) {
            // If registered but no local info
            try {
                const profile = await liff.getProfile();
                if (userNameElement) userNameElement.textContent = profile.displayName;
            } catch (e) {
                 if (userNameElement) userNameElement.textContent = 'User';
            }
        } else {
            if (userNameElement) userNameElement.textContent = 'User';
        }

        // Update Profile Image if logged in via LIFF
        if (liffInitialized && liff.isLoggedIn()) {
            try {
                const profile = await liff.getProfile();
                if (userProfileImg && profile.pictureUrl) {
                    userProfileImg.src = profile.pictureUrl;
                }
            } catch (e) {
                console.error('Error getting profile image:', e);
            }
        }
    } else {
        // Not logged in
        if (userInfoContainer) userInfoContainer.classList.add('hidden');
        if (loginTriggerBtn) loginTriggerBtn.classList.remove('hidden');
    }
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initLiff,
        loginWithLine,
        logoutFromLine,
        getUserId,
        saveUserInfo,
        getUserInfo,
        isUserRegistered,
        registerNewUser,
        updateUserUI
    };
}