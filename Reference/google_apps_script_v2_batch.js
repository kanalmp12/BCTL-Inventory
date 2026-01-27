/**
 * Tool Crib Automation - Google Apps Script Backend (V5.0 - Batch Operations Support)
 * 
 * INSTRUCTIONS:
 * 1. Go to Extensions > Apps Script in your Google Sheet.
 * 2. Replace all code in Code.gs with this content.
 * 3. Save and Deploy as Web App (Execute as: Me, Access: Anyone).
 * 4. Update the API_URL in js/config.js with the new URL.
 */

// Sheet Names
const SHEET_INVENTORY = "Inventory";
const SHEET_USERS = "Users";
const SHEET_TRANSACTIONS = "Transactions";
const SHEET_LOGS = "ActivityLogs";

/**
 * Handle POST requests
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    let result = {};

    switch (action) {
      case "getTools": result = getTools(); break;
      case "checkUser": result = checkUser(data.userId); break;
      case "registerUser": result = registerUser(data); break;
      case "borrowTool": result = borrowTool(data); break; // Legacy support
      case "borrowToolBatch": result = borrowToolBatch(data); break; // New Batch Action
      case "returnTool": result = returnTool(data); break; // Legacy support
      case "returnToolBatch": result = returnToolBatch(data); break; // New Batch Action
      case "getUserActiveBorrows": result = getUserActiveBorrows(data); break;
      case "addTool": result = addTool(data); break;
      case "updateTool": result = updateTool(data); break;
      case "deleteTool": result = deleteTool(data.toolId); break;
      case "getTransactions": result = getTransactions(); break;
      case "getUsers": result = getUsers(); break;
      case "updateUserPin": result = updateUserPin(data); break;
      case "getAdminLogs": result = getAdminLogs(); break;
      case "logAdminActivity": result = logAdminActivity(data); break;
      default: result = { error: "Invalid action" };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Setup Headers and Sample Data
 */
function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Inventory
  let inventorySheet = ss.getSheetByName(SHEET_INVENTORY);
  if (!inventorySheet) {
    inventorySheet = ss.insertSheet(SHEET_INVENTORY);
    inventorySheet.appendRow(["Tool ID", "Tool Name", "Total Qty", "Available Qty", "Unit", "Location", "Image URL"]);
  }

  // 2. Users
  let usersSheet = ss.getSheetByName(SHEET_USERS);
  if (!usersSheet) {
    usersSheet = ss.insertSheet(SHEET_USERS);
    usersSheet.appendRow(["User ID", "Full Name", "Department", "Cohort", "Registered Date", "Role", "PIN"]);
  }

  // 3. Transactions
  let transSheet = ss.getSheetByName(SHEET_TRANSACTIONS);
  if (!transSheet) {
    transSheet = ss.insertSheet(SHEET_TRANSACTIONS);
    transSheet.appendRow(["Transaction ID", "Tool ID", "User ID", "Action", "Qty", "Reason", "Expected Return", "Actual Return", "Status", "Timestamp", "Condition", "Notes", "Borrow Image", "Return Image"]);
  }

  // 4. Activity Logs
  let logsSheet = ss.getSheetByName(SHEET_LOGS);
  if (!logsSheet) {
    logsSheet = ss.insertSheet(SHEET_LOGS);
    logsSheet.appendRow(["Timestamp", "Action", "User"]);
  }
}

// ==========================================
// CORE FUNCTIONS
// ==========================================

function getTools() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_INVENTORY);
  const data = sheet.getDataRange().getValues();
  const tools = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    tools.push({
      toolId: row[0], toolName: row[1], totalQty: row[2], availableQty: row[3],
      unit: row[4], location: row[5], imageUrl: row[6],
      status: (row[3] === "จำนวนมาก" || row[3] > 0) ? "Available" : "Borrowed" 
    });
  }
  return { tools: tools };
}

