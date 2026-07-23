/**
 * Custom JS for Brian's Developer Portfolio
 * Handles:
 * - Dynamic project loading (fetch from JSON / local fallback)
 * - Portfolio category filtering
 * - Interactive Terminal CLI
 * - Blog-style Project Details Panel (Slide-over presentation with video embeds)
 * - Lightweight custom ScrollSpy for Sidebar Active State highlighting
 */

// Global Variables
let projects = [];
const JSON_PATH = "js/projects.json";

// Default fallback projects in case browser blocks local JSON fetch (e.g. file:/// protocol security)
const DEFAULT_PROJECTS = [
  {
    "id": "triz-motorcycle-safety",
    "title": "機車主動式輔助駕駛與守衛防盜系統 (基於樹莓派5與ESP32)",
    "semester": "113學年度實務專題",
    "category": "contest",
    "description": "榮獲台北科技大學學生實務專題競賽【第二名】。整合樹莓派5影像辨識（MobileNet-SSD）與 ESP32 感測器通訊，實作後方盲區障礙物警示、藍牙 MAC 自動對鏡、與 MPU6050 陀螺儀防盜警備系統。",
    "details": "<h3>專案起源與系統痛點</h3><p>本專題針對機車行車與防盜安全需求，設計一套低功耗、多功能的主動安全輔助駕駛系統。傳統機車後照鏡存在視覺盲區，且停放時易遭竊或傾倒。我們採用樹莓派 5（Raspberry Pi 5）與 ESP32 進行雙核心分散式運作，解決運作資源受限的挑戰。</p><h3>核心技術與架構</h3><ul><li><strong>障礙物偵測與感測器融合</strong>：樹莓派 5 連接鏡頭，載入輕量化 <strong>MobileNet-SSD</strong> 進行即時目標辨識（偵測車輛、行人，運算速度達 25ms），並透過 I2C 送訊至 ESP32. ESP32 隨後控制 <strong>HC-SR04 超音波模組</strong> 進行測距，並利用 <strong>WS2812B 幻彩 LED 燈條</strong> 顯示動態距離警示。</li><li><strong>藍牙自動個人化對鏡</strong>：利用 ESP32 掃描車主手機的藍牙 MAC 位址，比對成功後，透過 I2C 傳輸角度參數，驅動 <strong>SG90 伺服馬達（PWM控制）</strong> 自動調整至車主預設之最佳後照鏡角度。</li><li><strong>守衛防盜模式與姿態濾波</strong>：車輛熄火後，ESP32 透過 <strong>MPU6050 六軸感測器</strong> 進行車身姿態監控。利用 <strong>卡爾曼濾波 (Kalman Filter) 演算法</strong> 濾除車體高頻微小震動噪聲，當偵測到真實車體傾斜或異常位移時，立即經由藍牙中斷訊號觸發樹莓派 5 錄影，並串接 <strong>Line Messaging API 與 Imgur API</strong> 異步發送動態警報與錄影畫面至車主手機。</li></ul><h3>技術挑戰與排除</h3><p>開發中遭遇多執行緒資源競爭與 PWM 訊號干擾，我們採用 Python <code>multiprocessing</code> 進行輕量化前處理，並重設 ESP32 GPIO 狀態阻斷干擾，確保硬體運行的超高穩定性。</p>",
    "githubUrl": "https://github.com/BrianChuan",
    "videoUrl": "",
    "reportUrl": "Project Reports/實務專題/成果報告_郭宏源教授_謝進權隊長_111360205.pdf",
    "tags": ["Raspberry Pi 5", "ESP32", "MobileNet-SSD", "Line API", "MPU6050"]
  },
  {
    "id": "wro-soccer-robot",
    "title": "WRO 自主足球機器人 - 決策與控制系統開發",
    "semester": "WRO 競賽專案",
    "category": "contest",
    "description": "多次榮獲國際與全國機器人足球競賽前三名佳績。負責核心軟體程式撰寫，基於 Lego Mindstorms EV3 控制器實作多感測器數據融合、自主導航與即時軌跡追蹤演算法。",
    "details": "<h3>專案起源與競賽挑戰</h3><p>自主足球機器人競賽要求兩台機器人在全自主（無人干涉）的情況下，在特定球場中尋找球、進行防守、進攻射門並避開對手。這需要在極高時間限制下進行毫秒級的感測與控制響應。</p><h3>控制系統開發與演算法</h3><ul><li><strong>多感測器數據融合</strong>：實時讀取紅外線尋球感測器（IR Seeker）以定位球的位置、超音波感測器以判斷球場邊界、以及電子羅盤（Compass Sensor）進行車身方向校正。</li><li><strong>移動決策狀態機</strong>：採用階層式有限狀態機（HFSM），精準切換「尋球」、「運球繞行」、「防守阻截」與「射門定位」等行為。</li><li><strong>馬達 PID 控制與差速驅動</strong>：使用馬達轉速與角度回授控制，實作調校優化之動態 <strong>PID (比例-積分-微分) 控制迴圈</strong>，其控制頻率高達 <strong>100Hz</strong>，確保機器人在運球與急停轉向時的軌跡平滑度，避免物理打滑或偏擺誤差累積。</li></ul><h3>國際與全國競賽佳績</h3><ul><li><strong>2019 WRO Macau International Meeting</strong> - 足球組 Football Merit Prize</li><li><strong>2018 & 2019 WRO 奧林匹亞智慧機器人聯盟賽-足球組</strong> - 全國第三名</li><li><strong>2018 全能機器人國際邀請賽-自主足球</strong> - 第二名</li></ul>",
    "githubUrl": "https://github.com/BrianChuan",
    "videoUrl": "",
    "reportUrl": "",
    "tags": ["Lego Mindstorms EV3", "Robotics", "PID Control", "Sensor Fusion"]
  },
  {
    "id": "ai-mood-diner",
    "title": "AI心情食堂「呷飽沒!!!?」- 智慧人機對話與美食推薦系統",
    "semester": "114-1 智慧人機互動",
    "category": "course",
    "description": "智慧人機對話與情感美食推薦系統，整合類 RPG 角色扮演心情對話、RAG 本地美食知識庫、Hugging Face API 圖像生成與 Groq LLM 決策引擎。",
    "details": "<h3>解決青年族群「選擇困難症」</h3><p>本系統旨在解決現代年輕人決定「吃什麼」的日常痛點。透過對話式介面引導，以情感化、遊戲化的方式，根據使用者當前的心情與喜好，智慧推薦周邊美食餐廳，並規劃導航路徑。</p><h3>關鍵技術架構</h3><ul><li><strong>類 RPG 互動測試與自評</strong>：設計有趣的心理情境問題，由使用者決定虛擬世界的走向，從中評測使用者的當天情緒指數（1-5分）與主食偏好（飯/麵/隨便）。</li><li><strong>RAG 本地美食知識庫</strong>：建置餐廳與情緒特徵對應的知識庫，結合檢索增強生成（RAG）技術，精準配對出符合使用者當下心理庫存特色名店。</li><li><strong>多模態 AI 整合</strong>：呼叫 <strong>Hugging Face API (Diffusion Model)</strong> 即時生成專屬的美食裝飾合成圖，並利用 <strong>Groq API</strong> 呼叫 LLM 生成幽默風趣且極具說服力的餐廳介紹與推薦理由。</li><li><strong>導航整合</strong>：一鍵導流至 Google Map 規劃路線，完美打通「心情評測-AI生成推薦-地圖導航」的完整閉環體驗。</li></ul>",
    "githubUrl": "https://github.com/BrianChuan",
    "videoUrl": "https://youtu.be/pCONBIM6OEc",
    "reportUrl": "Project Reports/智慧人機互動-期末報告.pdf",
    "tags": ["RAG", "Groq API", "FastAPI", "Stable Diffusion", "HCI"]
  },
  {
    "id": "common-enemy-bot",
    "title": "使用 LLM 促進融洽關係 - Common Enemy Effect Line Bot",
    "semester": "114-2 AI進階課程",
    "category": "course",
    "description": "基於社會心理學「共同敵人效應」設計的社群活躍機器人。透過 FastAPI 背景任務、Gemini 雙金鑰備援機制與 SD 早安圖生成，突破安靜群組的互動僵局。",
    "details": "<h3>社群群組冷場的救星</h3><p>研究顯示群組中高達 90% 的成員傾向於「潛水」觀看，導致群組活躍度在數週內迅速下降。本專案以「共同對立面（無害敵人）」為核心，開發出一個講話荒謬、極度自戀且邏輯崩壞的 Line 機器人，引導群組成員聯手吐槽它，進而活絡氣氛。</p><h3>核心技術實作與決策</h3><ul><li><strong>FastAPI BackgroundTasks 逾時防禦</strong>：Line 平台規定 Webhook 回傳必須在 2 秒內完成，否則會判定 Timeout。本系統在簽章驗證後立即回傳 HTTP 200，將 LLM 推理與圖像生成模組移至<strong>背景執行（Background Tasks）</strong>，徹底排除逾時問題。</li><li><strong>Gemini 2.5 Flash 雙金鑰備援與降級防護</strong>：在調用 API 失敗時，系統會自動在背景切換至第二組備用金鑰；若完全失效，則降級調用本地靜態自戀語料庫，確保服務不中斷。</li><li><strong>三大觸發模式</strong>：支援「指令觸發（@create image 呼叫 Diffusion 生成惡搞早安圖）」、「主動觸發（APScheduler 輕量排程在 30 分至 2 小時內隨機推播荒謬引戰言論）」、與「被動觸發（@Bot 進行即時 Gemini 搞笑回應）」。</li></ul>",
    "githubUrl": "https://github.com/BrianChuan",
    "videoUrl": "https://youtu.be/7k81M81tYGI",
    "reportUrl": "Project Reports/114-2 AI進階課程.pdf",
    "tags": ["FastAPI", "Line Bot SDK", "Gemini 2.5 Flash", "Threading", "SD"]
  },
  {
    "id": "adapt-gear",
    "title": "Adapt Gear 運動裝備顧問與數據分析系統",
    "semester": "114-1 核心專案",
    "category": "course",
    "description": "智慧型運動裝備顧問系統，結合跑者姿態、公路車踩踏力道與重心分布多感測器數據分析，利用機器學習提供客製化的裝備建議與設定調整。",
    "details": "<h3>智慧運動數據化與裝備匹配</h3><p>本專案旨在透過物聯網與數據分析，為運動愛好者改善踩踏姿態並尋找最佳器材設定，解決因設定不當（如公路車座墊高度錯誤、跑鞋避震不足）導致的運動傷害。</p><h3>核心實作細節</h3><ul><li><strong>多感測數據採集</strong>：收集自行車踏頻、騎乘者坐姿重心偏移量，以及跑步時足底壓力點的動態變化。</li><li><strong>機器學習預測（Python Scikit-Learn）</strong>：進行特徵工程，將時間序列的姿態數據進行傅立葉轉換提取特徵頻率，並利用隨機森林（Random Forest）與 SVM 模型，對使用者的踩踏效能進行分類，進一步演算出後照鏡與車身設定的最佳建議。</li></ul>",
    "githubUrl": "https://github.com/BrianChuan",
    "videoUrl": "https://youtu.be/ruAyYM8yXS8",
    "reportUrl": "",
    "tags": ["Python", "Scikit-Learn", "IoT Data", "Feature Engineering"]
  },
  {
    "id": "digital-system-design",
    "title": "數位系統設計：Verilog 模組化電路設計與 FPGA 實作",
    "semester": "113-2 專業課程",
    "category": "course",
    "description": "硬體描述語言與數位邏輯電路設計。實作模組化乘法器、有限狀態機（FSM）時脈控制電路，並於 FPGA 開發板上完成硬體測試與佈署。",
    "details": "<h3>Verilog 電路描述與邏輯優化</h3><p>深入數位系統設計之實務。包含設計可參數化配置的管線化（Pipelined）乘法器，並透過 ModelSim 進行精準的時脈波形模擬。在實體 FPGA 佈署上，進行了時序約束（Time Constraints）調校，避免電路發生 Setup/Hold Time violation，穩固硬體底層通訊基礎。</p>",
    "githubUrl": "https://github.com/BrianChuan",
    "videoUrl": "https://youtu.be/7k81M81tYGI",
    "reportUrl": "",
    "tags": ["Verilog", "FPGA", "ModelSim", "Logic Optimization"]
  },
  {
    "id": "smart-factory-warehouse",
    "title": "智慧工廠：AGV 自動導引車與智能倉儲管理系統",
    "semester": "113學年度",
    "category": "course",
    "description": "整合 AGV 小車自動尋跡、RFID 棧板標籤識別與物聯網 MQTT 通訊，打造低延遲的自動化工業倉儲調度模擬系統。",
    "details": "<h3>智慧倉儲工業 4.0 模擬</h3><p>本專案旨在實現工廠自動化貨物搬運。整合嵌入式硬體小車與物聯網雲端控制台，完成自動搬運與智能庫存盤點。</p><h3>技術點與系統實作</h3><ul><li><strong>AGV 小車自動循跡與避障</strong>：小車底層搭載感測器，透過紅外線循跡電路實作 PID 糾偏軌跡行駛，並以紅外線/超音波避障模組避免碰撞。</li><li><strong>RFID 物料標記與物聯網通訊</strong>：車體搭載 RFID 讀卡模組，搬運時自動刷讀棧板標籤確認品項；透過 <strong>Wi-Fi (MQTT 通訊協定)</strong> 將倉儲位置與物料狀態即時上傳至中央控制台。</li></ul>",
    "githubUrl": "https://github.com/BrianChuan",
    "videoUrl": "https://youtu.be/l9m94xXhNb4",
    "reportUrl": "",
    "tags": ["AGV", "MQTT", "RFID", "Embedded C", "IoT"]
  },
  {
    "id": "wuling-kom",
    "title": "武嶺 KOM 證書製作工具 (WuLing KOM Certificate)",
    "semester": "113-2 個人專案",
    "category": "side-project",
    "description": "專為自行車愛好者設計的個人 Side Project。使用者輸入騎乘完成時間與上傳登頂照片，即可在網頁端利用 Canvas 技術一鍵渲染生成客製化的精美「武嶺登頂紀念證書」，支持下載保存。",
    "details": "<h3>開發動機 (Side Project for Hobby)</h3><p>作為一名熱愛公路車運動的騎士，爬上台灣公路最高點「武嶺」是所有車友的夢想。為了記錄與紀念這一刻，我開發了這款網頁證書產生器，提供騎乘時間輸入、姓名填寫、登頂照自由縮放剪裁，並一鍵渲染 Canvas 下載功能，供車友們在社群分享。</p><h3>前端 Canvas 技術實作</h3><p>使用純 HTML5 Canvas 搭配 JavaScript，動態處理照片的載入、旋轉、縮放，並將特定字體與背景模版合成，最終產出超高解析度的 PNG 證書檔案。</p>",
    "githubUrl": "https://brianchuan.github.io/WuLing-KOM-certificate/",
    "videoUrl": "",
    "reportUrl": "",
    "tags": ["HTML5 Canvas", "Web App", "Side Project", "Cycling"]
  },
  {
    "id": "stm32-rps-game",
    "title": "微算機原理與應用：STM32 猜拳機「拳利遊戲」",
    "semester": "112-1 微算機課程",
    "category": "course",
    "description": "應用 STMicroelectronics STM32 微控制器進行義法半導體 Lab 實作，期末專案結合硬體電路、紅外線/按鍵感測與核心控制邏輯，完成實體猜拳互動遊戲機開發。",
    "details": "<h3>實體微算機專案</h3><p>本專案名為「拳利遊戲」，利用 STM32 微控制器，結合硬體七段顯示器、多個物理按鍵、紅外線偵測器，實作出一個具備計分、玩家對戰與 AI 對戰模式的實體猜拳互動遊戲機。</p><h3>硬體與嵌入式 C 整合</h3><p>使用 Keil C 進行暫存器級及 HAL 庫的程式撰寫，透過 NVIC 中斷管理按鍵輸入，並控制 GPIO 以驅動顯示器及音效輸出裝置。</p>",
    "githubUrl": "https://github.com/BrianChuan",
    "videoUrl": "",
    "reportUrl": "",
    "tags": ["STM32", "C/C++", "Embedded", "MCU"]
  },
  {
    "id": "java-oop-tetris",
    "title": "物件導向程式設計：AI 俄羅斯方塊競賽",
    "semester": "111-2 物件導向",
    "category": "course",
    "description": "主要使用 Java 進行實作，運用物件導向三大特性封裝與多型，並自主研發啟發式評估函數 AI，實現自動玩俄羅斯方塊，於期末課程競賽獲 Kaggle 前列排名。",
    "details": "<h3>Java 物件導向與 AI 自動控制</h3><p>設計具備優良軟體工程架構的俄羅斯方塊程式。為了參加課程的 AI 自動玩方塊競賽，自主實作了以 Pierre Dellacherie 演算法為基礎的啟發式評估函數，對每一落下方塊的可能擺放位置進行即時評分，達到極高消除數。</p>",
    "githubUrl": "https://github.com/BrianChuan",
    "videoUrl": "",
    "reportUrl": "",
    "tags": ["Java", "OOP", "AI Heuristics", "Kaggle"]
  },
  {
    "id": "boolean-simplifier",
    "title": "高階語言程式實習：布林代數化簡器",
    "semester": "111-1 語言程式",
    "category": "course",
    "description": "C 語言程式開發與演算法實踐。期末專題自主開發「布林代數化簡器」終端軟體，可依據卡諾圖與布林定理將輸入之布林運算式化簡至最簡項，並進行步驟解析。",
    "details": "<h3>布林代數化簡演算法</h3><p>使用 C 語言實現 Quine-McCluskey 演算法與 Petrick 法，對輸入之 minterms 進行化簡，產出最簡布林積之和（SOP）結果，並提供詳細的計算合併步驟圖解。</p>",
    "githubUrl": "https://github.com/BrianChuan",
    "videoUrl": "",
    "reportUrl": "",
    "tags": ["C", "Discrete Math", "CLI Tool"]
  }
];

