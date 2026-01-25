/**
 * Tool Crib Automation - Google Apps Script Backend (Updated V4.0 - Admin PIN)
 * 
 * INSTRUCTIONS:
 * 1. Create a new Google Sheet (or use your existing one).
 * 2. Go to Extensions > Apps Script.
 * 3. Delete any code in Code.gs and paste this entire script.
 * 4. Save the project.
 * 5. Run the 'setupSheet' function once to create/update sheets and headers.
 *    (IMPORTANT: This version adds a "PIN" column to the "Users" sheet).
 * 6. Click 'Deploy' > 'New deployment'.
 * 7. Select type 'Web app', Execute as 'Me', Access 'Anyone'.
 * 8. Copy the 'Web App URL' and paste it into your `js/config.js` file.
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
      case "getTools":
        result = getTools();
        break;
      case "checkUser":
        result = checkUser(data.userId);
        break;
      case "registerUser":
        result = registerUser(data);
        break;
      case "borrowTool":
        result = borrowTool(data);
        break;
      case "returnTool":
        result = returnTool(data);
        break;
      case "getUserActiveBorrows":
        result = getUserActiveBorrows(data);
        break;
      case "addTool":
        result = addTool(data);
        break;
      case "updateTool":
        result = updateTool(data);
        break;
      case "deleteTool":
        result = deleteTool(data.toolId);
        break;
      case "getTransactions":
        result = getTransactions();
        break;
      case "getUsers":
        result = getUsers();
        break;
      case "updateUserPin":
        result = updateUserPin(data);
        break;
      case "getAdminLogs":
        result = getAdminLogs();
        break;
      case "logAdminActivity":
        result = logAdminActivity(data);
        break;
      default:
        result = { error: "Invalid action" };
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
    inventorySheet.appendRow(["T001", "Example Tool", 10, 10, "เครื่อง", "Cabinet A-01", ""]);
  }

  // 2. Users
  let usersSheet = ss.getSheetByName(SHEET_USERS);
  if (!usersSheet) {
    usersSheet = ss.insertSheet(SHEET_USERS);
    // Columns: User ID, Full Name, Department, Cohort, Registered Date, Role, PIN
    usersSheet.appendRow(["User ID", "Full Name", "Department", "Cohort", "Registered Date", "Role", "PIN"]);
  } else {
    // If sheet exists, check headers
    const headers = usersSheet.getRange(1, 1, 1, 7).getValues()[0];
    if (headers[5] !== "Role") {
      usersSheet.getRange(1, 6).setValue("Role");
    }
    if (headers[6] !== "PIN") {
      usersSheet.getRange(1, 7).setValue("PIN");
    }
  }

  // 3. Transactions
  let transSheet = ss.getSheetByName(SHEET_TRANSACTIONS);
  if (!transSheet) {
    transSheet = ss.insertSheet(SHEET_TRANSACTIONS);
    transSheet.appendRow(["Transaction ID", "Tool ID", "User ID", "Action", "Qty", "Reason", "Expected Return", "Actual Return", "Status", "Timestamp", "Condition", "Notes", "Return Image", "Borrow Image"]);
  } else {
    // Check if Borrow Image column exists (col 14)
    const lastCol = transSheet.getLastColumn();
    if (lastCol < 14) {
      transSheet.getRange(1, 14).setValue("Borrow Image");
    }
  }

  // 4. Activity Logs
  let logsSheet = ss.getSheetByName(SHEET_LOGS);
  if (!logsSheet) {
    logsSheet = ss.insertSheet(SHEET_LOGS);
    logsSheet.appendRow(["Timestamp", "Action", "User"]);
  }
}

// ... (Existing functions: getTools, getUserActiveBorrows, checkUser, registerUser, updateUserPin) ...

/**
 * Borrow Action
 */
