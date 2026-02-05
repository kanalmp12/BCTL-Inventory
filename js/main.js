// main.js - Main application logic (Cart & Batch Operations Support)

// Global variables
let currentUser = null;
let tools = [];
let filteredTools = [];
let cart = []; // Array of { tool, quantity, imageFile, imageBase64 }
let returnCart = []; // Array of { tool, condition, notes, imageBase64 }
let returnSelection = new Set(); // Set of toolIds selected for return (Deprecated but kept for legacy compat if needed)
let isReturnMode = false;

// DOM Elements
const elements = {
    toolsGrid: document.getElementById('toolsGrid'),
    searchInput: document.getElementById('searchInput'),
    filterBtns: document.querySelectorAll('.filter-btn'),
    locationFilterBtn: document.getElementById('locationFilterBtn'),
    locationDropdown: document.getElementById('locationDropdown'),
    returnModeBtn: document.getElementById('returnModeBtn'),

    // Modals
    registrationModal: document.getElementById('registrationModal'),
    borrowModal: document.getElementById('borrowModal'), // Legacy (single item details maybe?)
    returnModal: document.getElementById('returnModal'), // Legacy
    cartModal: document.getElementById('cartModal'),

    // Cart Elements
    cartFab: document.getElementById('cartFab'),
    cartBadge: document.getElementById('cartBadge'),
    cartBtnDesktop: document.getElementById('cartBtnDesktop'),
    cartBadgeDesktop: document.getElementById('cartBadgeDesktop'),
    cartItemsList: document.getElementById('cartItemsList'),
    cartTotalCount: document.getElementById('cartTotalCount'),

    // Toast & Loading
    messageToast: document.getElementById('messageToast'),
    loadingOverlay: document.getElementById('loadingOverlay'),

    // Mobile Nav & Sheet
    mobileMenuBtn: document.getElementById('mobileMenuBtn'),
    mobileSearchBtn: document.getElementById('mobileSearchBtn'),
    mobileFilterBtn: document.getElementById('mobileFilterBtn'),
    filterSheetOverlay: document.getElementById('filterSheetOverlay'),
    closeFilterSheetBtn: document.getElementById('closeFilterSheet'),
    sheetFilterChips: document.getElementById('sheetFilterChips'),
    sheetLocationList: document.getElementById('sheetLocationList'),

    // Floating Search Bar Elements (Google Go Style)
    floatingSearchBar: document.getElementById('floatingSearchBar'),
    floatingSearchInput: document.getElementById('floatingSearchInput'),
    floatingSearchClear: document.getElementById('floatingSearchClear')
};

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    // Start fetching tools immediately to reduce wait time (Parallel with LIFF init)
    const toolsPromise = getTools().catch(e => {
        console.error("Early fetch error:", e);
        return []; // Fail gracefully, loadTools will handle or retry if needed, or we handle it there
    });

    // Skeletons
    if (typeof showUserSkeleton === 'function') showUserSkeleton();
    renderSkeletons();

    try {
        await initLiff();

        // Auth & Sync
        const userId = getUserId();
        let isRegistered = false;

        if (userId) {
            try {
                isRegistered = await isUserRegistered();
                if (!isRegistered) {
                    await new Promise(r => setTimeout(r, 1500));
                    isRegistered = await isUserRegistered();
                }
            } catch (e) { console.warn("Sync retry...", e); }
        }

        currentUser = getUserInfo();

        if (typeof liff !== 'undefined' && liff.isLoggedIn && liff.isLoggedIn() && !isRegistered && !currentUser) {
            showRegistrationModal();
        }

        updateUserUI();
        await loadTools(toolsPromise);

        // Setup Cart UI
        updateCartUI();

    } catch (error) {
        console.error('Init error:', error);
        showMessage('Failed to initialize.', 'error');
    }
});

// Event Listeners
elements.searchInput?.addEventListener('input', handleSearch);
elements.filterBtns.forEach(btn => btn.addEventListener('click', handleFilterClick));

// Cart Events
elements.cartFab?.addEventListener('click', openCartModal);
elements.cartBtnDesktop?.addEventListener('click', openCartModal);
document.getElementById('closeCartModal')?.addEventListener('click', closeCartModal);
document.getElementById('closeCartBtn')?.addEventListener('click', closeCartModal);
document.getElementById('clearCartBtn')?.addEventListener('click', clearCart);
document.getElementById('confirmCartBorrow')?.addEventListener('click', handleCartSubmit);

// Return Mode Toggle
elements.returnModeBtn?.addEventListener('click', toggleReturnMode);

// Language
document.addEventListener('languageChanged', () => {
    renderTools(filteredTools);
    updateUserUI();
    updateCartUI(); // Update texts in cart
});

// General UI
// Guest Dropdown & Login
document.getElementById('dropdownLoginBtn')?.addEventListener('click', showRegistrationModal);
document.getElementById('closeRegistrationModal')?.addEventListener('click', hideRegistrationModal);
document.getElementById('registrationForm')?.addEventListener('submit', handleRegistrationSubmit);

const guestUserContainer = document.getElementById('guestUserContainer');
const guestDropdown = document.getElementById('guestDropdown');
const getStartedBtn = document.getElementById('getStartedBtn');

if (guestUserContainer && guestDropdown && getStartedBtn) {
    getStartedBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        guestDropdown.classList.toggle('hidden');
    });
    guestDropdown.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', (e) => {
        if (!guestUserContainer.contains(e.target)) guestDropdown.classList.add('hidden');
    });
}

const lineLoginBtn = document.getElementById('lineLoginBtn');
if (lineLoginBtn) {
    lineLoginBtn.addEventListener('click', () => {
        console.log("Login button clicked via Event Listener");
        if (window.loginWithLine) {
            window.loginWithLine();
        } else {
            console.error("window.loginWithLine is not defined");
            alert("System Error: Login function missing.");
        }
    });
} else {
    // lineLoginBtn might be missing if not invalid context, ignore or log info
}

// Dropdown & Logout
const userInfoContainer = document.getElementById('userInfoContainer');
const userDropdown = document.getElementById('userDropdown');
const logoutBtn = document.getElementById('logoutBtn');

if (userInfoContainer && userDropdown) {
    userInfoContainer.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle('hidden');
    });
    userDropdown.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', (e) => {
        if (!userInfoContainer.contains(e.target)) userDropdown.classList.add('hidden');
    });
}
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if (typeof logoutFromLine === 'function') logoutFromLine();
        else { localStorage.clear(); window.location.reload(); }
    });
}

// Mobile Bottom Bar Logic
elements.mobileSearchBtn?.addEventListener('click', toggleFloatingSearch);

function toggleFloatingSearch() {
    const bar = elements.floatingSearchBar;
    if (!bar) return;

    if (bar.classList.contains('hidden')) {
        // Show
        bar.classList.remove('hidden');
        // Small delay for transition
        requestAnimationFrame(() => {
            bar.classList.remove('scale-95', 'opacity-0');
            bar.classList.add('scale-100', 'opacity-100');
        });
        setTimeout(() => elements.floatingSearchInput?.focus(), 100);
    } else {
        // Hide
        bar.classList.remove('scale-100', 'opacity-100');
        bar.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            bar.classList.add('hidden');
        }, 300); // Wait for transition
    }
}

