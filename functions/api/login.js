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

    if (username === validUsername && password === validPassword) {
      // 驗證成功，產生一組無狀態的驗證 Token
      const token = btoa(`${username}:${password}`);
      return new Response(JSON.stringify({ 
        status: "success", 
        token: token 
      }), { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } else {
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