function borrowTool(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const inventorySheet = ss.getSheetByName(SHEET_INVENTORY);
  const transSheet = ss.getSheetByName(SHEET_TRANSACTIONS);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  
  try {
    const invData = inventorySheet.getDataRange().getValues();
    let toolRowIndex = -1;
    
    for (let i = 1; i < invData.length; i++) {
      if (invData[i][0] == data.toolId) {
        toolRowIndex = i + 1;
        if (invData[i][3] !== "จำนวนมาก") {
          const currentAvail = Number(invData[i][3]);
          if (currentAvail < data.quantity) return { error: "Not enough stock" };
          inventorySheet.getRange(toolRowIndex, 4).setValue(currentAvail - data.quantity);
        }
        break;
      }
    }
    
    if (toolRowIndex == -1) return { error: "Tool not found" };
    
    // Handle Image Upload
    let borrowImageUrl = "";
    if (data.imageBase64) {
      try {
        const folderName = "Tool_Borrow_Images";
        const folders = DriveApp.getFoldersByName(folderName);
        const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
        
        const base64Data = data.imageBase64.split(',')[1] || data.imageBase64;
        const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), MimeType.JPEG, data.imageName || `borrow_${data.toolId}.jpg`);
        
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        
        borrowImageUrl = file.getUrl();
      } catch (e) {
        borrowImageUrl = "Upload Error: " + e.toString();
      }
    }

    transSheet.appendRow([
      Utilities.getUuid(), data.toolId, data.userId, "Borrow", 
      data.quantity, data.reason, data.expectedReturnDate, "", "Borrowed", new Date(),
      "", "", "", borrowImageUrl
    ]);
    
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Return Action
 */
function returnTool(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const inventorySheet = ss.getSheetByName(SHEET_INVENTORY);
  const transSheet = ss.getSheetByName(SHEET_TRANSACTIONS);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  
  try {
    const transData = transSheet.getDataRange().getValues();
    let borrowedQty = 0;
    let transRow = -1;
    
    for (let i = transData.length - 1; i >= 1; i--) {
      if (transData[i][1] == data.toolId && transData[i][2] == data.userId && (transData[i][8] == "Borrowed" || transData[i][8] == "Overdue")) {
        transRow = i + 1;
        borrowedQty = Number(transData[i][4]);
        break;
      }
    }
    
    const invData = inventorySheet.getDataRange().getValues();
    for (let i = 1; i < invData.length; i++) {
      if (invData[i][0] == data.toolId) {
        if (invData[i][3] !== "จำนวนมาก") {
          inventorySheet.getRange(i + 1, 4).setValue(Number(invData[i][3]) + borrowedQty);
        }
        break;
      }
    }
    
    if (transRow != -1) {
      transSheet.getRange(transRow, 8).setValue(new Date());
      transSheet.getRange(transRow, 9).setValue("Returned");
      transSheet.getRange(transRow, 11).setValue(data.condition || "");
      transSheet.getRange(transRow, 12).setValue(data.notes || "");
      
      // Handle Image Upload
      if (data.imageBase64) {
        try {
          const folderName = "Tool_Return_Images";
          const folders = DriveApp.getFoldersByName(folderName);
          const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
          
          const base64Data = data.imageBase64.split(',')[1] || data.imageBase64;
          const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), MimeType.JPEG, data.imageName || `return_${data.toolId}.jpg`);
          
          const file = folder.createFile(blob);
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          
          transSheet.getRange(transRow, 13).setValue(file.getUrl());
        } catch (e) {
          transSheet.getRange(transRow, 13).setValue("Upload Error: " + e.toString());
        }
      }
    }
    
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Add New Tool
 */