function checkUser(userId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_USERS);
  if (!sheet) return { exists: false };
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == userId) {
      return { 
        exists: true, 
        user: {
          userId: data[i][0], fullName: data[i][1], department: data[i][2],
          cohort: data[i][3], role: data[i][5] || "user", pin: data[i][6] || null
        }
      };
    }
  }
  return { exists: false };
}

function registerUser(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_USERS);
  if (!sheet) setupSheet();
  sheet = ss.getSheetByName(SHEET_USERS);
  const users = sheet.getDataRange().getValues();
  
  for (let i = 1; i < users.length; i++) {
    if (users[i][0] == data.userId) {
      sheet.getRange(i + 1, 2, 1, 3).setValues([[data.fullName, data.department, data.cohort]]);
      return { success: true, message: "Profile updated" };
    }
  }
  sheet.appendRow([data.userId, data.fullName, data.department, data.cohort, new Date(), "user", ""]);
  return { success: true };
}

// ==========================================
// BATCH OPERATIONS
// ==========================================

/**
 * Batch Borrow Tool
 * payload: {
 *   userId, expectedReturnDate, reason,
 *   items: [ { toolId, quantity, imageBase64, imageName } ]
 * }
 */
function borrowToolBatch(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const inventorySheet = ss.getSheetByName(SHEET_INVENTORY);
  const transSheet = ss.getSheetByName(SHEET_TRANSACTIONS);
  const lock = LockService.getScriptLock();
  
  // Wait up to 30 seconds for other processes to finish
  lock.waitLock(30000);
  
  try {
    const invData = inventorySheet.getDataRange().getValues();
    const itemsToProcess = [];
    const inventoryUpdates = []; // Stores { rowIndex, newQty }

    // 1. Validation Phase: Check all stock availability first
    for (let k = 0; k < data.items.length; k++) {
      const item = data.items[k];
      let toolFound = false;
      
      for (let i = 1; i < invData.length; i++) {
        if (invData[i][0] == item.toolId) {
          toolFound = true;
          // Check if already processed in this batch (duplicate items in cart)
          // For simplicity, we assume frontend aggregates same items, but let's handle it safely by checking inventoryUpdates
          
          let currentAvail = Number(invData[i][3]);
          
          // Adjust availability based on previous items in this loop (if multiple same tools in list)
          const pendingDeduction = inventoryUpdates
            .filter(u => u.rowIndex === i + 1)
            .reduce((sum, u) => sum + u.deductQty, 0);
            
          currentAvail -= pendingDeduction;

          if (invData[i][3] !== "จำนวนมาก" && currentAvail < item.quantity) {
             return { error: `Not enough stock for tool ID: ${item.toolId}` };
          }
          
          itemsToProcess.push({
            ...item,
            rowIndex: i + 1,
            isUnlimited: invData[i][3] === "จำนวนมาก"
          });
          
          if (invData[i][3] !== "จำนวนมาก") {
             inventoryUpdates.push({ rowIndex: i + 1, deductQty: item.quantity });
          }
          break;
        }
      }
      if (!toolFound) return { error: `Tool ID not found: ${item.toolId}` };
    }

    // 2. Execution Phase
    const timestamp = new Date();
    
    // Update Inventory
    // We aggregate deductions per row to minimize set calls, though simple loop is fine for small batches
    for (const update of inventoryUpdates) {
       // Re-read current value to be super safe? No, we have a Lock.
       const cell = inventorySheet.getRange(update.rowIndex, 4);
       cell.setValue(cell.getValue() - update.deductQty);
    }
    
    // Process Transactions & Upload Images
    for (const item of itemsToProcess) {
       let borrowImageUrl = "";
       if (item.imageBase64) {
         try {
           const folder = getFolder("Tool_Borrow_Images");
           const blob = Utilities.newBlob(Utilities.base64Decode(item.imageBase64.split(',')[1] || item.imageBase64), MimeType.JPEG, item.imageName || `borrow_${item.toolId}.jpg`);
           const file = folder.createFile(blob);
           file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
           borrowImageUrl = file.getUrl();
         } catch (e) { borrowImageUrl = "Upload Error: " + e.toString(); }
       }
       
       transSheet.appendRow([
          Utilities.getUuid(), item.toolId, data.userId, "Borrow", 
          item.quantity, data.reason, data.expectedReturnDate, "", "Borrowed", timestamp,
          "", "", borrowImageUrl, ""
       ]);
    }
    
    return { success: true };
    
  } catch (e) {
    return { error: "Batch Process Failed: " + e.toString() };
  } finally { 
    lock.releaseLock(); 
  }
}