document.addEventListener("DOMContentLoaded", () => {
  initProjects();
  initTerminal();
  initFilters();
  initCustomScrollSpy();
});

/* ==========================================================================
   1. Projects Loading & Rendering
   ========================================================================== */
async function initProjects() {
  try {
    const response = await fetch(JSON_PATH);
    if (!response.ok) throw new Error("Failed to fetch projects.json");
    projects = await response.json();
    localStorage.setItem("brian_portfolio_projects", JSON.stringify(projects));
  } catch (error) {
    console.warn("Could not load projects.json, using local/cache fallback.", error);
    const cached = localStorage.getItem("brian_portfolio_projects");
    if (cached) {
      try {
        projects = JSON.parse(cached);
      } catch (e) {
        projects = DEFAULT_PROJECTS;
      }
    } else {
      projects = DEFAULT_PROJECTS;
    }
  }
  renderProjects();
}

function renderProjects(filter = "all") {
  const grid = document.getElementById("projectsGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const filteredProjects = projects.filter(p => {
    if (filter === "all") return true;
    return p.category === filter;
  });

  filteredProjects.forEach(project => {
    const card = document.createElement("div");
    card.className = "project-card";
    card.setAttribute("data-id", project.id);
    
    // Category mapping for new "contest" category
    let categoryClass = "course";
    let categoryText = "課程專案";
    if (project.category === "side-project") {
      categoryClass = "side-project";
      categoryText = "Side Project";
    } else if (project.category === "contest") {
      categoryClass = "contest";
      categoryText = "競賽專案";
    }
    const tagsHtml = (project.tags || []).map(t => `<span class="project-tag">${t}</span>`).join("");

    // Links HTML
    let linksHtml = "";
    if (project.githubUrl) {
      linksHtml += `<a href="${project.githubUrl}" target="_blank" class="project-link-btn" title="GitHub"><i class="fab fa-github"></i></a>`;
    }
    if (project.videoUrl) {
      linksHtml += `<a href="${project.videoUrl}" target="_blank" class="project-link-btn" title="影片展示"><i class="fas fa-play"></i></a>`;
    }
    if (project.reportUrl) {
      linksHtml += `<a href="${project.reportUrl}" target="_blank" class="project-link-btn" title="專案報告"><i class="fas fa-file-pdf"></i></a>`;
    }

    // Extract YouTube ID for Cover Image
    const youtubeId = getYoutubeId(project.videoUrl);
    let coverHtml = "";
    if (youtubeId) {
      coverHtml = `
        <div class="project-card-cover">
          <img src="https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg" alt="${project.title}">
          <div class="video-play-indicator"><i class="fas fa-play-circle"></i> 影音介紹</div>
        </div>
      `;
    } else {
      // Show dynamic gradient placeholder for projects without video
      coverHtml = `
        <div class="project-card-cover tech-gradient-placeholder">
          <i class="fas fa-microchip"></i>
        </div>
      `;
    }

    card.innerHTML = `
      ${coverHtml}
      <div class="project-header">
        <span class="project-date">${project.semester}</span>
        <span class="project-category ${categoryClass}">${categoryText}</span>
      </div>
      <h3 class="project-title">${project.title}</h3>
      <p class="project-description">${project.description || "尚無詳細介紹。"}</p>
      <div class="project-tags">
        ${tagsHtml}
      </div>
      ${linksHtml ? `<div class="project-links">${linksHtml}</div>` : ''}
    `;

    // Click handler for opening the blog post style detail panel
    card.addEventListener("click", (e) => {
      // Ignore click if user clicked directly on links
      if (e.target.closest(".project-links")) {
        return;
      }
      openProjectBlog(project.id);
    });

    grid.appendChild(card);
  });
}