// Close floating search if clicking outside
document.addEventListener('click', (e) => {
    const bar = elements.floatingSearchBar;
    const btn = elements.mobileSearchBtn;
    if (!bar || bar.classList.contains('hidden')) return;

    if (!bar.contains(e.target) && !btn.contains(e.target)) {
        // Only hide if input is empty
        const val = elements.floatingSearchInput?.value.trim();
        if (!val) {
            toggleFloatingSearch();
        }
    }
});

// Floating Search Input Logic
elements.floatingSearchInput?.addEventListener('input', (e) => {
    const val = e.target.value;
    // Sync to main search input for handleSearch to work
    if (elements.searchInput) {
        elements.searchInput.value = val;
        handleSearch();
    }
    toggleFloatingClear(val);
});

elements.floatingSearchClear?.addEventListener('click', () => {
    if (elements.floatingSearchInput) {
        elements.floatingSearchInput.value = '';
        elements.floatingSearchInput.focus();
        // Sync
        if (elements.searchInput) {
            elements.searchInput.value = '';
            handleSearch();
        }
        toggleFloatingClear('');
    }
});

function toggleFloatingClear(val) {
    if (elements.floatingSearchClear) {
        if (val && val.length > 0) elements.floatingSearchClear.classList.remove('hidden');
        else elements.floatingSearchClear.classList.add('hidden');
    }
}


// Floating Search Input Logic
elements.floatingSearchInput?.addEventListener('input', (e) => {
    const val = e.target.value;
    // Sync to main search input for handleSearch to work
    if (elements.searchInput) {
        elements.searchInput.value = val;
        handleSearch();
    }
    toggleFloatingClear(val);
});

elements.floatingSearchClear?.addEventListener('click', () => {
    if (elements.floatingSearchInput) {
        elements.floatingSearchInput.value = '';
        elements.floatingSearchInput.focus();
        // Sync
        if (elements.searchInput) {
            elements.searchInput.value = '';
            handleSearch();
        }
        toggleFloatingClear('');
    }
});

function toggleFloatingClear(val) {
    if (elements.floatingSearchClear) {
        if (val && val.length > 0) elements.floatingSearchClear.classList.remove('hidden');
        else elements.floatingSearchClear.classList.add('hidden');
    }
}

elements.mobileMenuBtn?.addEventListener('click', () => {
    // Scroll to top to see header menu or toggle it
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Optional: Toggle dropdown if user is logged in
    setTimeout(() => {
        if (userInfoContainer && !userInfoContainer.classList.contains('hidden')) {
            userDropdown.classList.toggle('hidden');
        }
    }, 300);
});

elements.mobileFilterBtn?.addEventListener('click', openFilterSheet);
elements.closeFilterSheetBtn?.addEventListener('click', closeFilterSheet);
elements.filterSheetOverlay?.addEventListener('click', (e) => {
    if (e.target === elements.filterSheetOverlay) closeFilterSheet();
});

function openFilterSheet() {
    renderBottomSheetFilters();
    elements.filterSheetOverlay?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeFilterSheet() {
    elements.filterSheetOverlay?.classList.add('hidden');
    document.body.style.overflow = '';
}

function renderBottomSheetFilters() {
    if (!elements.sheetFilterChips || !elements.sheetLocationList) return;

    // 1. Status Chips
    // Clone logic from handleFilterClick roughly but for sheet
    const statuses = [
        { id: 'all', label: t('filter_all') },
        { id: 'available', label: t('filter_available') },
        { id: 'borrowed', label: t('filter_borrowed') },
        { id: 'overdue', label: t('filter_overdue') }
    ];

    elements.sheetFilterChips.innerHTML = '';

    // Check current active filter
    const activeBtn = document.querySelector('.filter-btn.active:not(#locationFilterBtn)');
    const currentFilter = activeBtn ? activeBtn.dataset.filter : 'all';

    statuses.forEach(status => {
        const chip = document.createElement('button');
        const isActive = currentFilter === status.id;
        // MD3 Chip Styles with Semantic Colors
        let activeClass = 'bg-secondary-container text-on-secondary-container border-secondary-container';

        if (isActive) {
            const statusColors = {
                'available': 'bg-green-100 text-green-800 border-green-200',
                'borrowed': 'bg-amber-100 text-amber-800 border-amber-200',
                'overdue': 'bg-red-100 text-red-800 border-red-200'
            };
            if (statusColors[status.id]) {
                activeClass = statusColors[status.id];
            }
        }

        chip.className = `px-4 py-2 rounded-lg border text-sm font-bold transition-colors ${isActive
            ? activeClass
            : 'bg-surface border-outline-variant text-on-surface-variant hover:bg-surface-variant'
            }`;
        // Note: Using CSS classes from Tailwind config (if available) or standard utility
        // Since we don't have full Tailwind MD3 classes in JS, we use inline classes or matches 
        // We can reuse the same logic as desktop chips but styled for sheet grid

        chip.textContent = status.label;
        chip.onclick = () => {
            // Trigger the actual filter click on main UI (hidden or not)
            const desktopBtn = document.querySelector(`.filter-btn[data-filter="${status.id}"]`);
            if (desktopBtn) desktopBtn.click();
            closeFilterSheet();
        };
        elements.sheetFilterChips.appendChild(chip);
    });

    // 2. Locations
    // Get locations from tools
    const locations = [...new Set(tools.map(tool => tool.location))].filter(Boolean).sort();
    elements.sheetLocationList.innerHTML = '';

    // Get current active location for checking mark
    const btnSpan = elements.locationFilterBtn?.querySelector('span[data-i18n="filter_location"]');
    const currentLoc = (elements.locationFilterBtn?.classList.contains('active') && btnSpan) ? btnSpan.textContent : 'all';

    // Add "All Locations"
    const allLocBtn = document.createElement('button');
    const isAllActive = currentLoc === 'all' || currentLoc === t('filter_location');
    allLocBtn.className = `w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center justify-between font-bold ${isAllActive ? 'bg-indigo-50 text-indigo-800' : 'text-on-surface hover:bg-surface-variant'}`;
    allLocBtn.innerHTML = `
        <span class="flex items-center gap-3">
            <span class="material-symbols-outlined">inventory_2</span>
            ${t('filter_location_all')}
        </span>
        ${isAllActive ? '<span class="material-symbols-outlined text-sm font-bold">check</span>' : ''}
    `;
    allLocBtn.onclick = () => {
        handleLocationSelect('all');
        closeFilterSheet();
    };
    elements.sheetLocationList.appendChild(allLocBtn);

    locations.forEach(loc => {
        const btn = document.createElement('button');
        const isActive = currentLoc === loc;
        btn.className = `w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center justify-between ${isActive ? 'bg-indigo-50 text-indigo-800 font-bold' : 'text-on-surface hover:bg-surface-variant'}`;
        btn.innerHTML = `
            <span>${loc}</span>
            ${isActive ? '<span class="material-symbols-outlined text-sm font-bold">check</span>' : ''}
        `;
        btn.onclick = () => {
            handleLocationSelect(loc);
            closeFilterSheet();
        };
        elements.sheetLocationList.appendChild(btn);
    });
}

// ==========================================
// CORE FUNCTIONS
// ==========================================

async function loadTools(preFetchedToolsPromise = null) {
    try {
        // Only render skeletons if grid is empty (avoid flickering if already rendering)
        if (!elements.toolsGrid.hasChildNodes()) renderSkeletons();

        const userId = getUserId();
        const isLoggedIn = (typeof liff !== 'undefined' && liff.isLoggedIn && liff.isLoggedIn()) || !!getUserInfo();

        // Use pre-fetched promise if available, otherwise call API
        const toolsRequest = preFetchedToolsPromise || getTools();
        const borrowsRequest = (isLoggedIn && userId) ? getUserActiveBorrows(userId) : { borrows: [] };

        const [fetchedTools, userBorrows] = await Promise.all([
            toolsRequest,
            borrowsRequest
        ]);

        // If fetchedTools came from the catch block of preFetch, it might be array or empty. 
        // getTools() usually returns { tools: [...] } or array depending on api.js adapter.
        // api.js getTools returns array directly: `return result.tools || result;`

        const actualTools = Array.isArray(fetchedTools) ? fetchedTools : (fetchedTools.tools || []);

        const myBorrows = userBorrows.borrows || [];

        tools = actualTools.map(tool => {
            const borrow = myBorrows.find(b => b.toolId === tool.toolId);
            return {
                ...tool,
                myBorrowedQty: borrow ? borrow.quantity : 0
            };
        });

        // Sort: Borrowed first
        tools.sort((a, b) => {
            if (a.myBorrowedQty > 0 && b.myBorrowedQty <= 0) return -1;
            if (a.myBorrowedQty <= 0 && b.myBorrowedQty > 0) return 1;
            return 0;
        });

        populateLocationDropdown();
        filteredTools = [...tools];
        renderTools(filteredTools);
        updateFilterButtonStyles();
        syncMobileFilterBadge();

        // Show/Hide Return Mode Button based on if user has borrows
        const hasBorrows = tools.some(t => t.myBorrowedQty > 0);
        if (elements.returnModeBtn) {
            elements.returnModeBtn.style.display = hasBorrows ? 'inline-flex' : 'none';
        }

    } catch (error) {
        console.error('Error loading tools:', error);
        showMessage('Failed to load tools.', 'error');
    }
}

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

// Re-render on resize to switch between mobile/desktop layouts
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        // Only re-render if we cross the 768px breakpoint
        // (For simplicity in this MVP, we just re-render to be safe)
        renderTools(filteredTools);
    }, 200);
});

