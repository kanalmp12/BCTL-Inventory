// main.js - Main application logic

// Global variables
let currentUser = null;
let tools = [];
let filteredTools = [];

// DOM Elements
const elements = {
    toolsGrid: document.getElementById('toolsGrid'),
    searchInput: document.getElementById('searchInput'),
    filterBtns: document.querySelectorAll('.filter-btn'),
    registrationModal: document.getElementById('registrationModal'),
    borrowModal: document.getElementById('borrowModal'),
    returnModal: document.getElementById('returnModal'),
    messageToast: document.getElementById('messageToast'),
    loadingOverlay: document.getElementById('loadingOverlay')
};

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    showLoading(true);
    
    try {
        // Init LIFF and check status (silently)
        await initLiff();
        
        // Load user info (if any)
        currentUser = getUserInfo();
        
        // Update UI (Login btn vs User info)
        updateUserUI();
        
        // Always load tools
        await loadTools();

        // If user is logged in via LINE but not registered in our system (no local user info),
        // check registration status with backend. If not registered, show registration modal.
        if (liffInitialized && liff.isLoggedIn() && !currentUser) {
             const isRegistered = await isUserRegistered();
             if (!isRegistered) {
                 showRegistrationModal();
             } else {
                 // Fetch user info from backend if registered but not in local storage
                 // For now, we rely on local storage or just let them re-register/update profile
                 // Ideally, we should have a getUserProfile(userId) API.
                 // As a fallback, we let them browse.
             }
        }
        
    } catch (error) {
        console.error('Initialization error:', error);
        showMessage('Failed to initialize application. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
});

// Event Listeners
elements.searchInput?.addEventListener('input', handleSearch);
elements.filterBtns.forEach(btn => btn.addEventListener('click', handleFilterClick));

// Header Login Button
document.getElementById('loginTriggerBtn')?.addEventListener('click', showRegistrationModal);

// Modal close buttons
document.getElementById('closeRegistrationModal')?.addEventListener('click', hideRegistrationModal);
document.getElementById('closeBorrowModal')?.addEventListener('click', hideBorrowModal);
document.getElementById('closeReturnModal')?.addEventListener('click', hideReturnModal);

// LINE Login button
document.getElementById('lineLoginBtn')?.addEventListener('click', () => {
    if (typeof loginWithLine === 'function') {
        loginWithLine();
    } else {
        console.error('loginWithLine function not found');
    }
});

// User Dropdown & Logout
const userInfoContainer = document.getElementById('userInfoContainer');
const userDropdown = document.getElementById('userDropdown');
const logoutBtn = document.getElementById('logoutBtn');

if (userInfoContainer && userDropdown) {
    userInfoContainer.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!userInfoContainer.contains(e.target)) {
            userDropdown.classList.add('hidden');
        }
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if (typeof logoutFromLine === 'function') {
            logoutFromLine();
        } else {
             console.error('logoutFromLine function not found');
             // Fallback
             localStorage.clear();
             window.location.reload();
        }
    });
}

// Form submissions
document.getElementById('registrationForm')?.addEventListener('submit', handleRegistrationSubmit);
document.getElementById('confirmBorrow')?.addEventListener('click', handleBorrowSubmit);
document.getElementById('confirmReturn')?.addEventListener('click', handleReturnSubmit);

// Cancel buttons
document.getElementById('cancelBorrow')?.addEventListener('click', hideBorrowModal);
document.getElementById('cancelReturn')?.addEventListener('click', hideReturnModal);

// Quantity controls for borrow modal
document.getElementById('decreaseQuantity')?.addEventListener('click', () => adjustQuantity(-1));
document.getElementById('increaseQuantity')?.addEventListener('click', () => adjustQuantity(1));

// Set today as default borrow date
document.getElementById('borrowDate').value = formatDate(new Date());

// Set default return date to tomorrow
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
document.getElementById('returnDate').value = formatDate(tomorrow);

/**
 * Load tools from the API and render them
 */
async function loadTools() {
    try {
        const [fetchedTools, userBorrows] = await Promise.all([
            getTools(),
            currentUser ? getUserActiveBorrows(currentUser.userId) : { borrows: [] }
        ]);
        
        const myBorrows = userBorrows.borrows || [];
        
        tools = fetchedTools.map(tool => {
            const borrow = myBorrows.find(b => b.toolId === tool.toolId);
            return {
                ...tool,
                myBorrowedQty: borrow ? borrow.quantity : 0
            };
        });

        filteredTools = [...tools];
        renderTools(filteredTools);
    } catch (error) {
        console.error('Error loading tools:', error);
        showMessage('Failed to load tools. Please try again.', 'error');
    }
}

