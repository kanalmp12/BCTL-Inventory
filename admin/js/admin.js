// ADMIN DASHBOARD LOGIC

// State
let currentTab = 'dashboard';
let currentUser = null;
let allTools = []; 
let allTransactions = []; 
let allUsers = []; 
let isEditing = false;
let editingToolId = null;
let charts = {}; // Store chart instances

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    
    // Search Listeners
    document.getElementById('toolSearchInput')?.addEventListener('input', handleSearch);
    document.getElementById('transSearchInput')?.addEventListener('input', handleTransSearch);
    document.getElementById('userSearchInput')?.addEventListener('input', handleUserSearch);

    // Tool Form Listener
    document.getElementById('toolForm')?.addEventListener('submit', handleToolSubmit);
    
    // Refresh Data on Load (if logged in)
    if (localStorage.getItem(CONFIG.SESSION_KEY) === 'true') {
        fetchAllData();
        renderAdminLogs();
    }
});

async function fetchAllData() {
    await Promise.all([
        fetchTools(),
        fetchTransactions(),
        fetchUsers()
    ]);
    initCharts();
}

// ... (Auth code) ...

// --- NAVIGATION ---

function switchTab(tabName) {
    // ... toggle logic ...
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick').includes(tabName)) {
            btn.classList.add('active');
        }
    });

    document.querySelectorAll('.view-section').forEach(view => {
        view.classList.add('hidden');
    });

    const targetView = document.getElementById(`view-${tabName}`);
    if (targetView) {
        targetView.classList.remove('hidden');
    }

    const titles = {
        'dashboard': 'Dashboard Overview',
        'tools': 'Tools Management',
        'transactions': 'Transaction Logs',
        'overdue': 'Overdue Items',
        'users': 'User Management',
        'settings': 'System Settings'
    };
    document.getElementById('pageTitle').textContent = titles[tabName] || 'Dashboard';
    
    if (window.innerWidth < 768) {
        document.getElementById('sidebar').classList.remove('open');
    }

    currentTab = tabName;
    
    // Refresh logic
    if (tabName === 'dashboard') initCharts();
    if (tabName === 'tools' && allTools.length === 0) fetchTools();
    if (tabName === 'transactions' && allTransactions.length === 0) fetchTransactions();
    if (tabName === 'users' && allUsers.length === 0) fetchUsers();
}

// ... (Tool CRUD) ...

// --- ADVANCED FEATURES (PHASE 4) ---

/**
 * Initialize Charts
 */
function initCharts() {
    if (currentTab !== 'dashboard') return;

    const inventoryCtx = document.getElementById('inventoryChart')?.getContext('2d');
    const borrowCtx = document.getElementById('borrowChart')?.getContext('2d');

    if (!inventoryCtx || !borrowCtx) return;

    // Destroy existing charts
    if (charts.inventory) charts.inventory.destroy();
    if (charts.borrow) charts.borrow.destroy();

    // Inventory Data
    const availableCount = allTools.filter(t => t.status === 'Available').length;
    const borrowedCount = allTools.filter(t => t.status === 'Borrowed').length;
    const overdueCount = allTools.filter(t => t.status === 'Overdue').length;

    charts.inventory = new Chart(inventoryCtx, {
        type: 'doughnut',
        data: {
            labels: ['Available', 'Borrowed', 'Overdue'],
            datasets: [{
                data: [availableCount, borrowedCount, overdueCount],
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
        }
    });

    // Borrow Activity (Last 7 Days)
    const last7DaysLabels = [];
    const last7DaysData = [];

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last7DaysLabels.push(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));

        // Count transactions for this specific day
        const count = allTransactions.filter(t => {
            const tDate = new Date(t.timestamp);
            return tDate.getDate() === d.getDate() &&
                   tDate.getMonth() === d.getMonth() &&
                   tDate.getFullYear() === d.getFullYear();
        }).length;
        
        last7DaysData.push(count);
    }

    charts.borrow = new Chart(borrowCtx, {
        type: 'line',
        data: {
            labels: last7DaysLabels,
            datasets: [{
                label: 'Transactions',
                data: last7DaysData,
                borderColor: '#67349d',
                tension: 0.4,
                fill: true,
                backgroundColor: 'rgba(103, 52, 157, 0.1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                y: { 
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        precision: 0
                    }
                } 
            }
        }
    });
}

/**
 * Export Tools to CSV
 */