function initFilters() {
  const buttons = document.querySelectorAll(".filter-btn");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const filter = btn.getAttribute("data-filter");
      renderProjects(filter);
    });
  });
}

/* ==========================================================================
   2. Interactive Terminal CLI
   ========================================================================== */
function initTerminal() {
  const input = document.getElementById("terminalInput");
  const output = document.getElementById("terminalOutput");
  if (!input || !output) return;

  output.innerHTML = `
    <p>Welcome to Brian's shell [Version 1.0.0]</p>
    <p>Type <span style="color:#8e6e66">help</span> to list available commands or click shortcut buttons below.</p>
    <br>
  `;

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const command = input.value.trim();
      executeCommand(command);
      input.value = "";
    }
  });

  // Event delegation for terminal shortcut buttons
  document.querySelectorAll(".terminal-shortcut-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const command = btn.getAttribute("data-cmd");
      executeCommand(command);
    });
  });
}

function executeCommand(cmd) {
  const output = document.getElementById("terminalOutput");
  const body = document.getElementById("terminalBody");
  if (!output || !body) return;

  const userLine = document.createElement("div");
  userLine.className = "terminal-prompt";
  userLine.innerHTML = `<span class="terminal-prompt-symbol">guest@brianchuan:~$</span> <span>${cmd}</span>`;
  output.appendChild(userLine);

  const cleanCmd = cmd.toLowerCase().trim();
  const responseLine = document.createElement("div");
  responseLine.className = "terminal-output";

  switch (cleanCmd) {
    case "help":
      responseLine.innerHTML = `
        <p>Available commands:</p>
        <p>&nbsp;&nbsp;<span style="color:#8e6e66">about</span>&nbsp;&nbsp;&nbsp;&nbsp;- Learn more about Brian</p>
        <p>&nbsp;&nbsp;<span style="color:#8e6e66">skills</span>&nbsp;&nbsp;&nbsp;- Display programming skills</p>
        <p>&nbsp;&nbsp;<span style="color:#8e6e66">projects</span>&nbsp;- Print highlights of top projects</p>
        <p>&nbsp;&nbsp;<span style="color:#8e6e66">contact</span>&nbsp;&nbsp;- Get contact links & social details</p>
        <p>&nbsp;&nbsp;<span style="color:#8e6e66">clear</span>&nbsp;&nbsp;&nbsp;&nbsp;- Clear the screen</p>
      `;
      break;
    case "about":
      responseLine.innerHTML = `
        <p style="color:#8e6e66">謝進權 (Brian Hsieh)</p>
        <p>臺北科技大學 電子工程系 (2022 - 2026)</p>
        <p>一位對知識抱持高度熱情，具備軟硬體整合能力的工程師。曾實習於桃園捷運數位發展中心，協助資料庫維護與網頁/App開發，並獲得多次國際及全國機器人足球競賽佳績。</p>
      `;
      break;
    case "skills":
      responseLine.innerHTML = `
        <p><span style="color:#8e6e66">Programming Languages:</span> C, C++, Python, Java, Verilog, HTML/CSS/JavaScript</p>
        <p><span style="color:#8e6e66">Tools & Platforms:</span> Git/GitHub, STM32, FPGA, Jupyter Notebook, SQL, Linux</p>
        <p><span style="color:#8e6e66">Certificates:</span> AMA Advanced Microcontroller, iPAS AI Planner (Level 1), Computer Hardware Repair (Class C)</p>
      `;
      break;
    case "projects":
      responseLine.innerHTML = `
        <p><span style="color:#ef4444">[競賽]</span> TRIZ 機車安全研究 - NTUT Competition 2nd Place</p>
        <p><span style="color:#f59e0b">[競賽]</span> WRO 自主足球機器人 - Multi-sensor control loop</p>
        <p><span style="color:#3b82f6">[課程]</span> 數位保鏢系統 - Real-time Kalman security detector</p>
        <p><span style="color:#10b981">[個人]</span> 武嶺 KOM 證書製作工具 - Side Project (Canvas generator)</p>
        <p>Type <span style="color:#8e6e66">projects</span> filter on the portfolio grid below to explore more!</p>
      `;
      break;
    case "contact":
      responseLine.innerHTML = `
        <p>Email: <a href="mailto:0103.brian@gmail.com" style="color:#8e6e66">0103.brian@gmail.com</a></p>
        <p>GitHub: <a href="https://github.com/BrianChuan" target="_blank" style="color:#8e6e66">https://github.com/BrianChuan</a></p>
        <p>LinkedIn: <a href="https://www.linkedin.com/in/brian-hsieh0103/" target="_blank" style="color:#8e6e66">brian-hsieh0103</a></p>
      `;
      break;
    case "clear":
      output.innerHTML = "";
      return;
    default:
      if (cleanCmd !== "") {
        responseLine.innerHTML = `<p style="color:#ef4444">Command not found: "${cmd}". Type <span style="color:#8e6e66">help</span> for assistance.</p>`;
      }
  }

  output.appendChild(responseLine);
  body.scrollTop = body.scrollHeight;
}