/**
 * Batch Return Tool
 * payload: {
 *   userId,
 *   items: [ { toolId, condition, notes, imageBase64, imageName } ]
 * }
 */
function returnToolBatch(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const inventorySheet = ss.getSheetByName(SHEET_INVENTORY);
  const transSheet = ss.getSheetByName(SHEET_TRANSACTIONS);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  
  try {
    const transData = transSheet.getDataRange().getValues();
    const invData = inventorySheet.getDataRange().getValues();
    const timestamp = new Date();
    
    // Process each item
    for (const item of data.items) {
        // Find active transaction
        let transRow = -1;
        let borrowedQty = 0;
        
        // Search backwards for latest active borrow
        for (let i = transData.length - 1; i >= 1; i--) {
          if (transData[i][1] == item.toolId && transData[i][2] == data.userId && (transData[i][8] == "Borrowed" || transData[i][8] == "Overdue")) {
            transRow = i + 1;
            borrowedQty = Number(transData[i][4]);
            // Mark as processed in our local array to prevent double counting if user has multiple same borrows?
            // For now, we take the last one. If user is returning 2 batches of same tool, they should call API twice or we need smarter logic.
            // Assumption: User returns one distinct borrowing instance per toolId in this batch.
            // Better approach: We modify the 'status' in memory or keep track of processed rows if multiple matches occur.
            transData[i][8] = "Returned_Processing"; // Temporary marker in memory
            break;
          }
        }
        
        if (transRow === -1) {
           // Skip if not found, or error? Let's log error but continue others?
           // return { error: `No active borrow found for ${item.toolId}` };
           continue; 
        }

        // Update Inventory
        for (let j = 1; j < invData.length; j++) {
          if (invData[j][0] == item.toolId && invData[j][3] !== "จำนวนมาก") {
            const currentVal = inventorySheet.getRange(j + 1, 4).getValue();
            inventorySheet.getRange(j + 1, 4).setValue(currentVal + borrowedQty);
            break;
          }
        }
        
        // Upload Image
        let returnImageUrl = "";
        if (item.imageBase64) {
          try {
            const folder = getFolder("Tool_Return_Images");
            const blob = Utilities.newBlob(Utilities.base64Decode(item.imageBase64.split(',')[1] || item.imageBase64), MimeType.JPEG, item.imageName || `return_${item.toolId}.jpg`);
            const file = folder.createFile(blob);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            returnImageUrl = file.getUrl();
          } catch (e) { returnImageUrl = "Upload Error: " + e.toString(); }
        }

        // Update Transaction
        transSheet.getRange(transRow, 8).setValue(timestamp); // Actual Return Date
        transSheet.getRange(transRow, 9).setValue("Returned"); // Status
        transSheet.getRange(transRow, 11).setValue(item.condition || ""); // Condition
        transSheet.getRange(transRow, 12).setValue(item.notes || ""); // Notes
        transSheet.getRange(transRow, 14).setValue(returnImageUrl); // Return Image
    }
    
    return { success: true };
    
  } catch (e) {
    return { error: "Batch Return Failed: " + e.toString() };
  } finally { 
    lock.releaseLock(); 
  }
}

// ==========================================
// LEGACY HANDLERS (Keep for backward compatibility if needed)
// ==========================================

function borrowTool(data) {
  // Wrapper to call batch with 1 item
  return borrowToolBatch({
    userId: data.userId,
    expectedReturnDate: data.expectedReturnDate,
    reason: data.reason,
    items: [{
      toolId: data.toolId,
      quantity: data.quantity,
      imageBase64: data.imageBase64,
      imageName: data.imageName
    }]
  });
}