function exportToolsToCSV() {
    if (allTools.length === 0) return;

    const headers = ['Tool ID', 'Tool Name', 'Location', 'Total Qty', 'Available Qty', 'Status'];
    const rows = allTools.map(t => [
        t.toolId, t.toolName, t.location, t.totalQty, t.availableQty, t.status
    ]);

    let csvContent = "data:text/csv;charset=utf-8,"
        + headers.join(",") + "\n"
        + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Inventory_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    logAdminAction('Exported Inventory CSV');
}

/**
 * Generate QR Code
 */
function generateQRCode(toolId) {
    // Create a temporary container
    const div = document.createElement('div');
    div.id = "temp-qr";
    div.className = "fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4";
    div.onclick = () => div.remove();
    
    div.innerHTML = `
        <div class="bg-white p-8 rounded-2xl flex flex-col items-center animate-fade-in" onclick="event.stopPropagation()">
            <h3 class="font-bold mb-4 text-gray-900">Equipment QR: ${toolId}</h3>
            <div id="qrcode-canvas"></div>
            <p class="text-xs text-gray-500 mt-4">Point camera here to borrow/return</p>
            <button onclick="this.parentElement.parentElement.remove()" class="mt-6 text-primary font-bold">Close</button>
        </div>
    `;
    document.body.appendChild(div);

    // Generate using library
    new QRCode(document.getElementById("qrcode-canvas"), {
        text: toolId,
        width: 200,
        height: 200
    });
    
    logAdminAction(`Generated QR Code for ${toolId}`);
}

/**
 * Log Admin Action (Local + Potential Backend)
 */
function logAdminAction(action) {
    const logs = JSON.parse(localStorage.getItem('admin_logs') || '[]');
    const newLog = {
        time: new Date().toLocaleString(),
        action: action,
        user: 'Super Admin'
    };
    logs.unshift(newLog);
    localStorage.setItem('admin_logs', JSON.stringify(logs.slice(0, 50)));
    renderAdminLogs();
}

function renderAdminLogs() {
    const list = document.getElementById('adminLogsList');
    if (!list) return;
    
    const logs = JSON.parse(localStorage.getItem('admin_logs') || '[]');
    if (logs.length === 0) {
        list.innerHTML = `<li class="p-4 text-center text-gray-400">No activity logs recorded yet.</li>`;
        return;
    }

    list.innerHTML = logs.map(l => `
        <li class="p-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
            <div>
                <p class="text-sm font-medium text-gray-900">${l.action}</p>
                <p class="text-xs text-gray-500">${l.user}</p>
            </div>
            <span class="text-[10px] font-mono text-gray-400">${l.time}</span>
        </li>
    `).join('');
}

// Update renderToolsTable to include QR button
// ... needs full function rewrite ...

// --- AUTHENTICATION ---

/**
 * Handle Login Submission
 */
function handleLogin(e) {
    if (e) e.preventDefault(); // Prevent form submission
    
    const pinInput = document.getElementById('adminPin');
    const errorMsg = document.getElementById('loginError');
    
    // Use user's PIN if set
    const validPin = (currentUser && currentUser.pin) ? currentUser.pin : null;

    if (validPin && pinInput.value === validPin) {
        console.log("Login Success");
        // Success
        localStorage.setItem(CONFIG.SESSION_KEY, 'true');
        showDashboard();
        fetchAllData();
    } else {
        console.log("Login Failed");
        // Fail
        errorMsg.classList.remove('hidden');
        pinInput.value = '';
        pinInput.focus();
        pinInput.classList.add('border-red-500', 'ring-2', 'ring-red-200');
        setTimeout(() => pinInput.classList.remove('border-red-500', 'ring-2', 'ring-red-200'), 500);
    }
    return false; // Stop propagation
}

/**
 * Check Login Session
 */