/**
 * Render tools in the grid
 * @param {Array} toolsToRender - Array of tools to render
 */
function renderTools(toolsToRender) {
    if (!elements.toolsGrid) return;
    
    elements.toolsGrid.innerHTML = '';
    
    if (toolsToRender.length === 0) {
        elements.toolsGrid.innerHTML = '<p class="no-tools-message">No tools found</p>';
        return;
    }
    
    toolsToRender.forEach(tool => {
        const toolCard = createToolCard(tool);
        elements.toolsGrid.appendChild(toolCard);
    });
}

/**
 * Create a tool card element
 * @param {Object} tool - Tool object
 * @returns {HTMLElement} - Tool card element
 */
function createToolCard(tool) {
    const card = document.createElement('article');
    card.className = `tool-card ${getStatusClass(tool.status)}`;
    
    let actionButton = '';
    
    // Logic for buttons:
    // 1. If I have borrowed it, I see "Return".
    // 2. If I haven't borrowed it, but it's available, I see "Borrow".
    // 3. If I haven't borrowed it, and it's NOT available, I see "Out of Stock" (disabled).
    
    if (tool.myBorrowedQty > 0) {
        actionButton = `
            <button class="btn-return" data-tool-id="${tool.toolId}">
                <span class="material-symbols-outlined">keyboard_return</span>
                Return
            </button>
        `;
    } else if (tool.availableQty === 'จำนวนมาก' || tool.availableQty > 0) {
        actionButton = `
            <button class="btn-borrow" data-tool-id="${tool.toolId}">
                <span class="material-symbols-outlined">add_circle</span>
                Borrow
            </button>
        `;
    } else {
        actionButton = `
             <button class="btn-borrow" disabled style="background-color: var(--gray-medium); cursor: not-allowed;">
                 <span class="material-symbols-outlined">block</span>
                 Out of Stock
             </button>
        `;
    }

    // Image handling
    let imageContent = '';
    if (tool.imageUrl && tool.imageUrl.trim() !== '') {
        imageContent = `<img src="${tool.imageUrl}" alt="${tool.toolName}" style="width:100%; height:100%; object-fit:cover;">`;
    }

    card.innerHTML = `
        <div class="tool-card-content">
            <div class="tool-header">
                <div class="tool-image-placeholder" style="overflow:hidden;">${imageContent}</div>
                <div class="tool-info">
                    <h3 class="tool-name">${tool.toolName}</h3>
                    <p class="tool-id">ID: ${tool.toolId}</p>
                    <div class="availability-status">
                        <span class="status-badge ${getStatusClass(tool.status)}">
                            ${tool.status === 'Available' ? (tool.availableQty === 'จำนวนมาก' ? 'Available: จำนวนมาก' : `Available: ${tool.availableQty} ${tool.unit || 'Units'}`) : tool.status}
                        </span>
                    </div>
                </div>
            </div>
            
            <div class="tool-location">
                <span class="material-symbols-outlined">warehouse</span>
                <span>${tool.location}</span>
            </div>
            
            <div class="tool-actions">
                ${actionButton}
            </div>
        </div>
    `;
    
    // Add event listeners to the buttons
    const borrowBtn = card.querySelector('.btn-borrow');
    const returnBtn = card.querySelector('.btn-return');
    
    if (borrowBtn && !borrowBtn.disabled) {
        borrowBtn.addEventListener('click', () => {
            // Check authentication before allowing borrow
            if (!currentUser && !(typeof liff !== 'undefined' && liff.isLoggedIn && liff.isLoggedIn())) {
                showRegistrationModal();
            } else {
                showBorrowModal(tool);
            }
        });
    }
    
    if (returnBtn) {
        returnBtn.addEventListener('click', () => showReturnModal(tool));
    }
    
    return card;
}

/**
 * Get CSS class for status
 * @param {string} status - Tool status
 * @returns {string} - CSS class name
 */
function getStatusClass(status) {
    switch (status.toLowerCase()) {
        case 'available':
            return 'available';
        case 'borrowed':
            return 'borrowed';
        case 'overdue':
            return 'overdue';
        default:
            return 'available';
    }
}

/**
 * Handle search input
 */
function handleSearch() {
    const searchTerm = elements.searchInput.value.toLowerCase();
    
    filteredTools = tools.filter(tool => 
        tool.toolName.toLowerCase().includes(searchTerm) ||
        tool.toolId.toLowerCase().includes(searchTerm)
    );
    
    renderTools(filteredTools);
}

/**
 * Handle filter button click
 */
