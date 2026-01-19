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
    locationFilterBtn: document.getElementById('locationFilterBtn'),
    locationDropdown: document.getElementById('locationDropdown'),
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
        // 1. Init LIFF
        await initLiff();
        
        // 2. Check Backend Status & Sync Data (Critical Fix)
        // We do this BEFORE rendering UI so we have the latest Role and Name
        if (getUserId()) {
            const isRegistered = await isUserRegistered(); // This syncs backend data to LocalStorage
            if (isRegistered) {
                // Reload currentUser from the freshly updated LocalStorage
                currentUser = getUserInfo();
            } else if (liffInitialized && liff.isLoggedIn()) {
                // Not registered but logged in via LINE -> Show Registration
                showRegistrationModal();
            }
        } else {
            // Attempt to load from local storage if not logged in via LIFF yet
            currentUser = getUserInfo();
        }
        
        // 3. Update UI with the synced data
        updateUserUI();
        
        // 4. Load Tools
        await loadTools();

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
document.getElementById('borrowDate').value = formatDisplayDate(new Date());

// Set default return date to tomorrow
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
document.getElementById('returnDate').value = formatDate(tomorrow);

/**
 * Format date as DD/MM/YY for display
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string (DD/MM/YY)
 */
function formatDisplayDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
}

/**
 * Load tools from the API and render them
 */