async function checkSession() {
    try {
        // 1. Initialize LIFF
        if (!CONFIG.LIFF_ID || CONFIG.LIFF_ID === 'YOUR_LIFF_ID_HERE') {
            console.error('LIFF ID not configured');
            alert("System configuration error: Missing LIFF ID.");
            return;
        }

        await liff.init({ liffId: CONFIG.LIFF_ID });

        // 2. Force Login if not logged in
        if (!liff.isLoggedIn()) {
            console.log("Not logged in to LINE. Redirecting to login...");
            liff.login({ redirectUri: window.location.href });
            return;
        }

        // 3. Get verified LINE Profile
        const profile = await liff.getProfile();
        const userId = profile.userId;

        // 4. Fetch Fresh User Data from Backend (Verify Role & PIN)
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'checkUser', userId: userId })
        });
        const result = await response.json();
        
        if (!result.exists || result.user.role !== 'admin') {
            alert("Access Denied: You do not have admin privileges.");
            window.location.href = '../index.html';
            return;
        }

        // 5. Update local state with verified data
        currentUser = result.user;
        // Also save pictureUrl from LINE if not in sheet
        if (!currentUser.pictureUrl) currentUser.pictureUrl = profile.pictureUrl;
        
        localStorage.setItem(CONFIG.USER_INFO_KEY, JSON.stringify(currentUser));

        // 6. Check PIN Status (Priority 1)
        if (!currentUser.pin || currentUser.pin.trim() === "") {
            console.log("No PIN set for this admin. Forcing setup.");
            showSetupPinModal(true); // true = force setup
            return;
        }

        // 7. Check if already unlocked in this session
        const isAdminSession = localStorage.getItem(CONFIG.SESSION_KEY);
        if (isAdminSession === 'true') {
            showDashboard();
        } else {
            showLogin();
        }

    } catch (error) {
        console.error("Authentication error:", error);
        alert("Authentication failed. Please refresh or try again.");
    }
}

/**
 * Show Login Screen
 */
function showLogin() {
    document.getElementById('setupPinModal').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('adminLayout').classList.add('hidden');
    
    // Optional: Personalize Login Screen
    const title = document.querySelector('#loginScreen h1');
    if (title && currentUser) {
        title.innerHTML = `Hello, ${currentUser.fullName.split(' ')[0]}<br><span class="text-lg font-normal text-gray-500">Enter your PIN</span>`;
    }
}

/**
 * Show Setup PIN Modal
 * @param {boolean} isForced - If true, user cannot cancel/close (for first time setup)
 */
function showSetupPinModal(isForced = false) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('adminLayout').classList.add('hidden');
    document.getElementById('setupPinModal').classList.remove('hidden');
    
    const cancelBtn = document.getElementById('setupPinCancel');
    const title = document.getElementById('setupPinTitle');
    
    if (isForced) {
        cancelBtn.classList.add('hidden');
        title.textContent = "Set Admin PIN";
    } else {
        cancelBtn.classList.remove('hidden');
        title.textContent = "Change PIN";
    }
    
    document.getElementById('setupPinForm').reset();
}

/**
 * Close Setup PIN Modal
 */
function closeSetupPinModal() {
    document.getElementById('setupPinModal').classList.add('hidden');
    // If we are logged in, go back to dashboard
    if (localStorage.getItem(CONFIG.SESSION_KEY) === 'true') {
        showDashboard();
    } else {
        // If not logged in (e.g. from Forgot PIN), go back to login
        showLogin();
    }
}

/**
 * Open Change PIN Modal (From Settings)
 */
function openChangePinModal() {
    showSetupPinModal(false);
}

/**
 * Handle Setup PIN Submission
 */
