/**
 * Tool Crib Automation - Google Apps Script Backend
 * 
 * INSTRUCTIONS:
 * 1. Create a new Google Sheet.
 * 2. Go to Extensions > Apps Script.
 * 3. Delete any code in Code.gs and paste this entire script.
 * 4. Save the project.
 * 5. Run the 'setupSheet' function once to create the necessary sheets and headers.
 *    (You might need to authorize permissions).
 * 6. Click 'Deploy' > 'New deployment'.
 * 7. Select type 'Web app'.
 * 8. Set 'Description' to 'Tool Crib API'.
 * 9. Set 'Execute as' to 'Me'.
 * 10. Set 'Who has access' to 'Anyone' (IMPORTANT).
 * 11. Click 'Deploy'.
 * 12. Copy the 'Web App URL' and paste it into your `js/config.js` file as `API_URL`.
 */

// Sheet Names
const SHEET_INVENTORY = "Inventory";
const SHEET_USERS = "Users";
const SHEET_TRANSACTIONS = "Transactions";

/**
 * Handle POST requests (Main Entry Point)
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
      case "getUserActiveBorrows": // Added missing action
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
 * Setup the Google Sheet with necessary sheets and headers
 */
function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Inventory Sheet
  let inventorySheet = ss.getSheetByName(SHEET_INVENTORY);
  if (!inventorySheet) {
    inventorySheet = ss.insertSheet(SHEET_INVENTORY);
    inventorySheet.appendRow(["Tool ID", "Tool Name", "Total Qty", "Available Qty", "Location", "Image URL"]);
    // Add some sample data
    inventorySheet.appendRow(["T001", "Makita Cordless Drill 18V", 5, 5, "Cabinet A-12", ""]);
    inventorySheet.appendRow(["T002", "Fluke Digital Multimeter", 3, 3, "Cabinet B-05", ""]);
  }

  // 2. Users Sheet
  let usersSheet = ss.getSheetByName(SHEET_USERS);
  if (!usersSheet) {
    usersSheet = ss.insertSheet(SHEET_USERS);
    usersSheet.appendRow(["User ID", "Full Name", "Department", "Cohort", "Registered Date"]);
  }

  // 3. Transactions Sheet
  let transSheet = ss.getSheetByName(SHEET_TRANSACTIONS);
  if (!transSheet) {
    transSheet = ss.insertSheet(SHEET_TRANSACTIONS);
    transSheet.appendRow(["Transaction ID", "Tool ID", "User ID", "Action", "Qty", "Reason", "Expected Return", "Actual Return", "Status", "Timestamp"]);
  }
}

/**
 * Get all tools from Inventory
 */
function getTools() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_INVENTORY);
  const data = sheet.getDataRange().getValues();
  const tools = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const tool = {
      toolId: row[0],
      toolName: row[1],
      totalQty: row[2],
      availableQty: row[3],
      location: row[4],
      imageUrl: row[5],
      status: (row[3] === "จำนวนมาก" || row[3] > 0) ? "Available" : "Borrowed" 
    };
    tools.push(tool);
  }
  
  return { tools: tools };
}

/**
 * Check if a user exists
 */
function checkUser(userId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_USERS);
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
 * Register a new user
 */
function registerUser(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_USERS);
  
  sheet.appendRow([
    data.userId,
    data.fullName,
    data.department,
    data.cohort,
    new Date()
  ]);
  
  return { success: true };
}

/**
 * Get active borrows for a specific user
 */
function getUserActiveBorrows(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const transSheet = ss.getSheetByName(SHEET_TRANSACTIONS);
  const transData = transSheet.getDataRange().getValues();
  const borrows = [];

  // Iterate through transactions
  for (let i = 1; i < transData.length; i++) {
    const row = transData[i];
    // Check if it's the correct user and status is 'Borrowed' or 'Overdue'
    if (row[2] == data.userId && (row[8] == "Borrowed" || row[8] == "Overdue")) {
      borrows.push({
        toolId: row[1],
        quantity: row[4],
        borrowDate: row[9]
      });
    }
  }
  
  return { borrows: borrows };
}