function createToolCard(tool) {
    const card = document.createElement('article');
    card.className = `tool-card ${getStatusClass(tool.status)}`;
    const isDesktop = window.innerWidth >= 768;

    // Determine Button State
    let actionButton = '';
    const isLoggedIn = !!currentUser || (typeof liff !== 'undefined' && liff.isLoggedIn && liff.isLoggedIn());
    const inCart = cart.find(item => item.tool.toolId === tool.toolId);

    // Helper for Desktop Button Styles (Full buttons)
    const desktopBtnClasses = "w-full py-2 rounded-lg font-bold border-2 transition-colors flex items-center justify-center gap-2";

    // Helper for Mobile Button Styles (Icon only)
    const mobileBtnClasses = "w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm";

    if (isLoggedIn && tool.myBorrowedQty > 0) {
        // Return Mode
        const inReturnCart = returnCart.find(i => i.tool.toolId === tool.toolId);
        if (inReturnCart) {
            if (isDesktop) {
                actionButton = `
                    <button class="${desktopBtnClasses} bg-red-50 text-red-600 border-red-200 hover:bg-red-100" onclick="removeFromReturnCartWrapper('${tool.toolId}')">
                        <span class="material-symbols-outlined">remove_shopping_cart</span>
                        Unselect Return
                    </button>`;
            } else {
                actionButton = `
                    <button class="${mobileBtnClasses} bg-red-100 text-red-600 hover:bg-red-200" onclick="removeFromReturnCartWrapper('${tool.toolId}')">
                        <span class="material-symbols-outlined text-[20px]">remove_shopping_cart</span>
                    </button>`;
            }
        } else {
            if (isDesktop) {
                actionButton = `
                    <button class="${desktopBtnClasses} btn-return" onclick="addToReturnCartWrapper('${tool.toolId}')">
                        <span class="material-symbols-outlined">keyboard_return</span>
                        ${t('btn_card_return')}
                    </button>`;
            } else {
                actionButton = `
                    <button class="${mobileBtnClasses} bg-blue-100 text-blue-600 hover:bg-blue-200" onclick="addToReturnCartWrapper('${tool.toolId}')">
                        <span class="material-symbols-outlined text-[20px]">keyboard_return</span>
                    </button>`;
            }
        }
    } else if (inCart) {
        // In Cart: Quantity Control
        if (isDesktop) {
            actionButton = `
                <div class="flex items-center justify-between w-full h-10 bg-green-50 border border-green-200 rounded-lg overflow-hidden">
                    <button class="w-10 h-full flex items-center justify-center text-green-700 hover:bg-green-100 transition-colors" onclick="updateCartQtyFromCard('${tool.toolId}', -1)">
                        <span class="material-symbols-outlined">remove</span>
                    </button>
                    <span class="font-bold text-green-800 text-sm">${inCart.quantity}</span>
                    <button class="w-10 h-full flex items-center justify-center text-green-700 hover:bg-green-100 transition-colors" onclick="updateCartQtyFromCard('${tool.toolId}', 1)">
                        <span class="material-symbols-outlined">add</span>
                    </button>
                </div>`;
        } else {
            // Mobile Compact Quantity
            actionButton = `
                <div class="flex items-center gap-1 bg-green-50 border border-green-200 rounded-lg p-1 shadow-sm">
                    <button class="w-6 h-6 flex items-center justify-center text-green-700 bg-white rounded hover:bg-green-100" onclick="updateCartQtyFromCard('${tool.toolId}', -1)">
                        <span class="material-symbols-outlined text-[14px]">remove</span>
                    </button>
                    <span class="font-bold text-green-800 text-xs min-w-[12px] text-center">${inCart.quantity}</span>
                    <button class="w-6 h-6 flex items-center justify-center text-green-700 bg-white rounded hover:bg-green-100" onclick="updateCartQtyFromCard('${tool.toolId}', 1)">
                        <span class="material-symbols-outlined text-[14px]">add</span>
                    </button>
                </div>`;
        }
    } else if (tool.availableQty === 'จำนวนมาก' || tool.availableQty > 0) {
        // Available -> Add to Cart
        if (isDesktop) {
            actionButton = `
                <button class="${desktopBtnClasses} btn-borrow" onclick="addToCartWrapper('${tool.toolId}')">
                    <span class="material-symbols-outlined">add_shopping_cart</span>
                    Add to Cart
                </button>`;
        } else {
            actionButton = `
                <button class="${mobileBtnClasses} bg-primary text-white hover:brightness-110" onclick="addToCartWrapper('${tool.toolId}')">
                    <span class="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                </button>`;
        }
    } else {
        // Out of Stock
        if (isDesktop) {
            actionButton = `
                 <button class="${desktopBtnClasses}" disabled style="background-color: var(--gray-medium); cursor: not-allowed; color: var(--text-secondary);">
                     <span class="material-symbols-outlined">block</span>
                     ${t('btn_card_out_of_stock')}
                 </button>`;
        } else {
            actionButton = `
                 <button class="${mobileBtnClasses} bg-gray-200 text-gray-400 cursor-not-allowed" disabled>
                     <span class="material-symbols-outlined text-[18px]">block</span>
                 </button>`;
        }
    }

    // Image
    let imageContent = '';
    if (tool.imageUrl && tool.imageUrl.trim() !== '') {
        imageContent = `<img src="${tool.imageUrl}" alt="${tool.toolName}" style="width:100%; height:100%; object-fit:cover;">`;
    }

    // Status Text
    let availText = '';
    if (tool.status === 'Available') {
        availText = (tool.availableQty === 'จำนวนมาก') ?
            `${t('unit_many')}` :
            `${tool.availableQty} ${tool.unit || t('unit_items')}`;

        // Used fuller text for desktop if needed, but keeping it concise is fine too
        if (isDesktop && tool.availableQty !== 'จำนวนมาก') {
            availText = `${t('status_available')}: ${tool.availableQty} ${tool.unit || t('unit_items')}`;
        }
    } else {
        availText = tool.status;
    }

    // Status Badge Class logic
    const statusClass = getStatusClass(tool.status);
    let statusColorClass = 'text-green-800 bg-green-100 border-green-200';
    if (statusClass === 'borrowed') statusColorClass = 'text-amber-800 bg-amber-100 border-amber-200';
    if (statusClass === 'overdue') statusColorClass = 'text-red-800 bg-red-100 border-red-200';


    if (isDesktop) {
        // ==========================================
        // DESKTOP LAYOUT (Original)
        // ==========================================
        card.innerHTML = `
            <div class="tool-card-content">
                <div class="tool-header">
                    <div class="tool-image-placeholder" style="overflow:hidden;">${imageContent}</div>
                    <div class="tool-info">
                        <h3 class="tool-name">${tool.toolName}</h3>
                        <p class="tool-id">ID: ${tool.toolId}</p>
                        <div class="availability-status flex flex-wrap gap-2 mt-2">
                            <span class="px-3 py-1 rounded-full border ${statusColorClass} text-sm font-bold flex items-center gap-2 w-fit">
                                ${availText}
                            </span>
                            <span class="px-3 py-1 rounded-full border text-indigo-800 bg-indigo-100 border-indigo-200 text-sm font-bold flex items-center gap-2 w-fit">
                                <span class="material-symbols-outlined text-[16px]">warehouse</span>
                                ${tool.location}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="tool-actions mt-auto pt-4">
                    ${actionButton}
                </div>
            </div>
        `;
    } else {
        // ==========================================
        // MOBILE LAYOUT (Compact Row)
        // ==========================================
        card.innerHTML = `
            <div class="tool-card-content relative pr-10"> <!-- Right padding for button -->
                <!-- Top Right Action Button -->
                <div class="absolute -top-1 -right-1 z-10">
                    ${actionButton}
                </div>

                <div class="tool-header">
                    <div class="tool-image-placeholder">${imageContent}</div>
                    <div class="tool-info">
                        <h3 class="tool-name">${tool.toolName}</h3>
                        <p class="tool-id">ID: ${tool.toolId}</p>
                        
                        <!-- Compact Metadata Row -->
                        <div class="flex items-center gap-2 mt-1 text-xs flex-wrap">
                            <span class="px-1.5 py-0.5 rounded border ${statusColorClass} font-bold text-[10px]">
                                ${availText}
                            </span>
                            <span class="px-1.5 py-0.5 rounded border text-indigo-800 bg-indigo-100 border-indigo-200 font-bold text-[10px] flex items-center gap-1">
                                <span class="material-symbols-outlined text-[12px]">warehouse</span>
                                ${tool.location}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    return card;
}

// Wrappers for inline onclick
window.addToCartWrapper = function (toolId) {
    const tool = tools.find(t => t.toolId === toolId);
    if (tool) addToCart(tool);
}

window.addToReturnCartWrapper = function (toolId) {
    const tool = tools.find(t => t.toolId === toolId);
    if (tool) addToReturnCart(tool);
}

window.removeFromReturnCartWrapper = function (toolId) {
    const index = returnCart.findIndex(item => item.tool.toolId === toolId);
    if (index !== -1) removeFromReturnCart(index);
}

window.updateCartQtyFromCard = function (toolId, change) {
    const index = cart.findIndex(item => item.tool.toolId === toolId);
    if (index === -1) return;

    const item = cart[index];
    const max = item.tool.availableQty === 'จำนวนมาก' ? 99 : item.tool.availableQty;
    const newQty = item.quantity + change;

    if (newQty <= 0) {
        removeFromCart(index);
    } else if (newQty <= max) {
        item.quantity = newQty;
        updateCartUI();
        renderTools(filteredTools);
    } else {
        showMessage(`Max quantity is ${max}`, "error");
    }
}

window.showReturnModalWrapper = function (toolId) {
    const tool = tools.find(t => t.toolId === toolId);
    if (tool) addToReturnCart(tool);
}

window.toggleReturnSelection = function (toolId) {
    const tool = tools.find(t => t.toolId === toolId);
    if (tool) addToReturnCart(tool);
}

// ==========================================
// CART LOGIC
// ==========================================

function addToCart(tool) {
    if (!currentUser && !(typeof liff !== 'undefined' && liff.isLoggedIn && liff.isLoggedIn())) {
        showRegistrationModal();
        return;
    }

    if (returnCart.length > 0) {
        showMessage("Please clear your return cart first", "error");
        return;
    }

    const existingItem = cart.find(item => item.tool.toolId === tool.toolId);

    if (existingItem) {
        if (tool.availableQty !== 'จำนวนมาก' && existingItem.quantity >= tool.availableQty) {
            showMessage("Max quantity reached for this item", "error");
            return;
        }
        existingItem.quantity += 1;
    } else {
        cart.push({
            tool: tool,
            quantity: 1,
            imageFile: null,
            imageBase64: null
        });
    }

    showMessage(`Added ${tool.toolName} to cart`, "success");
    updateCartUI();
    renderTools(filteredTools);
}

function addToReturnCart(tool) {
    if (cart.length > 0) {
        showMessage("Please clear your borrow cart first", "error");
        return;
    }

    const existing = returnCart.find(item => item.tool.toolId === tool.toolId);
    if (existing) return;

    returnCart.push({
        tool: tool,
        condition: 'สภาพดี',
        notes: '',
        imageBase64: null,
        imageFile: null
    });

    showMessage(`Added ${tool.toolName} to return list`, "success");
    updateCartUI();
    renderTools(filteredTools);
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartUI();
    if (elements.cartModal && !elements.cartModal.classList.contains('hidden')) {
        renderCartItems();
    }
    renderTools(filteredTools);
}

function removeFromReturnCart(index) {
    returnCart.splice(index, 1);
    updateCartUI();
    if (elements.cartModal && !elements.cartModal.classList.contains('hidden')) {
        renderReturnCartItems();
    }
    renderTools(filteredTools);
}

function clearCart() {
    cart = [];
    returnCart = [];
    updateCartUI();
    closeCartModal();
    renderTools(filteredTools);
}

function updateCartUI() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0) + returnCart.length;

    if (elements.cartBadge) {
        elements.cartBadge.textContent = totalItems;
        if (totalItems === 0) elements.cartBadge.classList.add('hidden');
        else elements.cartBadge.classList.remove('hidden');
    }

    if (elements.cartFab) {
        if (totalItems > 0) {
            elements.cartFab.classList.remove('hidden');
            elements.cartFab.classList.add('flex');
        } else {
            elements.cartFab.classList.add('hidden');
            elements.cartFab.classList.remove('flex');
        }
    }

    if (elements.cartBadgeDesktop) {
        elements.cartBadgeDesktop.textContent = totalItems;
        if (totalItems === 0) elements.cartBadgeDesktop.classList.add('hidden');
        else elements.cartBadgeDesktop.classList.remove('hidden');
    }

    if (elements.cartTotalCount) elements.cartTotalCount.textContent = totalItems;
}

function openCartModal() {
    if (cart.length === 0 && returnCart.length === 0) {
        showMessage("Cart is empty", "error");
        return;
    }

    const modal = elements.cartModal;
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    if (returnCart.length > 0) {
        renderReturnCartItems();
    } else {
        renderCartItems();
        const returnDateInput = document.getElementById('cartReturnDate');
        if (returnDateInput && !returnDateInput.value) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            returnDateInput.value = formatDate(tomorrow);
        }
    }
}

function closeCartModal() {
    if (elements.cartModal) {
        elements.cartModal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

function renderReturnCartItems() {
    const listContainer = elements.cartItemsList;
    const modal = elements.cartModal;
    if (!listContainer || !modal) return;

    const titleEl = modal.querySelector('h2');
    if (titleEl) titleEl.textContent = "Return Items";

    const commonDetails = document.getElementById('cartCommonDetails');
    const actions = document.getElementById('cartModalActions');

    if (commonDetails) commonDetails.classList.add('hidden');
    if (actions) actions.classList.remove('hidden');

    listContainer.innerHTML = '';

    returnCart.forEach((item, index) => {
        const tool = item.tool;
        const itemEl = document.createElement('div');
        itemEl.id = `return-item-${index}`;
        itemEl.className = 'flex flex-col gap-3 bg-white dark:bg-[#231f29] p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-colors';

        let imgPreviewHTML = '';
        if (item.imageBase64) {
            imgPreviewHTML = `
                <div class="relative w-full h-32 rounded-lg overflow-hidden mt-2 border border-gray-200">
                    <img src="${item.imageBase64}" class="w-full h-full object-cover">
                </div>
            `;
        }

        const uploadLabelClass = item.imageBase64
            ? 'bg-green-50 text-green-700 border-green-200'
            : 'bg-white text-primary border-primary/30';

        const uploadLabelText = item.imageBase64
            ? '<span class="material-symbols-outlined">check</span> Photo Added'
            : '<span class="material-symbols-outlined text-[18px]">camera_alt</span> Take Condition Photo *';

        itemEl.innerHTML = `
             <div class="flex items-start gap-4">
                <div class="w-16 h-16 bg-gray-200 rounded-lg shrink-0 overflow-hidden">
                    ${tool.imageUrl ? `<img src="${tool.imageUrl}" class="w-full h-full object-cover">` : ''}
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="font-bold text-[#141216] dark:text-white truncate">${tool.toolName}</h4>
                    <p class="text-xs text-gray-500">ID: ${tool.toolId}</p>
                </div>
                <button onclick="removeFromReturnCart(${index})" class="text-gray-400 hover:text-red-500 transition-colors">
                    <span class="material-symbols-outlined text-[20px]">close</span>
                </button>
            </div>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <select id="ret-cond-${index}" class="h-10 rounded-lg border-gray-300 text-sm bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-600" onchange="returnCart[${index}].condition = this.value">
                    <option value="สภาพดี" ${item.condition === 'สภาพดี' ? 'selected' : ''}>สภาพดี (Good)</option>
                    <option value="ได้รับความเสียหาย" ${item.condition === 'ได้รับความเสียหาย' ? 'selected' : ''}>เสียหาย (Damaged)</option>
                    <option value="ใช้แล้วหมดไป" ${item.condition === 'ใช้แล้วหมดไป' ? 'selected' : ''}>สูญหาย/หมด (Lost/Consumed)</option>
                </select>
                <input type="text" placeholder="Notes..." class="h-10 rounded-lg border-gray-300 text-sm bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-600 px-2" value="${item.notes}" onchange="returnCart[${index}].notes = this.value">
            </div>
            
            <div class="mt-2">
                <input type="file" id="ret-img-${index}" accept="image/*" class="hidden" onchange="handleReturnBatchImage(this, ${index})">
                <label for="ret-img-${index}" class="cursor-pointer flex items-center justify-center gap-2 text-sm font-bold border px-3 py-2 rounded-lg w-full transition-colors ${uploadLabelClass}" id="ret-lbl-${index}">
                    ${uploadLabelText}
                </label>
                ${imgPreviewHTML}
            </div>
        `;
        listContainer.appendChild(itemEl);
    });

    const confirmBtn = document.getElementById('confirmCartBorrow');
    const clearBtn = document.getElementById('clearCartBtn');

    if (confirmBtn) {
        confirmBtn.textContent = "Confirm Return";
        confirmBtn.onclick = submitBatchReturn;
    }
    if (clearBtn) {
        clearBtn.onclick = clearCart;
    }
}

function renderCartItems() {
    const listContainer = elements.cartItemsList;
    if (!listContainer) return;

    const commonDetails = document.getElementById('cartCommonDetails');
    const actions = document.getElementById('cartModalActions');
    const modal = elements.cartModal;

    if (modal) {
        const titleEl = modal.querySelector('h2');
        if (titleEl) titleEl.textContent = "My Cart";
    }

    const confirmBtn = document.getElementById('confirmCartBorrow');
    if (confirmBtn) {
        confirmBtn.textContent = "Confirm Borrow";
        confirmBtn.onclick = handleCartSubmit;
    }

    listContainer.innerHTML = '';

    if (cart.length === 0) {
        listContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center py-10 text-gray-400">
                <span class="material-symbols-outlined text-6xl mb-2">remove_shopping_cart</span>
                <p class="text-lg font-bold">${t('msg_cart_empty')}</p>
            </div>
        `;
        if (commonDetails) commonDetails.classList.add('hidden');
        if (actions) actions.classList.add('hidden');
        return;
    }

    if (commonDetails) commonDetails.classList.remove('hidden');
    if (actions) actions.classList.remove('hidden');

    cart.forEach((item, index) => {
        const tool = item.tool;
        const maxQty = tool.availableQty === 'จำนวนมาก' ? 99 : tool.availableQty;

        const itemEl = document.createElement('div');
        itemEl.id = `cart-item-${index}`;
        itemEl.className = 'flex flex-col sm:flex-row gap-4 bg-white dark:bg-[#231f29] p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative transition-colors';

        let thumb = `<div class="w-16 h-16 bg-gray-200 rounded-lg shrink-0"></div>`;
        if (tool.imageUrl) {
            thumb = `<div class="w-16 h-16 bg-gray-200 rounded-lg shrink-0 overflow-hidden"><img src="${tool.imageUrl}" class="w-full h-full object-cover"></div>`;
        }

        let imgPreviewHTML = '';
        let uploadLabelHTML = `
            <label for="cart-img-${index}" class="cursor-pointer flex items-center gap-2 text-primary hover:text-primary-hover transition-colors text-sm font-bold border border-primary px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2d2a35]">
                <span class="material-symbols-outlined text-[18px]">add_a_photo</span>
                ${item.imageBase64 ? 'Change Photo' : 'Take Photo (Required)'}
            </label>
        `;

        if (item.imageBase64) {
            imgPreviewHTML = `
                <div class="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-300 mt-2 sm:mt-0">
                    <img src="${item.imageBase64}" class="w-full h-full object-cover">
                </div>
            `;
        }

        itemEl.innerHTML = `
            ${thumb}
            <div class="flex-1 min-w-0">
                <h4 class="font-bold text-[#141216] dark:text-white truncate">${tool.toolName}</h4>
                <p class="text-xs text-gray-500 mb-2">ID: ${tool.toolId}</p>
                
                <div class="flex flex-wrap items-center gap-4">
                    <div class="flex items-center border border-gray-300 dark:border-primary rounded-lg h-8 overflow-hidden">
                        <button class="w-8 h-full flex items-center justify-center hover:bg-gray-100 dark:text-primary dark:hover:bg-primary dark:hover:text-white transition-colors" onclick="updateCartQty(${index}, -1)">-</button>
                        <span class="px-2 text-sm font-bold min-w-[20px] text-center dark:text-white">${item.quantity}</span>
                        <button class="w-8 h-full flex items-center justify-center hover:bg-gray-100 dark:text-primary dark:hover:bg-primary dark:hover:text-white transition-colors" onclick="updateCartQty(${index}, 1)">+</button>
                    </div>

                    <div class="flex items-center gap-2">
                        <input type="file" id="cart-img-${index}" accept="image/*" class="hidden" onchange="handleCartImageUpload(this, ${index})">
                        ${uploadLabelHTML}
                        ${imgPreviewHTML}
                    </div>
                </div>
                ${!item.imageBase64 ? '<p class="text-error text-[10px] mt-1">* Photo required</p>' : ''}
            </div>
            
            <button onclick="removeFromCart(${index})" class="absolute top-2 right-2 text-gray-400 hover:text-error transition-colors">
                <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
        `;

        listContainer.appendChild(itemEl);
    });
}

