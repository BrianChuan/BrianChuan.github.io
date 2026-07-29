/**
 * Google Apps Script - 英文沉浸式學習紀錄器 後端同步服務
 * 
 * 部署指南：
 * 1. 在您的 Google 雲端硬碟建立一個新的「Google 試算表」(Spreadsheet)。
 * 2. 點擊頂部選單的「擴充功能」->「Apps Script」。
 * 3. 清空編輯器預設程式碼，並將此檔案內容完整複製貼上。
 * 4. 點擊上方的「儲存」(磁碟片圖示)。
 * 5. 點擊右上角「部署」->「新增部署」。
 * 6. 部署設定：
 *    - 類型：選取「網頁應用程式」(Web App)。
 *    - 說明：英文學習紀錄同步 API
 *    - 執行身分：選取「我」(您的 Google 帳號)。
 *    - 誰有權限存取：選取「任何人」(Anyone) — **這點非常重要，否則網頁前端將無權存取**。
 * 7. 點擊「部署」並授權存取權限。
 * 8. 部署成功後，複製畫面上顯示的「網頁應用程式 URL」並貼回您的英文紀錄網站設定面板中。
 */

function doPost(e) {
  try {
    // 解決 CORS 跨網域預檢問題
    var jsonString = e.postData.contents;
    var data = JSON.parse(jsonString);
    
    if (data.action === "login_log") {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheetName = "登入紀錄 (Login_Logs)";
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.appendRow(["時間", "IP 位址", "裝置與瀏覽器 (User-Agent)", "狀態"]);
        sheet.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#f3f4f6");
        sheet.setColumnWidth(1, 180);
        sheet.setColumnWidth(2, 150);
        sheet.setColumnWidth(3, 500);
      }
      sheet.appendRow([data.timestamp, data.ip, data.userAgent, data.status]);
      
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Login logged"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (data.action !== "sync") {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Invalid action"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. 同步「學習紀錄 (Logs)」
    var mergedLogs = syncLogsSheet(ss, data.logs || []);
    
    // 2. 同步「生字庫 (Vocabulary)」
    var mergedVocab = syncVocabSheet(ss, data.vocab || []);
    
    // 3. 同步「里程碑 (Checkpoints)」
    var mergedCheckpoints = syncCheckpointsSheet(ss, data.checkpoints || []);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Sync completed successfully",
      logs: mergedLogs,
      vocab: mergedVocab,
      checkpoints: mergedCheckpoints
    }))
    .setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
  }
}

function getSheetData(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    return { sheet: sheet, rows: [] };
  }
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return { sheet: sheet, rows: [] };
  }
  var lastCol = sheet.getLastColumn();
  var numCols = Math.max(lastCol, headers.length);
  var values = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
  return { sheet: sheet, rows: values };
}

function formatDate(dateVal) {
  if (!dateVal) return "";
  if (dateVal instanceof Date) {
    var y = dateVal.getFullYear();
    var m = ("0" + (dateVal.getMonth() + 1)).slice(-2);
    var d = ("0" + dateVal.getDate()).slice(-2);
    return y + "-" + m + "-" + d;
  }
  var str = dateVal.toString().trim();
  if (str.length >= 10 && str.charAt(4) === '-' && str.charAt(7) === '-') {
    return str.substring(0, 10);
  }
  try {
    var dObj = new Date(str);
    if (!isNaN(dObj.getTime())) {
      var y = dObj.getFullYear();
      var m = ("0" + (dObj.getMonth() + 1)).slice(-2);
      var d = ("0" + dObj.getDate()).slice(-2);
      return y + "-" + m + "-" + d;
    }
  } catch(e) {}
  return str;
}