/**
 * Borrow a tool
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
    let currentAvailable = 0;
    
    // Find tool in inventory
    for (let i = 1; i < invData.length; i++) {
      if (invData[i][0] == data.toolId) {
        toolRowIndex = i + 1; // 1-based index
        currentAvailable = invData[i][3];
        
        // Handle "Unlimited" Stock (if marked as "จำนวนมาก" or similar)
        if (currentAvailable === "จำนวนมาก") {
             // Do nothing to stock
        } else {
             currentAvailable = Number(currentAvailable);
             if (currentAvailable < data.quantity) return { error: "Not enough stock" };
             
             // Update Inventory
             const newAvailable = currentAvailable - data.quantity;
             inventorySheet.getRange(toolRowIndex, 4).setValue(newAvailable);
        }
        break;
      }
    }
    
    if (toolRowIndex == -1) return { error: "Tool not found" };
    
    // Record Transaction
    const transId = Utilities.getUuid();
    transSheet.appendRow([
      transId,
      data.toolId,
      data.userId,
      "Borrow",
      data.quantity,
      data.reason,
      data.expectedReturnDate,
      "", // Actual Return Date (Empty)
      "Borrowed",
      new Date()
    ]);
    
    return { success: true };
    
  } catch(e) {
    return { error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Return a tool
 */
function returnTool(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const inventorySheet = ss.getSheetByName(SHEET_INVENTORY);
  const transSheet = ss.getSheetByName(SHEET_TRANSACTIONS);
  
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  
  try {
    // 1. Find the active transaction to get the borrowed quantity
    const transData = transSheet.getDataRange().getValues();
    let transRowIndex = -1;
    let borrowedQty = 1; // Default to 1 if not found (fallback)
    
    // Find latest 'Borrowed' or 'Overdue' transaction for this tool & user
    for (let i = transData.length - 1; i >= 1; i--) {
      if (transData[i][1] == data.toolId && 
          transData[i][2] == data.userId && 
          (transData[i][8] == "Borrowed" || transData[i][8] == "Overdue")) {
        transRowIndex = i + 1;
        borrowedQty = Number(transData[i][4]); // Get the quantity from transaction
        break;
      }
    }

    // 2. Update Inventory
    const invData = inventorySheet.getDataRange().getValues();
    let toolRowIndex = -1;
    
    for (let i = 1; i < invData.length; i++) {
      if (invData[i][0] == data.toolId) {
        toolRowIndex = i + 1;
        let currentAvailable = invData[i][3];
        
        // Handle "Unlimited" Stock
        if (currentAvailable !== "จำนวนมาก") {
             // Return the exact amount borrowed
             inventorySheet.getRange(toolRowIndex, 4).setValue(Number(currentAvailable) + borrowedQty);
        }
        break;
      }
    }
    
    if (toolRowIndex == -1) return { error: "Tool not found" };

    // 3. Update Transaction Status
    if (transRowIndex != -1) {
      transSheet.getRange(transRowIndex, 8).setValue(new Date()); // Actual Return
      transSheet.getRange(transRowIndex, 9).setValue("Returned"); // Status
    } else {
        // If no open transaction found (Force Return case), record it
         const transId = Utilities.getUuid();
         transSheet.appendRow([
          transId,
          data.toolId,
          data.userId,
          "Return (Unmatched)",
          1, // Defaulting to 1 for unmatched return
          data.notes || "Force Return",
          "", 
          new Date(),
          "Returned",
          new Date()
        ]);
    }
    
    return { success: true };
    
  } catch(e) {
    return { error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Check for overdue items (Optional: Run daily)
 */
function checkOverdue() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const transSheet = ss.getSheetByName(SHEET_TRANSACTIONS);
  const data = transSheet.getDataRange().getValues();
  const now = new Date();
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = row[8];
    const expectedReturn = new Date(row[6]);
    
    if (status === "Borrowed" && expectedReturn < now) {
      transSheet.getRange(i + 1, 9).setValue("Overdue");
      Logger.log("Overdue: User " + row[2] + " Tool " + row[1]);
    }
  }
}