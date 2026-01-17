/**
 * Tool Crib Automation - Google Apps Script Backend (Updated V2.5)
 * 
 * INSTRUCTIONS:
 * 1. Create a new Google Sheet.
 * 2. Go to Extensions > Apps Script.
 * 3. Delete any code in Code.gs and paste this entire script.
 * 4. Save the project.
 * 5. Run the 'setupSheet' function once to create the necessary sheets and headers.
 * 6. Click 'Deploy' > 'New deployment'.
 * 7. Select type 'Web app', Execute as 'Me', Access 'Anyone'.
 * 8. Copy the 'Web App URL' and paste it into your `js/config.js` file.
 */

// Sheet Names
const SHEET_INVENTORY = "Inventory";
const SHEET_USERS = "Users";
const SHEET_TRANSACTIONS = "Transactions";

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
    usersSheet.appendRow(["User ID", "Full Name", "Department", "Cohort", "Registered Date"]);
  }

  // 3. Transactions
  let transSheet = ss.getSheetByName(SHEET_TRANSACTIONS);
  if (!transSheet) {
    transSheet = ss.insertSheet(SHEET_TRANSACTIONS);
    transSheet.appendRow(["Transaction ID", "Tool ID", "User ID", "Action", "Qty", "Reason", "Expected Return", "Actual Return", "Status", "Timestamp"]);
  }
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
          cohort: data[i][3]
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
      sheet.getRange(i + 1, 2, 1, 3).setValues([[data.fullName, data.department, data.cohort]]);
      return { success: true, message: "Profile updated" };
    }
  }
  
  sheet.appendRow([data.userId, data.fullName, data.department, data.cohort, new Date()]);
  return { success: true };
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
    }
    
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}