function syncLogsSheet(ss, clientLogs) {
  var sheetName = "學習紀錄 (Logs)";
  var headers = ["唯一ID", "類型 (Input/Output)", "日期", "時長 (分鐘)", "來源/練習方式", "主題/標題", "是否為疲勞備案 (被動聽讀)", "流暢度自評"];
  var sheetInfo = getSheetData(ss, sheetName, headers);
  var sheet = sheetInfo.sheet;
  var sheetRows = sheetInfo.rows;
  
  var sheetMap = {};
  
  sheetRows.forEach(function(row) {
    var id = row[0] ? row[0].toString().trim() : "";
    var typeStr = row[1] ? row[1].toString().trim() : "";
    var date = row[2] ? formatDate(row[2]) : "";
    var duration = row[3] ? Number(row[3]) : 0;
    var sourceOrType = row[4] ? row[4].toString().trim() : "";
    var title = row[5] ? row[5].toString().trim() : "";
    var passiveStr = row[6] ? row[6].toString().trim() : "";
    var ratingStr = row[7] ? row[7].toString().trim() : "";
    
    var type = "input";
    if (typeStr.indexOf("輸出") !== -1 || typeStr.toLowerCase() === "output") {
      type = "output";
    }
    
    var passive = (passiveStr === "是" || passiveStr === "true");
    var rating = ratingStr && ratingStr !== "無" ? Number(ratingStr) : 3;
    
    // If ID is empty (user manually entered in sheet), generate a sheet ID
    if (!id) {
      id = (type === "input" ? "in" : "out") + "-sheet-" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000);
    }
    
    var logObj = {
      id: id,
      type: type,
      date: date,
      duration: duration,
      title: title,
      synced: true
    };
    
    if (type === "input") {
      logObj.source = sourceOrType;
      logObj.passive = passive;
    } else {
      logObj.outputType = sourceOrType;
      logObj.rating = rating;
    }
    
    sheetMap[id] = logObj;
  });
  
  var mergedLogs = [];
  
  clientLogs.forEach(function(clientLog) {
    var id = clientLog.id;
    if (sheetMap[id]) {
      // Exist in both: sheet version wins (allows sheet edits to propagate to client)
      mergedLogs.push(sheetMap[id]);
      delete sheetMap[id];
    } else {
      // Not in sheet:
      if (clientLog.synced) {
        // Was previously synced, meaning it was deleted from sheet. Discard it.
      } else {
        // New log on client: keep and sync to sheet
        mergedLogs.push(clientLog);
      }
    }
  });
  
  // Remaining in sheetMap were manually added to sheet
  for (var id in sheetMap) {
    mergedLogs.push(sheetMap[id]);
  }
  
  // Sort merged logs by date ascending
  mergedLogs.sort(function(a, b) {
    return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
  });
  
  sheet.clear();
  sheet.appendRow(headers);
  
  if (mergedLogs.length > 0) {
    var rowsToWrite = [];
    mergedLogs.forEach(function(log) {
      rowsToWrite.push([
        log.id,
        log.type === "input" ? "輸入 (Input)" : "輸出 (Output)",
        log.date,
        log.duration,
        log.type === "input" ? (log.source || "") : (log.outputType || ""),
        log.title || "",
        log.type === "input" ? (log.passive ? "是" : "否") : "無",
        log.type === "output" ? (log.rating || 3) : "無"
      ]);
    });
    sheet.getRange(2, 1, rowsToWrite.length, headers.length).setValues(rowsToWrite);
  }
  
  sheet.getRange(1, 1, 1, headers.length).setBackground("#06b6d4").setFontColor("#ffffff").setFontWeight("bold");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
  
  return mergedLogs;
}

