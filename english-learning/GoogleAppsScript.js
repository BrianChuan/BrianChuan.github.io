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
    
    if (data.action !== "sync") {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Invalid action"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. 同步「學習紀錄 (Logs)」
    syncLogsSheet(ss, data.logs || []);
    
    // 2. 同步「生字庫 (Vocabulary)」
    syncVocabSheet(ss, data.vocab || []);
    
    // 3. 同步「里程碑 (Checkpoints)」
    syncCheckpointsSheet(ss, data.checkpoints || []);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Sync completed successfully"
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

function syncLogsSheet(ss, logs) {
  var sheetName = "學習紀錄 (Logs)";
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  
  sheet.clear();
  
  // 寫入標頭
  var headers = ["唯一ID", "類型 (Input/Output)", "日期", "時長 (分鐘)", "來源/練習方式", "主題/標題", "是否為疲勞備案 (被動聽讀)"];
  sheet.appendRow(headers);
  
  if (logs.length === 0) return;
  
  // 整理資料陣列
  var rows = [];
  logs.forEach(function(log) {
    rows.push([
      log.id,
      log.type === "input" ? "輸入 (Input)" : "輸出 (Output)",
      log.date,
      log.duration,
      log.type === "input" ? (log.source || "") : (log.outputType || ""),
      log.title || "",
      log.type === "input" ? (log.passive ? "是" : "否") : "無"
    ]);
  });
  
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  
  // 美化表格
  sheet.getRange(1, 1, 1, headers.length).setBackground("#06b6d4").setFontColor("#ffffff").setFontWeight("bold");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

function syncVocabSheet(ss, vocab) {
  var sheetName = "生字庫 (Vocabulary)";
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  
  sheet.clear();
  
  // 寫入標頭
  var headers = ["英文單字", "中文定義/例句", "加入日期", "字詞來源/上下文"];
  sheet.appendRow(headers);
  
  if (vocab.length === 0) return;
  
  var rows = [];
  vocab.forEach(function(v) {
    rows.push([
      v.word,
      v.definition || "",
      v.date,
      v.source || ""
    ]);
  });
  
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  
  // 美化表格
  sheet.getRange(1, 1, 1, headers.length).setBackground("#10b981").setFontColor("#ffffff").setFontWeight("bold");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

function syncCheckpointsSheet(ss, checkpoints) {
  var sheetName = "里程碑 (Checkpoints)";
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  
  sheet.clear();
  
  // 寫入標頭
  var headers = ["唯一ID", "日期", "累計時數 (小時)", "測驗/自評分數", "備註/教材調整心得"];
  sheet.appendRow(headers);
  
  if (checkpoints.length === 0) return;
  
  var rows = [];
  checkpoints.forEach(function(cp) {
    rows.push([
      cp.id,
      cp.date,
      cp.hours,
      cp.score,
      cp.notes || ""
    ]);
  });
  
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  
  // 美化表格
  sheet.getRange(1, 1, 1, headers.length).setBackground("#3b82f6").setFontColor("#ffffff").setFontWeight("bold");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}