window.updateCartQty = function (index, change) {
    const item = cart[index];
    const max = item.tool.availableQty === 'จำนวนมาก' ? 99 : item.tool.availableQty;
    const newQty = item.quantity + change;

    if (newQty >= 1 && newQty <= max) {
        item.quantity = newQty;
        renderCartItems();
        updateCartUI();
    }
}

window.handleCartImageUpload = async function (input, index) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if (file.size > 3 * 1024 * 1024) {
            alert('File too large (Max 3MB)');
            return;
        }
        try {
            const base64 = await convertToBase64(file);
            cart[index].imageFile = file;
            cart[index].imageBase64 = base64;
            renderCartItems();

            const el = document.getElementById(`cart-item-${index}`);
            if (el) {
                el.classList.add('border-gray-200', 'dark:border-gray-700');
                el.classList.remove('border-red-500', 'ring-2', 'ring-red-500/20');
            }
        } catch (e) {
            console.error("Image error", e);
        }
    }
}

async function handleCartSubmit() {
    const reason = document.getElementById('cartReason').value.trim();
    const returnDate = document.getElementById('cartReturnDate').value;

    if (!reason || !returnDate) {
        showMessage("Please fill in Return Date and Reason", "error");
        return;
    }

    let hasError = false;
    cart.forEach((item, index) => {
        const el = document.getElementById(`cart-item-${index}`);
        if (!item.imageBase64) {
            if (el) {
                el.classList.remove('border-gray-200', 'dark:border-gray-700');
                el.classList.add('border-red-500', 'ring-2', 'ring-red-500/20');
            }
            hasError = true;
        } else {
            if (el) {
                el.classList.add('border-gray-200', 'dark:border-gray-700');
                el.classList.remove('border-red-500', 'ring-2', 'ring-red-500/20');
            }
        }
    });

    if (hasError) {
        showMessage("Please take a photo for highlighted items", "error");
        return;
    }

    showLoading(true);
    try {
        const batchData = {
            userId: getUserId(),
            reason: reason,
            expectedReturnDate: returnDate,
            items: cart.map(item => ({
                toolId: item.tool.toolId,
                quantity: item.quantity,
                imageBase64: item.imageBase64,
                imageName: `borrow_${item.tool.toolId}_${Date.now()}.jpg`
            }))
        };

        cart.forEach(item => {
            const tIndex = tools.findIndex(t => t.toolId === item.tool.toolId);
            if (tIndex !== -1) {
                tools[tIndex].myBorrowedQty = (tools[tIndex].myBorrowedQty || 0) + item.quantity;
                if (tools[tIndex].availableQty !== 'จำนวนมาก') {
                    tools[tIndex].availableQty -= item.quantity;
                }
            }
        });

        await apiFunctions.borrowToolBatch(batchData);

        clearCart();
        closeCartModal();
        await loadTools();
        showMessage("Batch borrow successful!", "success");

    } catch (e) {
        console.error("Batch borrow error", e);
        showMessage("Failed to borrow items. " + e.message, "error");
    } finally {
        showLoading(false);
    }
}