function handleFilterClick(event) {
    const filterValue = event.target.dataset.filter;
    
    // Update active button
    elements.filterBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filterValue);
    });
    
    // Filter tools based on selection
    if (filterValue === 'all') {
        filteredTools = [...tools];
    } else {
        filteredTools = tools.filter(tool => {
            if (filterValue === 'overdue') {
                return tool.status.toLowerCase() === 'overdue';
            }
            return tool.status.toLowerCase() === filterValue;
        });
    }
    
    renderTools(filteredTools);
}

/**
 * Show registration modal
 */
async function showRegistrationModal() {
    if (elements.registrationModal) {
        elements.registrationModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling

        const lineLoginSection = document.getElementById('lineLoginSection');
        const registrationForm = document.getElementById('registrationForm');
        
        // Ensure LIFF is ready
        if (!liffInitialized) {
            await initLiff();
        }
        
        // Check LINE Login status
        const isLoggedIn = typeof liff !== 'undefined' && liff.isLoggedIn && liff.isLoggedIn();

        if (!isLoggedIn) {
            // Not logged in: Show LINE Login button, hide form
            if (lineLoginSection) lineLoginSection.classList.remove('hidden');
            if (registrationForm) registrationForm.classList.add('hidden');
        } else {
            // Logged in: Hide LINE Login button, show form
            if (lineLoginSection) lineLoginSection.classList.add('hidden');
            if (registrationForm) {
                registrationForm.classList.remove('hidden');
                
                // Pre-fill name from LINE profile
                try {
                    const profile = await liff.getProfile();
                    const nameInput = document.getElementById('fullName');
                    if (nameInput && !nameInput.value) {
                        nameInput.value = profile.displayName;
                    }
                } catch (e) {
                    console.error('Error getting LINE profile:', e);
                }
            }
        }
    }
}

/**
 * Hide registration modal
 */
function hideRegistrationModal() {
    if (elements.registrationModal) {
        elements.registrationModal.classList.add('hidden');
        document.body.style.overflow = ''; // Re-enable scrolling
    }
}

/**
 * Show borrow modal
 * @param {Object} tool - Tool to borrow
 */