function returnTool(data) {
  // Wrapper to call batch with 1 item
  return returnToolBatch({
    userId: data.userId,
    items: [{
      toolId: data.toolId,
      condition: data.condition,
      notes: data.notes,
      imageBase64: data.imageBase64,
      imageName: data.imageName
    }]
  });
}

// ==========================================
// HELPERS
// ==========================================

function getTransactions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_TRANSACTIONS);
  if (!sheet) return { transactions: [] };
  const data = sheet.getDataRange().getValues();
  const transactions = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    transactions.push({
      transactionId: row[0], toolId: row[1], userId: row[2], action: row[3], quantity: row[4],
      reason: row[5], expectedReturnDate: row[6], actualReturnDate: row[7], status: row[8],
      timestamp: row[9], condition: row[10], notes: row[11],
      borrowImage: row[12] || "",
      returnImage: row[13] || ""
    });
  }
  return { transactions: transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) };
}

function getAdminLogs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_LOGS);
  if (!sheet) return { logs: [] };
  const data = sheet.getDataRange().getValues();
  const logs = [];
  const start = Math.max(1, data.length - 50);
  for (let i = data.length - 1; i >= start; i--) {
    logs.push({ time: data[i][0], action: data[i][1], user: data[i][2] });
  }
  return { logs: logs };
}

function logAdminActivity(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_LOGS) || ss.insertSheet(SHEET_LOGS);
  sheet.appendRow([new Date(), data.logAction, data.logUser]);
  return { success: true };
}

function getFolder(name) {
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}

function getUserActiveBorrows(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_TRANSACTIONS);
  if (!sheet) return { borrows: [] };
  const transData = sheet.getDataRange().getValues();
  const borrows = [];
  for (let i = 1; i < transData.length; i++) {
    if (transData[i][2] == data.userId && (transData[i][8] == "Borrowed" || transData[i][8] == "Overdue")) {
      borrows.push({ toolId: transData[i][1], quantity: transData[i][4], status: transData[i][8] });
    }
  }
  return { borrows: borrows };
}

function getUsers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_USERS);
  if (!sheet) return { users: [] };
  const data = sheet.getDataRange().getValues();
  const users = [];
  for (let i = 1; i < data.length; i++) {
    users.push({ userId: data[i][0], fullName: data[i][1], department: data[i][2], cohort: data[i][3], registeredDate: data[i][4], role: data[i][5] || "user", pin: data[i][6] || "" });
  }
  return { users: users };
}

function addTool(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_INVENTORY);
  const invData = sheet.getDataRange().getValues();
  for (let i = 1; i < invData.length; i++) if (invData[i][0] == data.toolId) return { error: "Tool ID already exists" };
  sheet.appendRow([data.toolId, data.toolName, data.totalQty, data.totalQty, data.unit, data.location, data.imageUrl || ""]);
  return { success: true };
}

function updateTool(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_INVENTORY);
  const invData = sheet.getDataRange().getValues();
  let r = -1;
  for (let i = 1; i < invData.length; i++) if (invData[i][0] == data.toolId) { r = i + 1; break; }
  if (r == -1) return { error: "Tool not found" };
  sheet.getRange(r, 2, 1, 6).setValues([[data.toolName, data.totalQty, data.availableQty, data.unit, data.location, data.imageUrl]]);
  return { success: true };
}

function deleteTool(id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_INVENTORY);
  const invData = sheet.getDataRange().getValues();
  for (let i = 1; i < invData.length; i++) if (invData[i][0] == id) { sheet.deleteRow(i + 1); return { success: true }; }
  return { error: "Tool not found" };
}

function updateUserPin(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_USERS);
  const users = sheet.getDataRange().getValues();
  for (let i = 1; i < users.length; i++) if (users[i][0] == data.userId) { sheet.getRange(i + 1, 7).setValue(data.pin); return { success: true }; }
  return { success: false, error: "User not found" };
}