// ==========================================
// RETURN SELECTION LOGIC
// ==========================================

function toggleReturnMode() {
    isReturnMode = !isReturnMode;
    returnSelection.clear();

    const btn = elements.returnModeBtn;
    if (isReturnMode) {
        btn.classList.add('bg-red-100', 'text-red-600', 'border-red-200');
        btn.innerHTML = `<span class="material-symbols-outlined text-[18px] mr-1">close</span> Cancel Return`;

        const borrowedBtn = document.querySelector('.filter-btn[data-filter="borrowed"]');
        if (borrowedBtn) borrowedBtn.click();

    } else {
        btn.classList.remove('bg-red-100', 'text-red-600', 'border-red-200');
        btn.innerHTML = `<span class="material-symbols-outlined text-[18px] mr-1">check_box</span> Return Selection`;

        const allBtn = document.querySelector('.filter-btn[data-filter="all"]');
        if (allBtn) allBtn.click();
    }

    renderTools(filteredTools);
    updateReturnModeUI();
}

function updateReturnModeUI() {
    // Legacy support logic maintained for safety, but primary interaction is via Return Cart
    let returnFab = document.getElementById('returnFab');

    if (!returnFab) {
        returnFab = document.createElement('button');
        returnFab.id = 'returnFab';
        returnFab.className = 'fixed bottom-6 right-24 w-auto h-14 bg-red-600 text-white rounded-full shadow-lg flex items-center justify-center px-6 gap-2 hover:bg-red-700 hover:scale-105 active:scale-95 transition-all z-40 hidden animate-bounce';
        returnFab.innerHTML = `
            <span class="material-symbols-outlined">keyboard_return</span>
            <span class="font-bold">Return Selected (<span id="returnCount">0</span>)</span>
        `;
        returnFab.addEventListener('click', confirmReturnSelection);
        document.body.appendChild(returnFab);
    }

    const count = returnSelection.size;
    const countSpan = document.getElementById('returnCount');
    if (countSpan) countSpan.textContent = count;

    if (isReturnMode && count > 0) {
        returnFab.classList.remove('hidden');
        returnFab.classList.add('flex');
    } else {
        returnFab.classList.add('hidden');
        returnFab.classList.remove('flex');
    }
}