function showBorrowModal(tool) {
    // Populate modal with tool information
    document.getElementById('borrowToolName').textContent = tool.toolName;
    document.getElementById('borrowToolId').textContent = tool.toolId;
    document.getElementById('borrowToolLocation').textContent = tool.location;
    document.getElementById('borrowToolAvailable').textContent = `${tool.availableQty} ${tool.unit || 'Units'}`;
    
    // Set image
    const imagePlaceholder = document.querySelector('#borrowModal .tool-image-placeholder');
    if (imagePlaceholder) {
        if (tool.imageUrl && tool.imageUrl.trim() !== '') {
            imagePlaceholder.innerHTML = `<img src="${tool.imageUrl}" alt="${tool.toolName}" style="width:100%; height:100%; object-fit:cover;">`;
            imagePlaceholder.style.overflow = 'hidden';
            // Remove the default icon pseudo-element if needed, usually by class or content. 
            // Our CSS uses ::before for the icon. Adding content hides it if we set display:flex properly or replace content.
            // A simple way is to add a class 'has-image' and style it to hide ::before
            imagePlaceholder.classList.add('has-image');
        } else {
            imagePlaceholder.innerHTML = '';
            imagePlaceholder.classList.remove('has-image');
        }
    }
    
    // Set max quantity for the input
    const quantityInput = document.getElementById('borrowQuantity');
    
    if (tool.availableQty === 'จำนวนมาก') {
        quantityInput.max = 999; // Allow high number for unlimited items
        quantityInput.value = 1;
    } else {
        quantityInput.max = tool.availableQty;
        quantityInput.value = Math.min(1, tool.availableQty);
    }
    
    // Store tool ID for later use
    document.getElementById('confirmBorrow').dataset.toolId = tool.toolId;
    
    if (elements.borrowModal) {
        elements.borrowModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

/**
 * Hide borrow modal
 */
function hideBorrowModal() {
    if (elements.borrowModal) {
        elements.borrowModal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

/**
 * Show return modal
 * @param {Object} tool - Tool to return
 */
function showReturnModal(tool) {
    // Populate modal with tool information
    document.getElementById('returnToolName').textContent = tool.toolName;
    document.getElementById('returnToolId').textContent = tool.toolId;
    document.getElementById('returnToolLocation').textContent = tool.location;
    
    // Set image
    const imagePlaceholder = document.querySelector('#returnModal .tool-image-placeholder');
    if (imagePlaceholder) {
        if (tool.imageUrl && tool.imageUrl.trim() !== '') {
            imagePlaceholder.innerHTML = `<img src="${tool.imageUrl}" alt="${tool.toolName}" style="width:100%; height:100%; object-fit:cover;">`;
            imagePlaceholder.style.overflow = 'hidden';
            imagePlaceholder.classList.add('has-image');
        } else {
            imagePlaceholder.innerHTML = '';
            imagePlaceholder.classList.remove('has-image');
        }
    }

    // Store tool ID for later use
    document.getElementById('confirmReturn').dataset.toolId = tool.toolId;
    
    if (elements.returnModal) {
        elements.returnModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

/**
 * Hide return modal
 */
function hideReturnModal() {
    if (elements.returnModal) {
        elements.returnModal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

/**
 * Handle registration form submission
 */
async function handleRegistrationSubmit(event) {
    event.preventDefault();
    
    const fullName = document.getElementById('fullName').value;
    const department = document.getElementById('department').value;
    const cohort = document.getElementById('cohort').value;
    
    if (!fullName || !department || !cohort) {
        showMessage('Please fill in all fields', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        // Ensure we have the correct User ID from LIFF or fallback
        const userId = getUserId();
        if (!userId) {
             throw new Error("User ID not found. Please try logging in again.");
        }

        const userData = { fullName, department, cohort };
        await registerNewUser(userData);
        
        // Update global user state
        currentUser = getUserInfo();
        
        // Update UI after successful registration
        updateUserUI();
        hideRegistrationModal();
        
        // Load tools after registration
        await loadTools();
        
        showMessage('Registration successful!', 'success');
    } catch (error) {
        console.error('Registration error:', error);
        showMessage('Registration failed. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Handle borrow form submission
 */
async function handleBorrowSubmit() {
    const toolId = document.getElementById('confirmBorrow').dataset.toolId;
    const quantity = parseInt(document.getElementById('borrowQuantity').value);
    const reason = document.getElementById('borrowReason').value;
    const returnDate = document.getElementById('returnDate').value;
    
    if (!reason) {
        showMessage('Please select a reason for borrowing', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        const borrowData = {
            toolId,
            userId: getUserId(),
            quantity,
            reason,
            expectedReturnDate: returnDate
        };
        
        await borrowTool(borrowData);
        
        // Close modal and refresh tools
        hideBorrowModal();
        await loadTools();
        
        showMessage('Tool borrowed successfully!', 'success');
    } catch (error) {
        console.error('Borrow error:', error);
        showMessage('Failed to borrow tool. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Handle return form submission
 */
async function handleReturnSubmit() {
    const toolId = document.getElementById('confirmReturn').dataset.toolId;
    const condition = document.querySelector('input[name="condition"]:checked').value;
    const notes = document.getElementById('returnNotes').value;
    
    showLoading(true);
    
    try {
        const returnData = {
            toolId,
            userId: getUserId(),
            condition,
            notes: notes || null
        };
        
        await returnTool(returnData);
        
        // Close modal and refresh tools
        hideReturnModal();
        await loadTools();
        
        showMessage('Tool returned successfully!', 'success');
    } catch (error) {
        console.error('Return error:', error);
        showMessage('Failed to return tool. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Adjust quantity in borrow modal
 * @param {number} change - Amount to change quantity by
 */
function adjustQuantity(change) {
    const quantityInput = document.getElementById('borrowQuantity');
    const currentValue = parseInt(quantityInput.value);
    const maxValue = parseInt(quantityInput.max);
    const minValue = parseInt(quantityInput.min) || 1;
    
    let newValue = currentValue + change;
    newValue = Math.max(minValue, Math.min(newValue, maxValue));
    
    quantityInput.value = newValue;
}

/**
 * Show/hide loading overlay
 * @param {boolean} show - Whether to show or hide the loading overlay
 */
function showLoading(show) {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.classList.toggle('hidden', !show);
    }
}

/**
 * Show a message toast
 * @param {string} message - Message to display
 * @param {string} type - Type of message ('success' or 'error')
 */
function showMessage(message, type) {
    if (!elements.messageToast) return;
    
    const messageText = document.getElementById('messageText');
    if (messageText) {
        messageText.textContent = message;
    }
    
    // Remove any existing classes
    elements.messageToast.classList.remove('show', 'success', 'error');
    
    // Add appropriate classes
    elements.messageToast.classList.add(type);
    
    // Show the toast
    setTimeout(() => {
        elements.messageToast.classList.add('show');
    }, 10);
    
    // Hide after 3 seconds
    setTimeout(() => {
        elements.messageToast.classList.remove('show');
    }, 3000);
}

/**
 * Format date as YYYY-MM-DD
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}