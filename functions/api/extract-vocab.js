/**
 * Cloudflare Pages Function - 英文沉浸式學習紀錄器
 * AI 單字自動萃取 API
 * Endpoint: /api/extract-vocab
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // 1. 驗證登入授權
    const clientToken = request.headers.get("X-Sync-Token");
    const validUsername = env.APP_USERNAME;
    const validPassword = env.APP_PASSWORD;

    if (!validUsername || !validPassword) {
      return new Response(JSON.stringify({ error: "Server missing credentials" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    const expectedToken = btoa(`${validUsername}:${validPassword}`);
    if (!clientToken || clientToken !== expectedToken) {
       return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    // 2. 取得前端傳送的學習筆記或對話
    const body = await request.json();
    const textToExtract = body.text;

    if (!textToExtract) {
      return new Response(JSON.stringify({ error: "No text provided" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // 3. 從環境變數讀取 Gemini API Key (絕對安全，不暴露於前端)
    const geminiKey = env.GEMINI_API_KEY;
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: "Cloudflare 後台尚未設定 GEMINI_API_KEY 環境變數" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    // 4. 呼叫 Gemini 3.5 Flash API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${geminiKey}`;
    
    const prompt = `你是一個專業的英文學習助手。請從以下使用者輸入的英文學習紀錄或筆記中，萃取出 3 到 5 個最值得學習的高頻單字或片語。
請以嚴格的 JSON 陣列格式回傳，請不要包含任何 Markdown 標記或 \`\`\`json 等字眼，直接回傳乾淨的 JSON 陣列即可。
範例格式：
[
  {"word": "persistent", "pos": "adj.", "chinese": "堅持不懈的"},
  {"word": "bottleneck", "pos": "n.", "chinese": "瓶頸"}
]

以下是要分析的內容：
${textToExtract}`;

    const geminiPayload = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.2 // 降低隨機性，確保輸出格式穩定
      }
    };

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload)
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: "Gemini API 呼叫失敗: " + errText }), { status: 502, headers: { "Content-Type": "application/json" } });
    }

    const data = await response.json();
    let resultText = data.candidates[0].content.parts[0].text;
    
    // 清理可能的 Markdown 格式
    resultText = resultText.replace(/```json/g, "").replace(/```/g, "").trim();

    const vocabList = JSON.parse(resultText);

    // 5. 將結果回傳給前端
    return new Response(JSON.stringify({ status: "success", vocab: vocabList }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: "系統錯誤: " + error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