async function confirmReturnSelection() {
    // This connects legacy "Return Mode" selection to the new Return Cart system
    returnSelection.forEach(id => {
        const tool = tools.find(t => t.toolId === id);
        if (tool) addToReturnCart(tool);
    });
    returnSelection.clear();
    if (isReturnMode) toggleReturnMode(); // Exit return mode
    openCartModal(); // Open modal with items added
}

window.handleReturnBatchImage = async function (input, index) {
    if (input.files && input.files[0]) {
        try {
            const base64 = await convertToBase64(input.files[0]);
            returnCart[index].imageBase64 = base64;

            renderReturnCartItems();

        } catch (e) { console.error(e); }
    }
}

window.submitBatchReturn = async function () {
    let hasError = false;

    returnCart.forEach((item, index) => {
        const el = document.getElementById(`return-item-${index}`);
        if (!item.imageBase64) {
            if (el) {
                el.classList.remove('border-gray-200', 'dark:border-gray-700');
                el.classList.add('border-red-500', 'ring-2', 'ring-red-500/20');
            }
            hasError = true;
        } else {
            if (el) {
                el.classList.add('border-gray-200', 'dark:border-gray-700');
                el.classList.remove('border-red-500', 'ring-2', 'ring-red-500/20');
            }
        }
    });

    if (hasError) {
        showMessage("Please take a photo for highlighted items", "error");
        return;
    }

    showLoading(true);
    try {
        const batchData = {
            userId: getUserId(),
            items: returnCart.map(i => ({
                toolId: i.tool.toolId,
                condition: i.condition,
                notes: i.notes,
                imageBase64: i.imageBase64,
                imageName: `return_${i.tool.toolId}_${Date.now()}.jpg`
            }))
        };

        await apiFunctions.returnToolBatch(batchData);

        clearCart();
        closeCartModal();
        await loadTools();
        showMessage("Items returned successfully", "success");

    } catch (e) {
        console.error(e);
        showMessage("Return failed: " + e.message, "error");
    } finally {
        showLoading(false);
    }
}

