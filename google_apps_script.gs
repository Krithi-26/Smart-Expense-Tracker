/**
 * SpendWise Google Apps Script Backend Database
 * 
 * Instructions:
 * 1. Open Google Sheets (https://sheets.new) and name it "SpendWise DB".
 * 2. Click Extensions -> Apps Script.
 * 3. Replace all default code with this script.
 * 4. Click Save, then click "Deploy" -> "New deployment".
 * 5. Choose Type: "Web app".
 * 6. Set "Execute as": "Me".
 * 7. Set "Who has access": "Anyone".
 * 8. Click Deploy, copy the Web App URL, and paste it into SpendWise Settings!
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var payload = data.payload;
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === "sync_all") {
      syncSheet(ss, "Users", ["Email", "Name", "PasswordHash"], payload.users ? Object.values(payload.users).map(function(u) { return [u.email, u.name, u.passHash]; }) : []);
      syncSheet(ss, "Transactions", ["ID", "UserEmail", "Type", "Category", "Description", "Amount", "Date", "PaymentMethod"], payload.transactions ? payload.transactions.map(function(t) { return [t.id, data.userEmail || '', t.type, t.cat, t.desc, t.amt, t.date, t.pay || 'Cash']; }) : []);
      syncSheet(ss, "Goals", ["ID", "UserEmail", "GoalName", "Target", "Saved"], payload.goals ? payload.goals.map(function(g) { return [g.id, data.userEmail || '', g.name, g.target, g.saved]; }) : []);
    } else if (action === "add_transaction") {
      appendRow(ss, "Transactions", ["ID", "UserEmail", "Type", "Category", "Description", "Amount", "Date", "PaymentMethod"], [payload.id, payload.userEmail || data.userEmail || '', payload.type, payload.cat, payload.desc, payload.amt, payload.date, payload.pay || 'Cash']);
    } else if (action === "add_user") {
      appendRow(ss, "Users", ["Email", "Name", "PasswordHash"], [payload.email, payload.name, payload.passHash]);
    } else if (action === "add_goal") {
      appendRow(ss, "Goals", ["ID", "UserEmail", "GoalName", "Target", "Saved"], [payload.id, payload.userEmail || data.userEmail || '', payload.name, payload.target, payload.saved]);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function syncSheet(ss, sheetName, headers, rows) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
  } else {
    sheet.clearContents();
    sheet.appendRow(headers);
  }
  if (rows && rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function appendRow(ss, sheetName, headers, row) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
  }
  sheet.appendRow(row);
}