/* ==========================================================================
   3. Blog-style Project Details Panel (Slide-over presentation)
   ========================================================================== */
window.openProjectBlog = function(id) {
  const project = projects.find(p => p.id === id);
  if (!project) return;

  document.getElementById("blogProjectTitle").innerText = project.title;
  document.getElementById("blogProjectSemester").innerText = project.semester;
  
  let categoryText = "課程專案";
  let categoryClass = "course";
  if (project.category === "side-project") {
    categoryText = "Side Project (個人興趣)";
    categoryClass = "side-project";
  } else if (project.category === "contest") {
    categoryText = "競賽專案";
    categoryClass = "contest";
  }
  
  const catEl = document.getElementById("blogProjectCategory");
  catEl.innerHTML = `<span class="project-category ${categoryClass}">${categoryText}</span>`;

  // Parse and set Video Embed URL
  const videoContainer = document.getElementById("blogVideoContainer");
  const iframe = document.getElementById("blogIframeVideo");
  const embedUrl = getYoutubeEmbedUrl(project.videoUrl);

  if (embedUrl) {
    iframe.src = embedUrl;
    videoContainer.style.display = "block";
  } else {
    iframe.src = "";
    videoContainer.style.display = "none";
  }

  // Set blog content details
  document.getElementById("blogProjectContent").innerHTML = project.details || `<h3>專案簡介</h3><p>${project.description}</p>`;

  // Render links
  const linksEl = document.getElementById("blogProjectLinks");
  linksEl.innerHTML = "";
  if (project.githubUrl) {
    linksEl.innerHTML += `<a href="${project.githubUrl}" target="_blank" class="btn btn-outline-dark me-2 mb-2" style="border-color:var(--border-color); color:var(--text-primary);"><i class="fab fa-github"></i> GitHub 連結</a>`;
  }
  if (project.reportUrl) {
    linksEl.innerHTML += `<a href="${project.reportUrl}" target="_blank" class="btn btn-outline-dark me-2 mb-2" style="border-color:var(--border-color); color:var(--text-primary);"><i class="fas fa-file-pdf"></i> 專案報告</a>`;
  }

  document.getElementById("projectBlogPanel").classList.add("show");
  document.querySelector(".blog-panel-container").scrollTop = 0;
};