function addTool(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_INVENTORY);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  
  try {
    // Check if ID already exists
    const invData = sheet.getDataRange().getValues();
    for (let i = 1; i < invData.length; i++) {
      if (invData[i][0] == data.toolId) return { error: "Tool ID already exists" };
    }
    
    sheet.appendRow([
      data.toolId, 
      data.toolName, 
      data.totalQty, 
      data.totalQty, // Available starts as Total
      data.unit, 
      data.location, 
      data.imageUrl || ""
    ]);
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Update Existing Tool
 */
function updateTool(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_INVENTORY);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  
  try {
    const invData = sheet.getDataRange().getValues();
    let rowIdx = -1;
    
    for (let i = 1; i < invData.length; i++) {
      if (invData[i][0] == data.toolId) {
        rowIdx = i + 1;
        break;
      }
    }
    
    if (rowIdx == -1) return { error: "Tool not found" };
    
    // Update values (Tool ID, Tool Name, Total Qty, Avail Qty, Unit, Location, Image URL)
    sheet.getRange(rowIdx, 2).setValue(data.toolName);
    sheet.getRange(rowIdx, 3).setValue(data.totalQty);
    sheet.getRange(rowIdx, 4).setValue(data.availableQty);
    sheet.getRange(rowIdx, 5).setValue(data.unit);
    sheet.getRange(rowIdx, 6).setValue(data.location);
    sheet.getRange(rowIdx, 7).setValue(data.imageUrl);
    
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Delete Tool
 */
function deleteTool(toolId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_INVENTORY);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  
  try {
    const invData = sheet.getDataRange().getValues();
    for (let i = 1; i < invData.length; i++) {
      if (invData[i][0] == toolId) {
        sheet.deleteRow(i + 1);
        return { success: true };
      }
    }
    return { error: "Tool not found" };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Get All Transactions (Admin)
 */
function getTransactions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_TRANSACTIONS);
  if (!sheet) return { transactions: [] };
  
  const data = sheet.getDataRange().getValues();
  const transactions = [];
  
  // Columns: [Transaction ID, Tool ID, User ID, Action, Qty, Reason, Expected Return, Actual Return, Status, Timestamp, Condition, Notes, Return Image, Borrow Image]
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    transactions.push({
      transactionId: row[0],
      toolId: row[1],
      userId: row[2],
      action: row[3],
      quantity: row[4],
      reason: row[5],
      expectedReturnDate: row[6],
      actualReturnDate: row[7],
      status: row[8],
      timestamp: row[9],
      condition: row[10],
      notes: row[11],
      returnImage: row[12],
      borrowImage: row[13] || "" // Add borrowImage
    });
  }
  
  // Sort by timestamp descending
  transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  return { transactions: transactions };
}

/**
 * Get all tools
 */
function getTools() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_INVENTORY);
  const data = sheet.getDataRange().getValues();
  const tools = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    tools.push({
      toolId: row[0],
      toolName: row[1],
      totalQty: row[2],
      availableQty: row[3],
      unit: row[4],
      location: row[5],
      imageUrl: row[6],
      status: (row[3] === "จำนวนมาก" || row[3] > 0) ? "Available" : "Borrowed" 
    });
  }
  return { tools: tools };
}

/**
 * Get items currently borrowed by user
 */
function getUserActiveBorrows(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const transSheet = ss.getSheetByName(SHEET_TRANSACTIONS);
  if (!transSheet) return { borrows: [] };
  
  const transData = transSheet.getDataRange().getValues();
  const borrows = [];

  for (let i = 1; i < transData.length; i++) {
    const row = transData[i];
    if (row[2] == data.userId && (row[8] == "Borrowed" || row[8] == "Overdue")) {
      borrows.push({
        toolId: row[1],
        quantity: row[4],
        status: row[8]
      });
    }
  }
  return { borrows: borrows };
}

/**
 * Check user existence
 */
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
          userId: data[i][0],
          fullName: data[i][1],
          department: data[i][2],
          cohort: data[i][3],
          role: data[i][5] || "user",
          pin: data[i][6] || null // Return PIN (Index 6)
        }
      };
    }
  }
  return { exists: false };
}

/**
 * Register or Update User
 */