async function loadTools() {
    try {
        // Ensure we have the user ID (from LIFF or Local Storage)
        const userId = getUserId();
        
        // Check authentication status
        const isLoggedIn = (typeof liff !== 'undefined' && liff.isLoggedIn && liff.isLoggedIn()) || !!getUserInfo();

        const [fetchedTools, userBorrows] = await Promise.all([
            getTools(),
            (isLoggedIn && userId) ? getUserActiveBorrows(userId) : { borrows: [] }
        ]);
        
        const myBorrows = userBorrows.borrows || [];
        
        tools = fetchedTools.map(tool => {
            const borrow = myBorrows.find(b => b.toolId === tool.toolId);
            return {
                ...tool,
                myBorrowedQty: borrow ? borrow.quantity : 0
            };
        });

        // Sort tools: Borrowed items first
        tools.sort((a, b) => {
            if (a.myBorrowedQty > 0 && b.myBorrowedQty <= 0) return -1;
            if (a.myBorrowedQty <= 0 && b.myBorrowedQty > 0) return 1;
            return 0; // Keep original order for others
        });

        populateLocationDropdown();
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
    // 1. If I have borrowed it, I see "Return" (Regardless of available stock).
    // 2. If I haven't borrowed it, but it's available, I see "Borrow".
    // 3. If I haven't borrowed it, and it's NOT available, I see "Out of Stock" (disabled).
    
    // Check authentication status
    const isLoggedIn = (typeof liff !== 'undefined' && liff.isLoggedIn && liff.isLoggedIn()) || !!currentUser;

    if (isLoggedIn && tool.myBorrowedQty > 0) {
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
    // Use closest to ensure we get the button even if icon is clicked
    const btn = event.target.closest('.filter-btn');
    if (!btn) return;
    
    const filterValue = btn.dataset.filter;
    
    // Handle Location Filter Dropdown Toggle
    if (filterValue === 'location') {
        const dropdown = elements.locationDropdown;
        
        if (dropdown.classList.contains('hidden')) {
            // Show dropdown
            const rect = btn.getBoundingClientRect();
            dropdown.style.top = `${rect.bottom + window.scrollY + 8}px`;
            
            // Check if it goes off screen right
            if (rect.left + 200 > window.innerWidth) {
                dropdown.style.right = '16px';
                dropdown.style.left = 'auto';
            } else {
                 dropdown.style.left = `${rect.left + window.scrollX}px`;
                 dropdown.style.right = 'auto';
            }
            
            dropdown.classList.remove('hidden');
        } else {
            dropdown.classList.add('hidden');
        }
        return; // Stop here, don't apply filter yet
    }

    // Hide location dropdown if any other filter is clicked
    if (elements.locationDropdown) {
        elements.locationDropdown.classList.add('hidden');
    }
    
    // Update active button
    elements.filterBtns.forEach(b => {
        if (b.dataset.filter !== 'location') {
             b.classList.toggle('active', b.dataset.filter === filterValue);
        } else {
             b.classList.remove('active');
        }
    });
    
    // Reset location button text
    if (elements.locationFilterBtn) {
        elements.locationFilterBtn.innerHTML = `Location <span class="material-symbols-outlined text-[18px]">arrow_drop_down</span>`;
    }
    
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
 * Populate location dropdown with unique locations
 */
function populateLocationDropdown() {
    const locations = [...new Set(tools.map(tool => tool.location))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    
    const dropdownContent = document.getElementById('locationDropdownContent');
    
    if (!dropdownContent) return;
    
    // Keep the "All Locations" button with its new styled content
    dropdownContent.innerHTML = `
        <button class="w-full text-left px-5 py-3 text-sm hover:bg-[#f7f6f8] dark:hover:bg-[#36323d] transition-colors font-bold text-primary" data-location="all">
            <span class="flex items-center gap-2">
                <span class="material-symbols-outlined text-[20px]">inventory_2</span>
                All Locations
            </span>
        </button>
    `;
    
    locations.forEach(loc => {
        const btn = document.createElement('button');
        btn.className = 'w-full text-left px-5 py-3 text-sm hover:bg-[#f7f6f8] dark:hover:bg-[#36323d] transition-colors text-[#141216] dark:text-white font-medium flex items-center gap-2';
        btn.innerHTML = `
            <span class="material-symbols-outlined text-[20px] text-[#756a81] dark:text-[#aba6b3]">location_on</span>
            <span>${loc}</span>
        `;
        btn.dataset.location = loc;
        btn.addEventListener('click', () => handleLocationSelect(loc));
        dropdownContent.appendChild(btn);
    });
    
    // Re-attach listener for "All Locations"
    const allBtn = dropdownContent.querySelector('[data-location="all"]');
    if (allBtn) {
        allBtn.addEventListener('click', () => handleLocationSelect('all'));
    }
}

/**
 * Handle selection of a location
 */
function handleLocationSelect(location) {
    // Hide dropdown
    if (elements.locationDropdown) {
        elements.locationDropdown.classList.add('hidden');
    }
    
    // Update active state
    elements.filterBtns.forEach(btn => {
        btn.classList.remove('active');
    });
    if (elements.locationFilterBtn) {
        elements.locationFilterBtn.classList.add('active');
    }
    
    // Update button text and filter
    if (location === 'all') {
        if (elements.locationFilterBtn) {
            elements.locationFilterBtn.innerHTML = `Location <span class="material-symbols-outlined text-[18px]">arrow_drop_down</span>`;
        }
        filteredTools = [...tools];
        
        // Reset active state to 'All Items' logically, but visually we kept Location active. 
        // Actually, 'All Locations' is akin to resetting filters or just filtering by all locations (which is everything).
        // Let's set 'All Items' as active if they select 'All Locations'
        if (elements.locationFilterBtn) elements.locationFilterBtn.classList.remove('active');
        const allItemsBtn = document.querySelector('.filter-btn[data-filter="all"]');
        if (allItemsBtn) allItemsBtn.classList.add('active');
        
    } else {
        // Truncate if too long
        const displayLoc = location.length > 12 ? location.substring(0, 10) + '...' : location;
        if (elements.locationFilterBtn) {
            elements.locationFilterBtn.innerHTML = `${displayLoc} <span class="material-symbols-outlined text-[18px]">arrow_drop_down</span>`;
        }
        
        filteredTools = tools.filter(tool => tool.location === location);
    }
    
    renderTools(filteredTools);
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (elements.locationDropdown && !elements.locationDropdown.classList.contains('hidden')) {
        // Check if click is outside both button and dropdown
        if (!elements.locationFilterBtn.contains(e.target) && !elements.locationDropdown.contains(e.target)) {
            elements.locationDropdown.classList.add('hidden');
        }
    }
});

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
            if (lineLoginSection) {
                lineLoginSection.classList.remove('hidden');
                lineLoginSection.classList.add('flex');
            }
            if (registrationForm) {
                registrationForm.classList.add('hidden');
                registrationForm.classList.remove('flex');
            }
            const stepText = document.getElementById('registrationStepText');
            if (stepText) stepText.textContent = 'Step 1 of 2';
        } else {
            // Logged in: Hide LINE Login button, show form
            if (lineLoginSection) {
                lineLoginSection.classList.add('hidden');
                lineLoginSection.classList.remove('flex');
            }
            if (registrationForm) {
                registrationForm.classList.remove('hidden');
                registrationForm.classList.add('flex');
                
                // Force update step text immediately
                setTimeout(() => {
                    const stepText = document.getElementById('registrationStepText');
                    if (stepText) stepText.textContent = 'Step 2 of 2';
                }, 0);
                
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
    
    // Reset reason and validation
    const reasonInput = document.getElementById('borrowReason');
    if (reasonInput) {
        reasonInput.value = "";
        reasonInput.classList.remove('border-red-500', 'ring-2', 'ring-red-500/20');
    }
    
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

    // Reset form
    const conditionSelect = document.getElementById('returnCondition');
    if (conditionSelect) {
        conditionSelect.value = "";
        conditionSelect.classList.remove('border-red-500', 'ring-2', 'ring-red-500/20');
    }
    
    const notesInput = document.getElementById('returnNotes');
    if (notesInput) notesInput.value = "";
    
    // Reset Image Input UI
    if (window.clearReturnImage) {
        window.clearReturnImage();
    } else {
        // Fallback manual reset
        const up = document.getElementById('returnImageUpload');
        if (up) up.value = "";
        document.getElementById('imagePreviewContainer')?.classList.add('hidden');
        document.getElementById('imageInputOptions')?.classList.remove('hidden');
        document.getElementById('returnImageError')?.classList.add('hidden');
    }
    
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
    const reasonInput = document.getElementById('borrowReason');
    const reason = reasonInput ? reasonInput.value.trim() : "";
    const returnDate = document.getElementById('returnDate').value;
    
    if (!reason) {
        if (reasonInput) {
            reasonInput.classList.add('border-red-500', 'ring-2', 'ring-red-500/20');
            reasonInput.addEventListener('input', () => {
                reasonInput.classList.remove('border-red-500', 'ring-2', 'ring-red-500/20');
            }, { once: true });
        }
        showMessage('Please specify a reason for borrowing', 'error');
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
        
        // Optimistic UI Update: Assume success immediately
        const borrowedToolIndex = tools.findIndex(t => t.toolId === toolId);
        if (borrowedToolIndex !== -1) {
            tools[borrowedToolIndex].myBorrowedQty = (tools[borrowedToolIndex].myBorrowedQty || 0) + quantity;
            if (tools[borrowedToolIndex].availableQty !== 'จำนวนมาก') {
                tools[borrowedToolIndex].availableQty -= quantity;
            }
            // Re-render only this card or all to reflect change immediately
            renderTools(filteredTools);
        }

        await borrowTool(borrowData);
        
        // Close modal and refresh tools from server to confirm
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
    const conditionSelect = document.getElementById('returnCondition');
    const condition = conditionSelect ? conditionSelect.value : null;
    const notes = document.getElementById('returnNotes').value;
    
    // Image Validation
    const imageError = document.getElementById('returnImageError');
    let imageBase64 = null;
    let imageName = null;
    
    if (!condition) {
        // Highlight in red if not selected
        if (conditionSelect) {
            conditionSelect.classList.add('border-red-500', 'ring-2', 'ring-red-500/20');
            // Remove highlight on change
            conditionSelect.addEventListener('change', () => {
                conditionSelect.classList.remove('border-red-500', 'ring-2', 'ring-red-500/20');
            }, { once: true });
        }
        showMessage('Please select the tool condition', 'error');
        return;
    }

    // Check if file is selected
    const uploadInput = document.getElementById('returnImageUpload');
    const file = uploadInput && uploadInput.files ? uploadInput.files[0] : null;

    if (!file) {
        if (imageError) imageError.classList.remove('hidden');
        showMessage('Please upload a condition photo', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        // Convert image to Base64
        imageBase64 = await convertToBase64(file);
        imageName = `return_${toolId}_${Date.now()}.jpg`;

        const returnData = {
            toolId,
            userId: getUserId(),
            condition,
            notes: notes || null,
            imageBase64,
            imageName
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

/**
 * Handle Image Selection
 */
window.handleImageSelection = function(input) {
    const previewContainer = document.getElementById('imagePreviewContainer');
    const previewImage = document.getElementById('returnImagePreview');
    const inputOptions = document.getElementById('imageInputOptions');
    const errorMsg = document.getElementById('returnImageError');
    
    if (input.files && input.files[0]) {
        const file = input.files[0];
        
        if (file.size > 3 * 1024 * 1024) {
            alert('File size too large. Please select an image under 3MB.');
            input.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            previewImage.src = e.target.result;
            previewContainer.classList.remove('hidden');
            inputOptions.classList.add('hidden');
            if (errorMsg) errorMsg.classList.add('hidden');
        }
        reader.readAsDataURL(file);
    }
}

/**
 * Clear Return Image
 */
window.clearReturnImage = function() {
    const uploadInput = document.getElementById('returnImageUpload');
    if (uploadInput) uploadInput.value = "";
    
    document.getElementById('imagePreviewContainer').classList.add('hidden');
    document.getElementById('returnImagePreview').src = "";
    document.getElementById('imageInputOptions').classList.remove('hidden');
    
    const errorMsg = document.getElementById('returnImageError');
    if (errorMsg) errorMsg.classList.add('hidden');
}

/**
 * Convert File to Base64
 * @param {File} file - File object
 * @returns {Promise<string>} - Base64 string
 */
function convertToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}