async function handleSetupPin(e) {
    e.preventDefault();
    
    const newPin = document.getElementById('newPin').value;
    const confirmPin = document.getElementById('confirmPin').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    if (newPin !== confirmPin) {
        alert("PIN codes do not match!");
        return;
    }
    
    if (newPin.length !== 4) {
        alert("PIN must be 4 digits!");
        return;
    }
    
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = "Saving...";
    
    try {
        // Update Local State
        currentUser.pin = newPin;
        localStorage.setItem(CONFIG.USER_INFO_KEY, JSON.stringify(currentUser));
        
        // Simulate API delay
        await new Promise(r => setTimeout(r, 800));
        
        alert("PIN code updated successfully!");
        
        // Auto-login after setup
        localStorage.setItem(CONFIG.SESSION_KEY, 'true');
        showDashboard();
        fetchAllData();
        
    } catch (error) {
        console.error("Error setting PIN:", error);
        alert("Failed to save PIN. Please try again.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        document.getElementById('setupPinModal').classList.add('hidden');
    }
}
    e.preventDefault();
    
    const newPin = document.getElementById('newPin').value;
    const confirmPin = document.getElementById('confirmPin').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    if (newPin !== confirmPin) {
        alert("PIN codes do not match!");
        return;
    }
    
    if (newPin.length !== 4) {
        alert("PIN must be 4 digits!");
        return;
    }
    
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = "Saving...";
    
    try {
        // In a real app, this should be an API call
        // const response = await fetch(CONFIG.API_URL, ...);
        // For now, we update local object and simulate API
        
        // Update Local State
        currentUser.pin = newPin;
        localStorage.setItem(CONFIG.USER_INFO_KEY, JSON.stringify(currentUser));
        
        // Simulate API delay
        await new Promise(r => setTimeout(r, 800));
        
        alert("PIN code updated successfully!");
        
        // Auto-login after setup
        localStorage.setItem(CONFIG.SESSION_KEY, 'true');
        showDashboard();
        fetchAllData();
        
    } catch (error) {
        console.error("Error setting PIN:", error);
        alert("Failed to save PIN. Please try again.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        document.getElementById('setupPinModal').classList.add('hidden');
    }
}

/**
 * Show Dashboard (Unlock)
 */
function showDashboard() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('setupPinModal').classList.add('hidden');
    document.getElementById('adminLayout').classList.remove('hidden');
    document.getElementById('adminLayout').classList.add('flex');
    
    // Update Admin Profile in UI
    if (currentUser) {
        const profileName = document.getElementById('adminProfileName');
        const profileDept = document.getElementById('adminProfileDept');
        const profileContainer = document.getElementById('adminProfileContainer');

        if (profileName) profileName.textContent = currentUser.fullName || 'Admin';
        if (profileDept) profileDept.textContent = currentUser.department || 'System Manager';
        
        if (profileContainer && currentUser.pictureUrl) {
            profileContainer.innerHTML = `<img src="${currentUser.pictureUrl}" class="w-full h-full object-cover">`;
        }
    }
}

/**
 * Logout
 */
function logout() {
    if(confirm('Are you sure you want to logout?')) {
        localStorage.removeItem(CONFIG.SESSION_KEY);
        // Do NOT remove user info here, they are still logged in to main app
        window.location.reload();
    }
}

// --- NAVIGATION ---

function switchTab(tabName) {
    // ... (Existing toggle logic) ...
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick').includes(tabName)) {
            btn.classList.add('active');
        }
    });

    document.querySelectorAll('.view-section').forEach(view => {
        view.classList.add('hidden');
    });

    const targetView = document.getElementById(`view-${tabName}`);
    if (targetView) {
        targetView.classList.remove('hidden');
    }

    const titles = {
        'dashboard': 'Dashboard Overview',
        'tools': 'Tools Management',
        'transactions': 'Transaction Logs',
        'overdue': 'Overdue Items',
        'users': 'User Management',
        'settings': 'System Settings'
    };
    document.getElementById('pageTitle').textContent = titles[tabName] || 'Dashboard';
    
    if (window.innerWidth < 768) {
        document.getElementById('sidebar').classList.remove('open');
    }

    currentTab = tabName;
    
    // Fetch data based on tab
    if (tabName === 'dashboard') initCharts();
    if (tabName === 'tools' && allTools.length === 0) fetchTools();
    if (tabName === 'transactions' && allTransactions.length === 0) fetchTransactions();
    if (tabName === 'overdue') renderOverdueTable(allTransactions); // Re-render to ensure fresh date calc
    if (tabName === 'users' && allUsers.length === 0) fetchUsers();
}

// ... (Sidebar toggle) ...
// ... (Tool CRUD Logic) ...

// --- TRANSACTION LOGIC ---

async function fetchTransactions() {
    const tbody = document.getElementById('transactionsTableBody');
    if (tbody && allTransactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center p-8 text-gray-500">Loading transactions...</td></tr>`;
    }

    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getTransactions' })
        });
        const data = await response.json();
        console.log("Fetched Transactions:", data);
        
        if (data.transactions) {
            allTransactions = data.transactions;
            renderTransactionsTable(allTransactions);
            renderOverdueTable(allTransactions);
            initCharts();
        } else if (data.error) {
            console.error("API Error:", data.error);
            if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center p-8 text-red-500">Error: ${data.error}</td></tr>`;
        }
    } catch (error) {
        console.error('Error fetching transactions:', error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center p-8 text-red-500">Failed to load transactions. Check console.</td></tr>`;
    }
}

