/**
 * Cloudflare Pages Function - 英文沉浸式學習紀錄器 登入驗證 API
 * Endpoint: /api/login
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { username, password } = body;

    const validUsername = env.APP_USERNAME;
    const validPassword = env.APP_PASSWORD;

    if (!validUsername || !validPassword) {
      return new Response(JSON.stringify({ 
        status: "error", 
        message: "請先至 Cloudflare 設定 APP_USERNAME 與 APP_PASSWORD 環境變數" 
      }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 抓取資安資訊
    const ip = request.headers.get("cf-connecting-ip") || "Unknown IP";
    const userAgent = request.headers.get("user-agent") || "Unknown Device";
    const googleScriptUrl = env.GOOGLE_SCRIPT_URL;

    // 非同步發送登入紀錄的輔助函式
    const sendLoginLog = async (statusMsg) => {
      if (!googleScriptUrl) return;
      try {
        await fetch(googleScriptUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({
            action: "login_log",
            timestamp: new Date().toISOString(),
            ip: ip,
            userAgent: userAgent,
            status: statusMsg
          })
        });
      } catch(e) {
        // 忽略寫入失敗，不影響登入主流程
      }
    };

    if (username === validUsername && password === validPassword) {
      // 驗證成功
      context.waitUntil(sendLoginLog("登入成功 (Success)"));
      const token = btoa(`${username}:${password}`);
      return new Response(JSON.stringify({ 
        status: "success", 
        token: token 
      }), { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } else {
      // 驗證失敗
      context.waitUntil(sendLoginLog("登入失敗 (Failed) - " + username));
      return new Response(JSON.stringify({ 
        status: "error", 
        message: "帳號或密碼錯誤" 
      }), { 
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ 
      status: "error", 
      message: "無效的請求格式" 
    }), { 
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
}
