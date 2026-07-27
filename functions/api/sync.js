/**
 * Cloudflare Pages Function - 英文沉浸式學習紀錄器 同步中繼 API
 * Endpoint: /api/sync
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // 1. 讀取前端傳送的 payload
    const bodyText = await request.text();

    // 2. 讀取儲存在 Cloudflare Pages 的 Google Apps Script 網址 (Environment Variable)
    const googleScriptUrl = env.GOOGLE_SCRIPT_URL; 
    
    if (!googleScriptUrl) {
      return new Response(JSON.stringify({
        status: "error",
        message: "Cloudflare Pages 缺少 GOOGLE_SCRIPT_URL 環境變數設定。"
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. 以後端伺服器身份向 Google Apps Script 發送請求 (避開瀏覽器 CORS 阻擋)
    const response = await fetch(googleScriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain", 
      },
      body: bodyText,
    });

    const responseText = await response.text();

    // 4. 將 Google Sheets 回傳的結果傳回前端瀏覽器
    return new Response(responseText, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({
      status: "error",
      message: "後端代理發生錯誤: " + error.message,
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