// Helpers
function getStatusClass(status) {
    switch (status.toLowerCase()) {
        case 'available': return 'available';
        case 'borrowed': return 'borrowed';
        case 'overdue': return 'overdue';
        default: return 'available';
    }
}

function handleSearch() {
    const term = elements.searchInput.value.toLowerCase();
    const clearBtn = document.getElementById('searchClearBtn');

    if (clearBtn) {
        if (term.length > 0) {
            clearBtn.classList.remove('hidden');
            // Small delay to allow 'hidden' removal to render before adding 'show' for transition
            requestAnimationFrame(() => clearBtn.classList.add('show'));
        } else {
            clearBtn.classList.remove('show');
            setTimeout(() => clearBtn.classList.add('hidden'), 200); // Wait for transition
        }
    }

    filteredTools = tools.filter(t => t.toolName.toLowerCase().includes(term) || t.toolId.toLowerCase().includes(term));
    // Sync to mobile input if updated via desktop (keeping inline just incase, but we use floating now)
    if (elements.floatingSearchInput && elements.floatingSearchInput.value !== term) {
        elements.floatingSearchInput.value = term;
        toggleFloatingClear(term);
    }

    renderTools(filteredTools);
}

document.getElementById('searchClearBtn')?.addEventListener('click', () => {
    if (elements.searchInput) {
        elements.searchInput.value = '';
        elements.searchInput.focus();
        handleSearch();
    }
});

function handleFilterClick(event) {
    const btn = event.target.closest('.filter-btn');
    if (!btn || btn.id === 'locationFilterBtn' || btn.id === 'returnModeBtn') return;

    // Special behavior: If "All Items" is clicked, reset location and everything to default
    if (btn.dataset.filter === 'all') {
        handleLocationSelect('all');
        return;
    }

    if (isReturnMode && btn.dataset.filter !== 'borrowed') {
        toggleReturnMode();
    }

    elements.filterBtns.forEach(b => {
        if (!['locationFilterBtn', 'returnModeBtn'].includes(b.id)) b.classList.toggle('active', b === btn);
    });

    const filterValue = btn.dataset.filter;
    if (filterValue === 'all') filteredTools = [...tools];
    else filteredTools = tools.filter(t => t.status.toLowerCase() === filterValue);

    renderTools(filteredTools);
    updateFilterButtonStyles();
    syncMobileFilterBadge();
}

function updateFilterButtonStyles() {
    elements.filterBtns.forEach(btn => {
        if (['locationFilterBtn', 'returnModeBtn'].includes(btn.id)) return;

        const isActive = btn.classList.contains('active');
        const filterType = btn.dataset.filter;

        // Base active classes to remove (to reset)
        const allColorClasses = [
            'bg-secondary-container', 'text-on-secondary-container', 'border-secondary-container',
            'bg-green-100', 'text-green-800', 'border-green-200',
            'bg-amber-100', 'text-amber-800', 'border-amber-200',
            'bg-red-100', 'text-red-800', 'border-red-200',
            // Include ! versions to ensure cleanup
            '!bg-secondary-container', '!text-on-secondary-container', '!border-secondary-container',
            '!bg-green-100', '!text-green-800', '!border-green-200',
            '!bg-amber-100', '!text-amber-800', '!border-amber-200',
            '!bg-red-100', '!text-red-800', '!border-red-200'
        ];
        btn.classList.remove(...allColorClasses);

        if (isActive) {
            const statusColors = {
                'all': '!bg-secondary-container !text-on-secondary-container !border-secondary-container',
                'available': '!bg-green-100 !text-green-800 !border-green-200',
                'borrowed': '!bg-amber-100 !text-amber-800 !border-amber-200',
                'overdue': '!bg-red-100 !text-red-800 !border-red-200'
            };
            const colorClass = statusColors[filterType] || statusColors['all'];
            colorClass.split(' ').forEach(c => btn.classList.add(c));
        }
    });
}

function syncMobileFilterBadge() {
    // Check if status is filtered
    const statusActive = document.querySelector('.filter-btn.active:not(#locationFilterBtn)');
    const statusVal = statusActive ? statusActive.dataset.filter : 'all';

    // Check if location is filtered
    const locationActive = elements.locationFilterBtn?.classList.contains('active');

    const isAnyFilterActive = (statusVal !== 'all') || locationActive;

    if (elements.mobileFilterBtn) {
        elements.mobileFilterBtn.classList.toggle('filter-active', isAnyFilterActive);
    }
}

