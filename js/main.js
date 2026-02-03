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
    loadingOverlay: document.getElementById('loadingOverlay')
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
document.getElementById('loginTriggerBtn')?.addEventListener('click', showRegistrationModal);
document.getElementById('closeRegistrationModal')?.addEventListener('click', hideRegistrationModal);
document.getElementById('registrationForm')?.addEventListener('submit', handleRegistrationSubmit);

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
    console.error("lineLoginBtn element not found in DOM");
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

function createToolCard(tool) {
    const card = document.createElement('article');
    card.className = `tool-card ${getStatusClass(tool.status)}`;
    
    // Determine Button State
    let actionButton = '';
    const isLoggedIn = !!currentUser || (typeof liff !== 'undefined' && liff.isLoggedIn && liff.isLoggedIn());
    const inCart = cart.find(item => item.tool.toolId === tool.toolId);
    
    if (isLoggedIn && tool.myBorrowedQty > 0) {
        // Check if in Return Cart
        const inReturnCart = returnCart.find(i => i.tool.toolId === tool.toolId);
        if (inReturnCart) {
             actionButton = `
                <button class="w-full py-2 rounded-lg font-bold border-2 transition-colors flex items-center justify-center gap-2 bg-red-50 text-red-600 border-red-200" onclick="removeFromReturnCartWrapper('${tool.toolId}')">
                    <span class="material-symbols-outlined text-[18px]">remove_shopping_cart</span>
                    Unselect Return
                </button>
            `;
        } else {
             actionButton = `
                <button class="btn-return" onclick="addToReturnCartWrapper('${tool.toolId}')">
                    <span class="material-symbols-outlined">keyboard_return</span>
                    ${t('btn_card_return')}
                </button>
            `;
        }
    } else if (inCart) {
        // In Cart: Show Quantity Control
        actionButton = `
            <div class="flex items-center justify-between w-full h-10 bg-green-50 border border-green-200 rounded-lg overflow-hidden">
                <button class="w-10 h-full flex items-center justify-center text-green-700 hover:bg-green-100 transition-colors" onclick="updateCartQtyFromCard('${tool.toolId}', -1)">
                    <span class="material-symbols-outlined text-[18px]">remove</span>
                </button>
                <span class="font-bold text-green-800 text-sm">${inCart.quantity}</span>
                <button class="w-10 h-full flex items-center justify-center text-green-700 hover:bg-green-100 transition-colors" onclick="updateCartQtyFromCard('${tool.toolId}', 1)">
                    <span class="material-symbols-outlined text-[18px]">add</span>
                </button>
            </div>
        `;
    } else if (tool.availableQty === 'จำนวนมาก' || tool.availableQty > 0) {
        // Available -> Add to Cart
        actionButton = `
            <button class="btn-borrow" onclick="addToCartWrapper('${tool.toolId}')">
                <span class="material-symbols-outlined">add_shopping_cart</span>
                Add to Cart
            </button>
        `;
    } else {
        // Out of Stock
        actionButton = `
             <button class="btn-borrow" disabled style="background-color: var(--gray-medium); cursor: not-allowed;">
                 <span class="material-symbols-outlined">block</span>
                 ${t('btn_card_out_of_stock')}
             </button>
        `;
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
            `${t('status_available')}: ${t('unit_many')}` : 
            `${t('status_available')}: ${tool.availableQty} ${tool.unit || t('unit_items')}`;
    } else {
        availText = tool.status;
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
                            ${availText}
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
    
    return card;
}

// Wrappers for inline onclick
window.addToCartWrapper = function(toolId) {
    const tool = tools.find(t => t.toolId === toolId);
    if (tool) addToCart(tool);
}

window.addToReturnCartWrapper = function(toolId) {
    const tool = tools.find(t => t.toolId === toolId);
    if (tool) addToReturnCart(tool);
}

window.removeFromReturnCartWrapper = function(toolId) {
    const index = returnCart.findIndex(item => item.tool.toolId === toolId);
    if (index !== -1) removeFromReturnCart(index);
}

window.updateCartQtyFromCard = function(toolId, change) {
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

window.showReturnModalWrapper = function(toolId) {
    const tool = tools.find(t => t.toolId === toolId);
    if (tool) addToReturnCart(tool); 
}

window.toggleReturnSelection = function(toolId) {
    const tool = tools.find(t => t.toolId === toolId);
    if(tool) addToReturnCart(tool);
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
            <label for="cart-img-${index}" class="cursor-pointer flex items-center gap-2 text-primary hover:text-primary-hover transition-colors text-sm font-bold border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary/5">
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
                    <div class="flex items-center border border-gray-300 rounded-lg h-8 overflow-hidden">
                        <button class="w-8 h-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" onclick="updateCartQty(${index}, -1)">-</button>
                        <span class="px-2 text-sm font-bold min-w-[20px] text-center">${item.quantity}</span>
                        <button class="w-8 h-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" onclick="updateCartQty(${index}, 1)">+</button>
                    </div>

                    <div class="flex items-center gap-2">
                        <input type="file" id="cart-img-${index}" accept="image/*" class="hidden" onchange="handleCartImageUpload(this, ${index})">
                        ${uploadLabelHTML}
                        ${imgPreviewHTML}
                    </div>
                </div>
                ${!item.imageBase64 ? '<p class="text-red-500 text-[10px] mt-1">* Photo required</p>' : ''}
            </div>
            
            <button onclick="removeFromCart(${index})" class="absolute top-2 right-2 text-gray-400 hover:text-red-500 transition-colors">
                <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
        `;
        
        listContainer.appendChild(itemEl);
    });
}

window.updateCartQty = function(index, change) {
    const item = cart[index];
    const max = item.tool.availableQty === 'จำนวนมาก' ? 99 : item.tool.availableQty;
    const newQty = item.quantity + change;
    
    if (newQty >= 1 && newQty <= max) {
        item.quantity = newQty;
        renderCartItems();
        updateCartUI();
    }
}

window.handleCartImageUpload = async function(input, index) {
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
    if(isReturnMode) toggleReturnMode(); // Exit return mode
    openCartModal(); // Open modal with items added
}

window.handleReturnBatchImage = async function(input, index) {
    if (input.files && input.files[0]) {
        try {
            const base64 = await convertToBase64(input.files[0]);
            returnCart[index].imageBase64 = base64;
            
            renderReturnCartItems();
            
        } catch (e) { console.error(e); }
    }
}

window.submitBatchReturn = async function() {
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
    filteredTools = tools.filter(t => t.toolName.toLowerCase().includes(term) || t.toolId.toLowerCase().includes(term));
    renderTools(filteredTools);
}

function handleFilterClick(event) {
    const btn = event.target.closest('.filter-btn');
    if (!btn || btn.id === 'locationFilterBtn' || btn.id === 'returnModeBtn') return; 
    
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
}

function populateLocationDropdown() {
    const locations = [...new Set(tools.map(tool => tool.location))].filter(Boolean).sort();
    const content = document.getElementById('locationDropdownContent');
    if (!content) return;
    content.innerHTML = `<button class="w-full text-left px-5 py-3 text-sm hover:bg-gray-100 font-bold" onclick="handleLocationSelect('all')">All Locations</button>`;
    locations.forEach(loc => {
        const btn = document.createElement('button');
        btn.className = 'w-full text-left px-5 py-3 text-sm hover:bg-gray-100';
        btn.textContent = loc;
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
    renderTools(filteredTools);
}

// Location Btn Toggle
elements.locationFilterBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
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
    if(!toast) return;
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

    for(let i=0; i<8; i++) {
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
        await apiFunctions.registerUser({fullName, department, cohort, userId: getUserId()});
        currentUser = getUserInfo();
        hideRegistrationModal();
        updateUserUI();
        await loadTools();
        showMessage("Registered!", "success");
    } catch(e) { showMessage("Registration failed", "error"); }
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