function registerUser(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_USERS);
  if (!sheet) setupSheet();
  
  sheet = ss.getSheetByName(SHEET_USERS);
  const users = sheet.getDataRange().getValues();
  
  for (let i = 1; i < users.length; i++) {
    if (users[i][0] == data.userId) {
      // Preserve Role (idx 5) and PIN (idx 6) while updating profile
      sheet.getRange(i + 1, 2, 1, 3).setValues([[data.fullName, data.department, data.cohort]]);
      return { success: true, message: "Profile updated" };
    }
  }
  
  // Append new user with default role 'user' and empty PIN
  sheet.appendRow([data.userId, data.fullName, data.department, data.cohort, new Date(), "user", ""]);
  return { success: true };
}

/**
 * Update User PIN
 */
function updateUserPin(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_USERS);
  const users = sheet.getDataRange().getValues();
  
  for (let i = 1; i < users.length; i++) {
    if (users[i][0] == data.userId) {
      // Update PIN column (Index 6 => Column 7)
      sheet.getRange(i + 1, 7).setValue(data.pin);
      return { success: true };
    }
  }
  return { success: false, error: "User not found" };
}

/**
 * Borrow Action
 */
function borrowTool(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const inventorySheet = ss.getSheetByName(SHEET_INVENTORY);
  const transSheet = ss.getSheetByName(SHEET_TRANSACTIONS);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  
  try {
    const invData = inventorySheet.getDataRange().getValues();
    let toolRowIndex = -1;
    
    for (let i = 1; i < invData.length; i++) {
      if (invData[i][0] == data.toolId) {
        toolRowIndex = i + 1;
        if (invData[i][3] !== "จำนวนมาก") {
          const currentAvail = Number(invData[i][3]);
          if (currentAvail < data.quantity) return { error: "Not enough stock" };
          inventorySheet.getRange(toolRowIndex, 4).setValue(currentAvail - data.quantity);
        }
        break;
      }
    }
    
    if (toolRowIndex == -1) return { error: "Tool not found" };
    
    transSheet.appendRow([
      Utilities.getUuid(), data.toolId, data.userId, "Borrow", 
      data.quantity, data.reason, data.expectedReturnDate, "", "Borrowed", new Date()
    ]);
    
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Return Action
 */
function returnTool(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const inventorySheet = ss.getSheetByName(SHEET_INVENTORY);
  const transSheet = ss.getSheetByName(SHEET_TRANSACTIONS);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  
  try {
    const transData = transSheet.getDataRange().getValues();
    let borrowedQty = 0;
    let transRow = -1;
    
    for (let i = transData.length - 1; i >= 1; i--) {
      if (transData[i][1] == data.toolId && transData[i][2] == data.userId && (transData[i][8] == "Borrowed" || transData[i][8] == "Overdue")) {
        transRow = i + 1;
        borrowedQty = Number(transData[i][4]);
        break;
      }
    }
    
    const invData = inventorySheet.getDataRange().getValues();
    for (let i = 1; i < invData.length; i++) {
      if (invData[i][0] == data.toolId) {
        if (invData[i][3] !== "จำนวนมาก") {
          inventorySheet.getRange(i + 1, 4).setValue(Number(invData[i][3]) + borrowedQty);
        }
        break;
      }
    }
    
    if (transRow != -1) {
      transSheet.getRange(transRow, 8).setValue(new Date());
      transSheet.getRange(transRow, 9).setValue("Returned");
      transSheet.getRange(transRow, 11).setValue(data.condition || "");
      transSheet.getRange(transRow, 12).setValue(data.notes || "");
      
      // Handle Image Upload
      if (data.imageBase64) {
        try {
          const folderName = "Tool_Return_Images";
          const folders = DriveApp.getFoldersByName(folderName);
          const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
          
          const base64Data = data.imageBase64.split(',')[1] || data.imageBase64;
          const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), MimeType.JPEG, data.imageName || `return_${data.toolId}.jpg`);
          
          const file = folder.createFile(blob);
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          
          transSheet.getRange(transRow, 13).setValue(file.getUrl());
        } catch (e) {
          transSheet.getRange(transRow, 13).setValue("Upload Error: " + e.toString());
        }
      }
    }
    
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Add New Tool
 */
function addTool(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_INVENTORY);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  
  try {
    // Check if ID already exists
    const invData = sheet.getDataRange().getValues();
    for (let i = 1; i < invData.length; i++) {
      if (invData[i][0] == data.toolId) return { error: "Tool ID already exists" };
    }
    
    sheet.appendRow([
      data.toolId, 
      data.toolName, 
      data.totalQty, 
      data.totalQty, // Available starts as Total
      data.unit, 
      data.location, 
      data.imageUrl || ""
    ]);
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Update Existing Tool
 */
function updateTool(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_INVENTORY);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  
  try {
    const invData = sheet.getDataRange().getValues();
    let rowIdx = -1;
    
    for (let i = 1; i < invData.length; i++) {
      if (invData[i][0] == data.toolId) {
        rowIdx = i + 1;
        break;
      }
    }
    
    if (rowIdx == -1) return { error: "Tool not found" };
    
    // Update values (Tool ID, Tool Name, Total Qty, Avail Qty, Unit, Location, Image URL)
    sheet.getRange(rowIdx, 2).setValue(data.toolName);
    sheet.getRange(rowIdx, 3).setValue(data.totalQty);
    sheet.getRange(rowIdx, 4).setValue(data.availableQty);
    sheet.getRange(rowIdx, 5).setValue(data.unit);
    sheet.getRange(rowIdx, 6).setValue(data.location);
    sheet.getRange(rowIdx, 7).setValue(data.imageUrl);
    
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Delete Tool
 */
function deleteTool(toolId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_INVENTORY);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  
  try {
    const invData = sheet.getDataRange().getValues();
    for (let i = 1; i < invData.length; i++) {
      if (invData[i][0] == toolId) {
        sheet.deleteRow(i + 1);
        return { success: true };
      }
    }
    return { error: "Tool not found" };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Get All Transactions (Admin)
 */
function getTransactions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_TRANSACTIONS);
  if (!sheet) return { transactions: [] };
  
  const data = sheet.getDataRange().getValues();
  const transactions = [];
  
  // Columns: [Transaction ID, Tool ID, User ID, Action, Qty, Reason, Expected Return, Actual Return, Status, Timestamp, Condition, Notes, Return Image]
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    transactions.push({
      transactionId: row[0],
      toolId: row[1],
      userId: row[2],
      action: row[3],
      quantity: row[4],
      reason: row[5],
      expectedReturnDate: row[6],
      actualReturnDate: row[7],
      status: row[8],
      timestamp: row[9],
      condition: row[10],
      notes: row[11],
      returnImage: row[12]
    });
  }
  
  // Sort by timestamp descending
  transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  return { transactions: transactions };
}

/**
 * Get All Users (Admin)
 */
function getUsers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_USERS);
  if (!sheet) return { users: [] };
  
  const data = sheet.getDataRange().getValues();
  const users = [];
  
  // Columns: [User ID, Full Name, Department, Cohort, Registered Date, Role, PIN]
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    users.push({
      userId: row[0],
      fullName: row[1],
      department: row[2],
      cohort: row[3],
      registeredDate: row[4],
      role: row[5] || "user",
      pin: row[6] || "" // Include PIN
    });
  }
  
  return { users: users };
}

/**
 * AUTHORIZATION HELPER
 * Run this function ONCE from the Apps Script Editor to authorize Google Drive access.
 */
function authorizeDrive() {
  const root = DriveApp.getRootFolder();
  console.log("Drive authorized. Root folder: " + root.getName());
  
  // Force write permission request
  const tempFile = root.createFile("temp_auth_check.txt", "Authorization Check");
  tempFile.setTrashed(true);
  console.log("Write permission confirmed.");
}