function renderTransactionsTable(transactions) {
    const tbody = document.getElementById('transactionsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center p-8 text-gray-500">No transactions found.</td></tr>`;
        return;
    }

    transactions.forEach(t => {
        // Status Badge
        let statusClass = 'bg-gray-100 text-gray-600';
        if (t.status === 'Borrowed') statusClass = 'bg-orange-100 text-orange-700';
        if (t.status === 'Returned') statusClass = 'bg-green-100 text-green-700';
        if (t.status === 'Overdue') statusClass = 'bg-red-100 text-red-700';

        // Image Button
        let imageBtn = '-';
        if (t.returnImage && t.returnImage.startsWith('http')) {
            const displayUrl = formatDriveUrl(t.returnImage);
            imageBtn = `<button onclick="openImageModal('${displayUrl}')" class="text-primary hover:text-purple-700"><span class="material-icons-outlined">image</span></button>`;
        }

        // Format Date
        const date = new Date(t.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50/80 transition-colors border-b border-gray-50';
        tr.innerHTML = `
            <td class="px-6 py-4 text-gray-600 font-mono text-xs">${date}</td>
            <td class="px-6 py-4 font-medium text-gray-900">${t.userId}</td>
            <td class="px-6 py-4 text-gray-600">${t.toolId}</td>
            <td class="px-6 py-4 font-bold text-xs uppercase tracking-wide text-gray-500">${t.action}</td>
            <td class="px-6 py-4"><span class="px-2 py-1 rounded-full text-xs font-bold ${statusClass}">${t.status}</span></td>
            <td class="px-6 py-4 text-center">${imageBtn}</td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Convert Drive URL to Embeddable Link
 */
function formatDriveUrl(url) {
    if (url.includes('drive.google.com') && url.includes('/view')) {
        return url.replace('/view', '/preview');
    }
    return url;
}

function handleTransSearch(e) {
    const term = e.target.value.toLowerCase();
    const filtered = allTransactions.filter(t => 
        t.userId.toLowerCase().includes(term) || 
        t.toolId.toLowerCase().includes(term) ||
        t.status.toLowerCase().includes(term)
    );
    renderTransactionsTable(filtered);
}

// --- OVERDUE LOGIC ---

function renderOverdueTable(transactions) {
    const tbody = document.getElementById('overdueTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    console.log("Rendering Overdue Table. Total transactions:", transactions.length);

    // Filter Logic: Status is Borrowed AND Expected Return Date < Today
    const today = new Date();
    today.setHours(0,0,0,0);

    const overdueItems = transactions.filter(t => {
        if (!t.status) return false;
        const status = t.status.toLowerCase();
        if (status !== 'borrowed' && status !== 'overdue') return false;
        
        const returnDate = new Date(t.expectedReturnDate);
        if (isNaN(returnDate)) return false; // Invalid date

        return returnDate < today;
    });

    console.log("Overdue items found:", overdueItems.length);

    if (overdueItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-12 text-gray-400 flex flex-col items-center"><span class="material-icons-outlined text-4xl mb-2 text-green-200">check_circle</span>Good news! No overdue items.</td></tr>`;
        return;
    }

    overdueItems.forEach(t => {
        const dueDate = new Date(t.expectedReturnDate);
        const diffTime = Math.abs(today - dueDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-red-50/30 transition-colors border-b border-red-50';
        tr.innerHTML = `
            <td class="px-6 py-4 font-bold text-gray-900">${t.userId}</td>
            <td class="px-6 py-4 text-gray-600">${t.toolId}</td>
            <td class="px-6 py-4 text-gray-500 text-xs">${new Date(t.timestamp).toLocaleDateString()}</td>
            <td class="px-6 py-4 text-red-600 font-bold">${dueDate.toLocaleDateString()}</td>
            <td class="px-6 py-4 text-right">
                <span class="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">
                    ${diffDays} Days Late
                </span>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    // Update Badge Count
    document.getElementById('statOverdue').textContent = overdueItems.length;
}

// --- USER MANAGEMENT LOGIC ---

async function fetchUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (tbody && allUsers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-gray-500">Loading users...</td></tr>`;
    }

    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getUsers' })
        });
        const data = await response.json();
        console.log("Fetched Users:", data);
        
        if (data.users) {
            allUsers = data.users;
            renderUsersTable(allUsers);
        } else if (data.error) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-red-500">Error: ${data.error}</td></tr>`;
        }
    } catch (error) {
        console.error('Error fetching users:', error);
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-red-500">Failed to load users.</td></tr>`;
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    users.forEach(u => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 transition-colors border-b border-gray-100';
        tr.innerHTML = `
            <td class="px-6 py-4 font-mono text-gray-500 text-xs">${u.userId}</td>
            <td class="px-6 py-4 font-bold text-gray-900">${u.fullName}</td>
            <td class="px-6 py-4 text-gray-600">${u.department}</td>
            <td class="px-6 py-4 text-gray-600">${u.cohort}</td>
            <td class="px-6 py-4 text-xs text-gray-400">${new Date(u.registeredDate).toLocaleDateString()}</td>
        `;
        tbody.appendChild(tr);
    });
}

