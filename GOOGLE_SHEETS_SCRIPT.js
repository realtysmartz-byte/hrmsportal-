/**
 * REALTY SMARTZ HRMS - GOOGLE SHEETS ATTENDANCE SYNC SCRIPT
 * 
 * STEPS TO ACTIVATE:
 * 1. Open your Google Spreadsheet:
 *    https://docs.google.com/spreadsheets/d/1T3fsjB-untGHDDpIY4HpJXV0rOIrXEymofJVsXh3b24/edit
 * 2. In top menu click: Extensions > Apps Script
 * 3. Delete any default code in Code.gs, paste this entire file contents, and click Save (Ctrl+S / Cmd+S).
 * 4. Click the blue "Deploy" button (top right) > "Manage deployments"
 *    - Click the pencil edit icon next to your active deployment.
 *    - Under "Version", select "New version".
 *    - Under "Who has access", make sure it is set to "Anyone".
 *    - Click "Deploy".
 * 5. Done! The portal will now automatically create a new date tab and sync attendance records in real-time.
 */

function doPost(e) {
  try {
    var contents = e && e.postData ? e.postData.contents : "{}";
    var data = JSON.parse(contents);
    var sheetName = data.sheetTitle || data.date || Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd");
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    sheet.clear();
    
    if (data.rawValues && data.rawValues.length > 0) {
      var rows = data.rawValues.length;
      var cols = data.rawValues[0].length;
      
      var range = sheet.getRange(1, 1, rows, cols);
      range.setValues(data.rawValues);
      
      // 1. Header Styling (Dark Navy #0F172A with white bold text)
      var headerRange = sheet.getRange(1, 1, 1, cols);
      headerRange.setBackground("#0F172A");
      headerRange.setFontColor("#FFFFFF");
      headerRange.setFontWeight("bold");
      headerRange.setHorizontalAlignment("center");
      headerRange.setVerticalAlignment("middle");
      sheet.setRowHeight(1, 32);
      
      // 2. Freeze Header Row
      sheet.setFrozenRows(1);
      
      // 3. Grid borders and data alignment
      if (rows > 1) {
        var dataRange = sheet.getRange(2, 1, rows - 1, cols);
        dataRange.setFontSize(10);
        dataRange.setVerticalAlignment("middle");
        
        // Highlight Status Column (Col 7)
        for (var i = 2; i <= rows; i++) {
          var statusCell = sheet.getRange(i, 7);
          var statusVal = statusCell.getValue();
          if (statusVal === "PRESENT") {
            statusCell.setBackground("#ECFDF5").setFontColor("#065F46").setFontWeight("bold");
          } else if (statusVal === "LATE") {
            statusCell.setBackground("#FFFBEB").setFontColor("#92400E").setFontWeight("bold");
          } else if (statusVal === "ABSENT") {
            statusCell.setBackground("#FEF2F2").setFontColor("#991B1B").setFontWeight("bold");
          } else if (statusVal === "HALF_DAY") {
            statusCell.setBackground("#EFF6FF").setFontColor("#1E40AF").setFontWeight("bold");
          }
        }
      }
      
      // 4. Auto-fit column widths
      for (var c = 1; c <= cols; c++) {
        sheet.autoResizeColumn(c);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      sheetTitle: sheetName,
      rowCount: data.rowCount || (data.rawValues ? data.rawValues.length - 1 : 0),
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    service: "Realty Smartz HRMS Google Sheets Real-Time Sync",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}
