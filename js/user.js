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
    }
    localStorage.removeItem(CONFIG.USER_ID_KEY);
    localStorage.removeItem(CONFIG.USER_INFO_KEY);
    window.location.reload();
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
    // We SHOULD check localStorage as a fallback to allow session persistence (e.g., if LIFF init failed or checking status)
    if (CONFIG.LIFF_ID && CONFIG.LIFF_ID !== 'YOUR_LIFF_ID_HERE') {
        const storedId = localStorage.getItem(CONFIG.USER_ID_KEY);
        if (storedId) return storedId;
        // Only return null if we truly have no ID
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
 * Show skeleton loading for user profile
 */
function showUserSkeleton() {
    const userInfoContainer = document.getElementById('userInfoContainer');
    const loginTriggerBtn = document.getElementById('loginTriggerBtn');
    const userProfileImgs = document.querySelectorAll('.profile-img');
    const userNameElement = document.getElementById('userName');

    if (loginTriggerBtn) loginTriggerBtn.classList.add('hidden');
    if (userInfoContainer) userInfoContainer.classList.remove('hidden');

    userProfileImgs.forEach(img => {
        img.classList.add('skeleton', 'skeleton-avatar');
    });
    
    if (userNameElement) {
        userNameElement.textContent = ''; // Clear text
        userNameElement.classList.add('skeleton', 'skeleton-name');
    }
}

/**
 * Update the UI with user information
 */
async function updateUserUI() {
    const userInfo = getUserInfo();
    const userNameElement = document.getElementById('userName');
    const userProfileImgs = document.querySelectorAll('.profile-img');
    const userInfoContainer = document.getElementById('userInfoContainer');
    const loginTriggerBtn = document.getElementById('loginTriggerBtn');
    
    // Remove skeleton classes
    userProfileImgs.forEach(img => img.classList.remove('skeleton', 'skeleton-avatar'));
    if (userNameElement) userNameElement.classList.remove('skeleton', 'skeleton-name');

    // Check if user is logged in (either via local storage or LIFF)
    const isLoggedIn = (liffInitialized && liff.isLoggedIn()) || !!userInfo;

    if (isLoggedIn) {
        if (userInfoContainer) userInfoContainer.classList.remove('hidden');
        if (loginTriggerBtn) loginTriggerBtn.classList.add('hidden');

        if (userInfo && userNameElement) {
            userNameElement.textContent = userInfo.fullName || 'User';
            
            // Handle Admin Button & Visuals
            const userDropdown = document.getElementById('userDropdown');
            const logoutBtn = document.getElementById('logoutBtn');
            const existingAdminBtn = document.getElementById('adminPortalBtn');
            const adminCrown = document.getElementById('adminCrown');

            if (userInfo.role === 'admin') {
                // 1. Add Admin Button
                if (!existingAdminBtn && logoutBtn) {
                    const adminBtn = document.createElement('a');
                    adminBtn.id = 'adminPortalBtn';
                    adminBtn.href = './admin/index.html';
                    adminBtn.className = 'dropdown-item flex items-center gap-2';
                    adminBtn.innerHTML = `
                        <span class="material-symbols-outlined">admin_panel_settings</span>
                        ${t('menu_admin')}
                    `;
                    logoutBtn.parentNode.insertBefore(adminBtn, logoutBtn);
                }

                // 2. Add Gold Border & Crown
                userProfileImgs.forEach(img => img.classList.add('admin-gold-border'));
                if (adminCrown) adminCrown.classList.remove('hidden');

            } else {
                // Not admin
                if (existingAdminBtn) existingAdminBtn.remove();
                userProfileImgs.forEach(img => img.classList.remove('admin-gold-border'));
                if (adminCrown) adminCrown.classList.add('hidden');
            }
        } else if (liffInitialized && liff.isLoggedIn()) {
            // If registered but no local info
            try {
                const profile = await liff.getProfile();
                if (userNameElement) userNameElement.textContent = profile.displayName;
                
                // Cleanup Admin UI if falling back to basic LINE profile
                const existingAdminBtn = document.getElementById('adminPortalBtn');
                const adminCrown = document.getElementById('adminCrown');
                
                if (existingAdminBtn) existingAdminBtn.remove();
                userProfileImgs.forEach(img => img.classList.remove('admin-gold-border'));
                if (adminCrown) adminCrown.classList.add('hidden');
                
            } catch (e) {
                 if (userNameElement) userNameElement.textContent = t('status_available') === 'Available' ? 'User' : 'ผู้ใช้งาน';
            }
        } else {
            if (userNameElement) userNameElement.textContent = t('status_available') === 'Available' ? 'User' : 'ผู้ใช้งาน';
        }

        // Update Profile Image if logged in via LIFF
        if (liffInitialized && liff.isLoggedIn()) {
            try {
                const profile = await liff.getProfile();
                if (profile.pictureUrl) {
                    userProfileImgs.forEach(img => img.src = profile.pictureUrl);
                }
            } catch (e) {
                console.error('Error getting profile image:', e);
            }
        }

        // Handle Long Name Animation (Check overflow)
        setTimeout(() => {
            const wrapper = document.getElementById('userNameWrapper');
            const nameSpan = document.getElementById('userName');
            
            if (wrapper && nameSpan) {
                // Reset first to get natural width
                wrapper.classList.remove('is-long');
                nameSpan.style.removeProperty('--scroll-dist');
                
                // Check if content overflows container
                if (nameSpan.scrollWidth > wrapper.clientWidth) {
                    const overflowAmount = nameSpan.scrollWidth - wrapper.clientWidth;
                    // Add a small buffer (e.g., 5px) to ensure it doesn't feel tight
                    const scrollDist = overflowAmount + 5; 
                    
                    nameSpan.style.setProperty('--scroll-dist', `-${scrollDist}px`);
                    wrapper.classList.add('is-long');
                }
            }
        }, 100);

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
        updateUserUI,
        showUserSkeleton
    };
}