function handleUserSearch(e) {
    const term = e.target.value.toLowerCase();
    const filtered = allUsers.filter(u => 
        u.fullName.toLowerCase().includes(term) || 
        u.department.toLowerCase().includes(term) ||
        u.userId.toString().toLowerCase().includes(term)
    );
    renderUsersTable(filtered);
}

// --- IMAGE VIEWER ---

function openImageModal(url) {
    const modal = document.getElementById('imageModal');
    const frame = document.getElementById('modalFrame');
    
    // Ensure URL is embeddable
    let embedUrl = url;
    if (url.includes('drive.google.com') && url.includes('/view')) {
        embedUrl = url.replace('/view', '/preview');
    }
    
    frame.src = embedUrl;
    modal.classList.remove('hidden');
}

function closeImageModal() {
    document.getElementById('imageModal').classList.add('hidden');
    document.getElementById('modalFrame').src = '';
}

/**
 * Open Modal for Add or Edit
 */
function openToolModal(toolId = null) {
    const modal = document.getElementById('toolModal');
    const form = document.getElementById('toolForm');
    const title = document.getElementById('modalTitle');
    const idInput = document.getElementById('formToolId');
    
    form.reset();
    isEditing = !!toolId;
    editingToolId = toolId;

    if (isEditing) {
        title.textContent = "Edit Equipment";
        idInput.readOnly = true;
        idInput.classList.add('bg-gray-100', 'text-gray-500');
        
        const tool = allTools.find(t => t.toolId === toolId);
        if (tool) {
            document.getElementById('formToolName').value = tool.toolName;
            document.getElementById('formToolId').value = tool.toolId;
            document.getElementById('formLocation').value = tool.location;
            document.getElementById('formTotalQty').value = tool.totalQty || 0;
            document.getElementById('formAvailableQty').value = tool.availableQty || 0;
            document.getElementById('formUnit').value = tool.unit || "เครื่อง";
            document.getElementById('formImageUrl').value = tool.imageUrl || "";
        }
    } else {
        title.textContent = "Add New Tool";
        idInput.readOnly = false;
        idInput.classList.remove('bg-gray-100', 'text-gray-500');
    }

    modal.classList.remove('hidden');
}

/**
 * Close Modal
 */
function closeToolModal() {
    document.getElementById('toolModal').classList.add('hidden');
}

/**
 * Handle Tool Form Submit (Add/Update)
 */