function populateLocationDropdown() {
    const locations = [...new Set(tools.map(tool => tool.location))].filter(Boolean).sort();
    const content = document.getElementById('locationDropdownContent');
    if (!content) return;

    // Get current active location from the button text
    const btnSpan = elements.locationFilterBtn?.querySelector('span[data-i18n="filter_location"]');
    const currentLoc = (elements.locationFilterBtn?.classList.contains('active') && btnSpan) ? btnSpan.textContent : 'all';

    content.innerHTML = '';

    // "All Locations" Button
    const allBtn = document.createElement('button');
    const isAllActive = currentLoc === 'all' || currentLoc === t('filter_location');
    allBtn.className = `w-full text-left px-5 py-3 text-sm transition-colors font-bold flex items-center justify-between ${isAllActive ? 'bg-indigo-50 text-indigo-800' : 'text-primary hover:bg-surface-container-high dark:hover:bg-surface-variant'}`;
    allBtn.onclick = () => handleLocationSelect('all');
    allBtn.innerHTML = `
        <span class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[20px]">inventory_2</span>
            ${t('filter_location_all')}
        </span>
        ${isAllActive ? '<span class="material-symbols-outlined text-sm font-bold">check</span>' : ''}
    `;
    content.appendChild(allBtn);

    // Location Buttons
    locations.forEach(loc => {
        const btn = document.createElement('button');
        const isActive = currentLoc === loc;
        btn.className = `w-full text-left px-5 py-3 text-sm transition-colors flex items-center justify-between ${isActive ? 'bg-indigo-50 text-indigo-800 font-bold' : 'hover:bg-surface-container-high dark:hover:bg-surface-variant dark:text-white'}`;
        btn.innerHTML = `
            <span>${loc}</span>
            ${isActive ? '<span class="material-symbols-outlined text-sm font-bold">check</span>' : ''}
        `;
        btn.onclick = () => handleLocationSelect(loc);
        content.appendChild(btn);
    });
}

function handleLocationSelect(loc) {
    document.getElementById('locationDropdown').classList.add('hidden');

    // Update Button Text
    const btnSpan = elements.locationFilterBtn?.querySelector('span[data-i18n="filter_location"]');
    if (btnSpan) {
        if (loc === 'all') {
            btnSpan.textContent = t('filter_location');
            elements.locationFilterBtn.classList.remove('active');
        } else {
            btnSpan.textContent = loc;
            elements.locationFilterBtn.classList.add('active');
        }
    }

    if (loc === 'all') filteredTools = [...tools];
    else filteredTools = tools.filter(t => t.location === loc);

    // Reset status filter buttons
    // - If location is specific (!= 'all'), REMOVE active from all status buttons (including 'All')
    // - If location is 'all', reset to 'All' status active
    elements.filterBtns.forEach(btn => {
        if (!['locationFilterBtn', 'returnModeBtn'].includes(btn.id)) {
            if (loc === 'all') {
                btn.classList.toggle('active', btn.dataset.filter === 'all');
            } else {
                btn.classList.remove('active');
            }
        }
    });
    updateFilterButtonStyles();

    renderTools(filteredTools);
    syncMobileFilterBadge();
}

// Location Btn Toggle
elements.locationFilterBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    // Re-populate to update active state just in case
    populateLocationDropdown();
    const dropdown = elements.locationDropdown;
    const btn = elements.locationFilterBtn;

    if (dropdown.classList.contains('hidden')) {
        // Show logic
        const rect = btn.getBoundingClientRect();
        dropdown.style.top = `${rect.bottom + window.scrollY + 8}px`; // 8px gap
        dropdown.style.left = `${rect.left + window.scrollX}px`;
        dropdown.classList.remove('hidden');
    } else {
        dropdown.classList.add('hidden');
    }
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (elements.locationDropdown && !elements.locationDropdown.classList.contains('hidden')) {
        if (!elements.locationDropdown.contains(e.target) && e.target !== elements.locationFilterBtn && !elements.locationFilterBtn.contains(e.target)) {
            elements.locationDropdown.classList.add('hidden');
        }
    }
});

function showReturnModal(tool) {
    // Legacy wrapper - redirect to Return Cart
    addToReturnCart(tool);
}

function showMessage(msg, type) {
    const toast = elements.messageToast;
    if (!toast) return;
    document.getElementById('messageText').textContent = msg;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.className = 'toast hidden', 3000);
}

function showLoading(show) {
    elements.loadingOverlay?.classList.toggle('hidden', !show);
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function convertToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
    });
}

function renderSkeletons() {
    if (!elements.toolsGrid) return;
    elements.toolsGrid.innerHTML = '';

    const skeletonHTML = `
        <article class="skeleton-card">
            <div class="skeleton-header">
                <div class="skeleton skeleton-img"></div>
                <div class="skeleton-info">
                    <div class="skeleton skeleton-text title"></div>
                    <div class="skeleton skeleton-text short"></div>
                    <div class="skeleton skeleton-badge" style="width: 80px; height: 20px; margin-top: 4px;"></div>
                </div>
            </div>
            <div class="skeleton-details">
                 <div class="skeleton skeleton-text" style="width: 50%;"></div>
            </div>
            <div class="skeleton skeleton-btn"></div>
        </article>
    `;

    for (let i = 0; i < 10; i++) {
        elements.toolsGrid.innerHTML += skeletonHTML;
    }
}

async function handleRegistrationSubmit(e) {
    e.preventDefault();
    const fullName = document.getElementById('fullName').value;
    const department = document.getElementById('department').value;
    const cohort = document.getElementById('cohort').value;
    showLoading(true);
    try {
        await apiFunctions.registerUser({ fullName, department, cohort, userId: getUserId() });
        currentUser = getUserInfo();
        hideRegistrationModal();
        updateUserUI();
        await loadTools();
        showMessage("Registered!", "success");
    } catch (e) { showMessage("Registration failed", "error"); }
    finally { showLoading(false); }
}

function showRegistrationModal() {
    if (elements.registrationModal) {
        elements.registrationModal.classList.remove('hidden');
        elements.registrationModal.style.display = 'flex'; // Force display flex for modal container
    }

    const loginSection = document.getElementById('lineLoginSection');
    const form = document.getElementById('registrationForm');

    let isLiffLoggedIn = false;
    try {
        // Safe check for LIFF login status
        if (typeof liff !== 'undefined' && liff.isLoggedIn) {
            isLiffLoggedIn = liff.isLoggedIn();
        }
    } catch (e) {
        console.warn("LIFF status check failed:", e);
        isLiffLoggedIn = false;
    }

    if (isLiffLoggedIn) {
        // User is logged in with LINE -> Show Form
        if (loginSection) {
            loginSection.style.display = 'none';
            loginSection.classList.add('hidden');
        }
        if (form) {
            form.style.display = 'flex'; // Force flex display
            form.classList.remove('hidden');
            form.classList.add('flex');
        }
    } else {
        // User NOT logged in -> Show Login Button
        // Ensure we force display:flex if not logged in, overriding any hidden classes
        if (loginSection) {
            loginSection.classList.remove('hidden');
            loginSection.classList.add('flex');
            loginSection.style.display = 'flex';
        }
        if (form) {
            form.style.display = 'none';
            form.classList.add('hidden');
        }
    }
}
function hideRegistrationModal() {
    if (elements.registrationModal) {
        elements.registrationModal.classList.add('hidden');
        elements.registrationModal.style.display = ''; // Reset inline style
    }
}