function syncVocabSheet(ss, clientVocab) {
  var sheetName = "生字庫 (Vocabulary)";
  var headers = ["英文單字", "中文定義/例句", "加入日期", "字詞來源/上下文"];
  var sheetInfo = getSheetData(ss, sheetName, headers);
  var sheet = sheetInfo.sheet;
  var sheetRows = sheetInfo.rows;
  
  var sheetMap = {};
  
  sheetRows.forEach(function(row) {
    var word = row[0] ? row[0].toString().trim() : "";
    if (!word) return;
    
    var key = word.toLowerCase();
    var definition = row[1] ? row[1].toString().trim() : "";
    var date = row[2] ? formatDate(row[2]) : "";
    var source = row[3] ? row[3].toString().trim() : "";
    
    sheetMap[key] = {
      word: word,
      definition: definition,
      date: date,
      source: source,
      synced: true
    };
  });
  
  var mergedVocab = [];
  
  clientVocab.forEach(function(clientV) {
    var key = clientV.word.toString().trim().toLowerCase();
    if (sheetMap[key]) {
      mergedVocab.push(sheetMap[key]);
      delete sheetMap[key];
    } else {
      if (clientV.synced) {
        // Was previously synced, meaning deleted from sheet. Discard it.
      } else {
        mergedVocab.push(clientV);
      }
    }
  });
  
  for (var key in sheetMap) {
    mergedVocab.push(sheetMap[key]);
  }
  
  mergedVocab.sort(function(a, b) {
    return a.word.localeCompare(b.word);
  });
  
  sheet.clear();
  sheet.appendRow(headers);
  
  if (mergedVocab.length > 0) {
    var rowsToWrite = [];
    mergedVocab.forEach(function(v) {
      rowsToWrite.push([
        v.word,
        v.definition || "",
        v.date || "",
        v.source || ""
      ]);
    });
    sheet.getRange(2, 1, rowsToWrite.length, headers.length).setValues(rowsToWrite);
  }
  
  sheet.getRange(1, 1, 1, headers.length).setBackground("#10b981").setFontColor("#ffffff").setFontWeight("bold");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
  
  return mergedVocab;
}

function syncCheckpointsSheet(ss, clientCheckpoints) {
  var sheetName = "里程碑 (Checkpoints)";
  var headers = ["唯一ID", "日期", "累計時數 (小時)", "測驗/自評分數", "備註/教材調整心得"];
  var sheetInfo = getSheetData(ss, sheetName, headers);
  var sheet = sheetInfo.sheet;
  var sheetRows = sheetInfo.rows;
  
  var sheetMap = {};
  
  sheetRows.forEach(function(row) {
    var id = row[0] ? row[0].toString().trim() : "";
    var date = row[1] ? formatDate(row[1]) : "";
    var hours = row[2] ? Number(row[2]) : 0;
    var score = row[3] ? Number(row[3]) : 0;
    var notes = row[4] ? row[4].toString().trim() : "";
    
    if (!id) {
      id = "cp-sheet-" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000);
    }
    
    sheetMap[id] = {
      id: id,
      date: date,
      hours: hours,
      score: score,
      notes: notes,
      synced: true
    };
  });
  
  var mergedCheckpoints = [];
  
  clientCheckpoints.forEach(function(clientCp) {
    var id = clientCp.id;
    if (sheetMap[id]) {
      mergedCheckpoints.push(sheetMap[id]);
      delete sheetMap[id];
    } else {
      if (clientCp.synced) {
        // deleted from sheet
      } else {
        mergedCheckpoints.push(clientCp);
      }
    }
  });
  
  for (var id in sheetMap) {
    mergedCheckpoints.push(sheetMap[id]);
  }
  
  mergedCheckpoints.sort(function(a, b) {
    return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
  });
  
  sheet.clear();
  sheet.appendRow(headers);
  
  if (mergedCheckpoints.length > 0) {
    var rowsToWrite = [];
    mergedCheckpoints.forEach(function(cp) {
      rowsToWrite.push([
        cp.id,
        cp.date,
        cp.hours,
        cp.score,
        cp.notes || ""
      ]);
    });
    sheet.getRange(2, 1, rowsToWrite.length, headers.length).setValues(rowsToWrite);
  }
  
  sheet.getRange(1, 1, 1, headers.length).setBackground("#3b82f6").setFontColor("#ffffff").setFontWeight("bold");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
  
  return mergedCheckpoints;
}