window.closeProjectBlog = function() {
  const iframe = document.getElementById("blogIframeVideo");
  if (iframe) iframe.src = ""; // Stop video playback
  document.getElementById("projectBlogPanel").classList.remove("show");
};

// Helper: Extracts 11-char Video ID from YouTube link
function getYoutubeId(url) {
  if (!url) return "";
  let videoId = "";
  if (url.includes("youtu.be/")) {
    videoId = url.split("youtu.be/")[1].split(/[?#]/)[0];
  } else if (url.includes("watch?v=")) {
    videoId = url.split("watch?v=")[1].split("&")[0];
  } else if (url.includes("embed/")) {
    videoId = url.split("embed/")[1].split(/[?#]/)[0];
  } else if (url.length === 11) {
    videoId = url;
  }
  return videoId;
}

// Helper: Converts standard YouTube share link to embeddable link format
function getYoutubeEmbedUrl(url) {
  const videoId = getYoutubeId(url);
  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}`;
  }
  return url;
}

/* ==========================================================================
   4. Lightweight Custom ScrollSpy for SideNav Highlighting
   ========================================================================== */
function initCustomScrollSpy() {
  const navLinks = document.querySelectorAll("#sideNav .nav-link");
  const sections = document.querySelectorAll(".resume-section");

  function spy() {
    let currentId = "";
    const scrollPosition = window.scrollY + 180;

    sections.forEach(sec => {
      const top = sec.offsetTop;
      const height = sec.offsetHeight;
      const id = sec.getAttribute("id");
      
      if (scrollPosition >= top && scrollPosition < (top + height)) {
        currentId = id;
      }
    });

    if (window.scrollY < 100) {
      currentId = "about";
    }

    if (currentId) {
      navLinks.forEach(link => {
        link.classList.remove("active");
        if (link.getAttribute("href") === `#${currentId}`) {
          link.classList.add("active");
        }
      });
    }
  }

  window.addEventListener("scroll", spy);
  spy();
}