async function handleToolSubmit(e) {
    e.preventDefault();
    
    const saveBtn = document.getElementById('saveToolBtn');
    const originalText = saveBtn.innerHTML;
    
    const toolData = {
        action: isEditing ? "updateTool" : "addTool",
        toolId: document.getElementById('formToolId').value,
        toolName: document.getElementById('formToolName').value,
        location: document.getElementById('formLocation').value,
        totalQty: parseInt(document.getElementById('formTotalQty').value),
        availableQty: parseInt(document.getElementById('formAvailableQty').value),
        unit: document.getElementById('formUnit').value,
        imageUrl: document.getElementById('formImageUrl').value
    };

    try {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<div class="spinner border-2 border-white border-t-transparent rounded-full w-4 h-4 animate-spin"></div> Saving...`;

        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify(toolData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(isEditing ? 'Equipment updated!' : 'New equipment added!');
            logAdminAction(isEditing ? `Updated Tool: ${toolData.toolId}` : `Added New Tool: ${toolData.toolId}`);
            closeToolModal();
            fetchTools();
        } else {
            alert('Error: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Submit error:', error);
        alert('Connection error. Please check your internet.');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

/**
 * Edit Tool
 */
function editTool(id) {
    openToolModal(id);
}

/**
 * Delete Tool
 */
async function deleteTool(id) {
    if (!confirm(`Are you sure you want to delete tool ${id}? This cannot be undone.`)) return;

    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'deleteTool', toolId: id })
        });
        
        const result = await response.json();
        if (result.success) {
            alert('Tool deleted successfully');
            logAdminAction(`Deleted Tool: ${id}`);
            fetchTools();
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        alert('Delete failed. Connection error.');
    }
}

// --- DATA LOGIC (INVENTORY) ---

/**
 * Fetch Tools from API
 */
async function fetchTools() {
    const tableBody = document.getElementById('toolsTableBody');
    if (tableBody && allTools.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center p-8"><div class="spinner border-4 border-gray-200 border-t-primary rounded-full w-8 h-8 animate-spin mx-auto"></div><p class="text-gray-500 mt-2">Loading inventory...</p></td></tr>`;
    }

    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getTools' })
        });
        
        const data = await response.json();
        
        if (data.tools) {
            allTools = data.tools;
            renderToolsTable(allTools);
            updateDashboardStats(allTools);
        }
    } catch (error) {
        console.error('Error fetching tools:', error);
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center p-8 text-red-500">Failed to load data. Please try refreshing.</td></tr>`;
        }
    }
}

/**
 * Render Tools Table
 */
function renderToolsTable(tools) {
    const tbody = document.getElementById('toolsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (tools.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center p-8 text-gray-500">No tools found.</td></tr>`;
        return;
    }
    
    tools.forEach(tool => {
        let statusClass = 'bg-green-100 text-green-700 border-green-200';
        let statusText = tool.status;
        
        if (tool.status === 'Borrowed') statusClass = 'bg-orange-100 text-orange-700 border-orange-200';
        if (tool.status === 'Overdue') statusClass = 'bg-red-100 text-red-700 border-red-200';
        if (tool.availableQty === 0 && tool.status !== 'Borrowed') statusClass = 'bg-gray-100 text-gray-500 border-gray-200';

        const imageHtml = tool.imageUrl 
            ? `<img src="${tool.imageUrl}" class="w-12 h-12 object-cover rounded-lg border border-gray-200 mx-auto">`
            : `<div class="w-12 h-12 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center mx-auto"><span class="material-icons-outlined text-gray-300">image</span></div>`;

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50/80 transition-colors group';
        tr.innerHTML = `
            <td class="px-6 py-4">
                ${imageHtml}
            </td>
            <td class="px-6 py-4">
                <div class="font-bold text-gray-900 text-base">${tool.toolName}</div>
                <div class="text-gray-500 text-xs mt-0.5 font-mono">ID: ${tool.toolId}</div>
            </td>
            <td class="px-6 py-4">
                <span class="font-bold text-gray-900">${tool.availableQty}</span>
                <span class="text-gray-400 text-xs">/ ${tool.totalQty || '?'}</span>
            </td>
            <td class="px-6 py-4 text-gray-600 font-medium">${tool.location}</td>
            <td class="px-6 py-4">
                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${statusClass}">
                    ${statusText}
                </span>
            </td>
            <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button onclick="editTool('${tool.toolId}')" class="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Edit">
                        <span class="material-icons-outlined text-[20px]">edit</span>
                    </button>
                    <button onclick="deleteTool('${tool.toolId}')" class="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                        <span class="material-icons-outlined text-[20px]">delete</span>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Handle Search Filter
 */
function handleSearch(e) {
    const term = e.target.value.toLowerCase();
    const filtered = allTools.filter(tool => 
        tool.toolName.toLowerCase().includes(term) || 
        tool.toolId.toLowerCase().includes(term) ||
        tool.location.toLowerCase().includes(term)
    );
    renderToolsTable(filtered);
}

/**
 * Update Dashboard Statistics
 */
function updateDashboardStats(tools) {
    const total = tools.length;
    const borrowed = tools.filter(t => t.status === 'Borrowed').length;
    const overdue = tools.filter(t => t.status === 'Overdue').length;
    const lowStock = tools.filter(t => t.availableQty !== 'จำนวนมาก' && t.availableQty < 2).length;

    document.getElementById('statTotalTools').textContent = total;
    document.getElementById('statBorrowed').textContent = borrowed;
    document.getElementById('statOverdue').textContent = overdue;
    document.getElementById('statLowStock').textContent = lowStock;
}

