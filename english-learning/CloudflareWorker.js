/**
 * Cloudflare Worker - 英文沉浸式學習紀錄器 安全代理服務 (Proxy)
 * 
 * 部署與設定指南：
 * 1. 註冊或登入 Cloudflare 帳戶 (https://dash.cloudflare.com/)。
 * 2. 在左側選單點擊「Workers & Pages」->「Create application」->「Create Worker」。
 * 3. 輸入您的 Worker 名稱 (例如 `english-tracker-proxy`)，點擊「Deploy」。
 * 4. 部署完成後，點擊「Edit code」按鈕進入線上編輯器。
 * 5. 清空編輯器預設程式碼，並將此檔案底部的 JavaScript 程式碼完整複製貼上。
 * 6. 點擊右上角「Deploy」保存並部署程式碼。
 * 
 * 7. 配置環境變數與安全金鑰 (非常重要！)：
 *    - 回到該 Worker 的管理主頁面，點擊「Settings」->「Variables」。
 *    - 在「Environment Variables」區塊點擊「Add variable」：
 *      a. 新增變數一：
 *         - Name: `GOOGLE_SCRIPT_URL`
 *         - Value: (貼上您的 Google Apps Script 網頁應用程式 URL，格式如 https://script.google.com/macros/s/.../exec)
 *         - 填完後點擊「Encrypt」將其加密為秘密 (Secret)。
 *      b. 新增變數二：
 *         - Name: `SYNC_ACCESS_KEY`
 *         - Value: (自訂一組高強度的安全金鑰密碼，例如 `MyEnglishTrackerToken2026!`)
 *         - 填完後點擊「Encrypt」將其加密為秘密 (Secret)。
 *    - 點擊「Save and deploy」保存變數設定。
 * 
 * 8. 在英文學習網站設定：
 *    - 複製您的 Cloudflare Worker 網址 (格式如 `https://english-tracker-proxy.YOUR-SUBDOMAIN.workers.dev`)。
 *    - 開啟您的英文追蹤網頁，在雲端設定面板中：
 *      - Cloudflare Worker 網址：貼上剛才複製的 Worker 網址。
 *      - 同步安全金鑰：輸入您自訂的 `SYNC_ACCESS_KEY` 密碼值。
 *    - 點擊手動同步，即可完成雙向安全備份！
 */

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      // 限制僅允許您個人的 GitHub Pages 網域進行跨網域請求，防止他人盜用 API
      "Access-Control-Allow-Origin": "https://brianchuan.github.io", 
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Sync-Token",
      "Access-Control-Max-Age": "86400",
    };

    // 處理瀏覽器 CORS 預檢 OPTIONS 請求
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // 限制僅允許 POST 請求
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: corsHeaders,
      });
    }

    try {
      // 1. 驗證前端傳入的安全金鑰 (X-Sync-Token)
      const token = request.headers.get("X-Sync-Token");
      const secretToken = env.SYNC_ACCESS_KEY; 
      
      if (!secretToken) {
        return new Response(JSON.stringify({
          status: "error",
          message: "Cloudflare Worker 缺少 SYNC_ACCESS_KEY 環境變數設定。"
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!token || token !== secretToken) {
        return new Response(JSON.stringify({
          status: "error",
          message: "驗證失敗：無效的安全金鑰。"
        }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 2. 讀取前端傳送的 payload
      const bodyText = await request.text();

      // 3. 讀取加密儲存的 Google Apps Script 網址
      const googleScriptUrl = env.GOOGLE_SCRIPT_URL; 
      
      if (!googleScriptUrl) {
        return new Response(JSON.stringify({
          status: "error",
          message: "Cloudflare Worker 缺少 GOOGLE_SCRIPT_URL 環境變數設定。"
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 4. 以後端伺服器身份向 Google Apps Script 發送請求 (避開 CORS 阻擋)
      const response = await fetch(googleScriptUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain", 
        },
        body: bodyText,
      });

      const responseText = await response.text();

      // 5. 將 Google Sheets 回傳的結果傳回前端瀏覽器
      return new Response(responseText, {
        status: response.status,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });

    } catch (error) {
      return new Response(JSON.stringify({
        status: "error",
        message: "代理伺服器錯誤: " + error.message,
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};
