/**
 * English Immersive Learning Tracker - Logic and Syncing
 */

// Local Storage Keys
const LOGS_KEY = "brian_english_logs";
const VOCAB_KEY = "brian_english_vocab";
const CHECKPOINTS_KEY = "brian_english_checkpoints";
const SESSION_KEY = "brian_session_token";
const SETTINGS_KEY = "brian_english_settings";

// Gemini Live System Instruction Prompt
const GEMINI_SYSTEM_PROMPT = `You are an engaging, supportive English conversation partner specialized in helping the user practice speaking and logic organization. The user will share a topic, video, or podcast they recently watched, and your job is to co-create an interactive discussion.

Follow these strict rules to optimize for voice-based (Gemini Live) interaction:

1. Persona & Setup:
   - Start by asking the user: "What video or podcast did you watch today? Tell me the title or the main idea, and let me know if you want me to be a 'friendly conversationalist' or a 'structured interviewer'."
   - Adjust your tone based on their choice:
     - Friend: Casual, curious, encouraging, using conversational interjections (e.g., "Oh, interesting!", "Right, that makes sense.").
     - Interviewer: Professional, analytical, posing structured follow-up questions to test their logic.

2. Keep it Conversational & Short (Crucial for Live Voice):
   - Keep your responses to 1-3 sentences maximum. Avoid long monologues. 
   - Ask exactly ONE clear, open-ended question at a time to prompt the user's response.
   - Do not summarize the video yourself; let the user do the explaining.

3. Prioritize Fluency & Flow (No Active Correction):
   - Never interrupt the conversation to point out grammatical, pronunciation, or vocabulary mistakes. 
   - Focus entirely on the user's logic and viewpoints. Keep the conversation flowing naturally.
   - If the user struggles to find a word or pauses, wait patiently, or gently offer a word if they ask for help.

4. Session Wrap-Up:
   - When the user says "Let's wrap up for today" or after 10-15 minutes of discussion, exit the roleplay.
   - Provide a quick, encouraging summary:
     - 1-2 points about what they expressed well logically.
     - 2-3 actionable suggestions for vocabulary or phrasing improvements based on what they said, formatted cleanly.`;

// In-Memory Database State
let logs = [];
let vocab = [];
let checkpoints = [];
// Timer State Variables
let inputTimerInterval = null;
let inputTimerSeconds = 0;
let inputTimerStartTime = null;
let outputTimerInterval = null;
let outputTimerSeconds = 0;
let outputTimerStartTime = null;
let activeTimerType = null; // 'input' or 'output' or null

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem(SESSION_KEY);
  if (token) {
    // 已登入
    document.getElementById("loginOverlay").classList.add("hidden");
    document.getElementById("logoutBtn").style.display = "block";
    initApp();
  } else {
    // 未登入
    setupLoginListeners();
  }
});

function initApp() {
  loadData();
  setupEventListeners();
  renderAll();
  
  // 啟動自動同步
  syncWithGoogleSheets();
}

function setupLoginListeners() {
  const form = document.getElementById("loginForm");
  const errorMsg = document.getElementById("loginErrorMsg");
  const submitBtn = document.getElementById("loginSubmitBtn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorMsg.style.display = "none";
    
    const u = document.getElementById("loginUsername").value.trim();
    const p = document.getElementById("loginPassword").value.trim();

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 驗證中...`;

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p })
      });
      
      const data = await res.json();
      
      if (res.ok && data.status === "success") {
        // 驗證成功，儲存無狀態 Token
        localStorage.setItem(SESSION_KEY, data.token);
        
        // 隱藏登入畫面並啟動系統
        document.getElementById("loginOverlay").classList.add("hidden");
        document.getElementById("logoutBtn").style.display = "block";
        initApp();
      } else {
        errorMsg.querySelector("span").innerText = data.message || "登入失敗";
        errorMsg.style.display = "block";
      }
    } catch (err) {
      errorMsg.querySelector("span").innerText = "伺服器無回應，請確認 Cloudflare 狀態";
      errorMsg.style.display = "block";
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i class="fas fa-sign-in-alt"></i> 登入系統`;
    }
  });
}

// Load Data from LocalStorage
function loadData() {
  logs = JSON.parse(localStorage.getItem(LOGS_KEY)) || [];
  vocab = JSON.parse(localStorage.getItem(VOCAB_KEY)) || [];
  checkpoints = JSON.parse(localStorage.getItem(CHECKPOINTS_KEY)) || [];
}

// Save Data to LocalStorage
function saveData() {
  localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
  localStorage.setItem(VOCAB_KEY, JSON.stringify(vocab));
  localStorage.setItem(CHECKPOINTS_KEY, JSON.stringify(checkpoints));
}

// Event Listeners Routing
function setupEventListeners() {
  // Tab buttons
  const tabButtons = document.querySelectorAll(".tab-btn");
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      tabButtons.forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      
      btn.classList.add("active");
      const tabId = btn.getAttribute("data-tab");
      document.getElementById(tabId).classList.add("active");
    });
  });

  // Forms
  document.getElementById("inputLogForm").addEventListener("submit", handleInputLog);
  document.getElementById("outputLogForm").addEventListener("submit", handleOutputLog);
  document.getElementById("checkpointForm").addEventListener("submit", handleCheckpointAdd);

  // Gemini Tools
  document.getElementById("copyPromptBtn").addEventListener("click", copyGeminiPrompt);
  document.getElementById("parseFeedbackBtn").addEventListener("click", parseGeminiFeedback);

  // Exporters & Backups
  document.getElementById("exportAnkiBtn").addEventListener("click", exportAnkiCSV);
  document.getElementById("exportLocalBtn").addEventListener("click", exportLocalBackup);
  document.getElementById("importLocalBtn").addEventListener("click", () => {
    document.getElementById("importFileHidden").click();
  });
  document.getElementById("importFileHidden").addEventListener("change", importLocalBackup);

  // Sync settings
  document.getElementById("syncNowBtn").addEventListener("click", syncWithGoogleSheets);

  // Logout
  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem(SESSION_KEY);
    location.reload();
  });

  // Checkpoint Modal
  document.getElementById("addCheckpointBtn").addEventListener("click", openCheckpointModal);
  
  // Clear Logs
  document.getElementById("clearAllLogsBtn").addEventListener("click", clearAllLogs);

  // Timer Actions
  document.getElementById("toggleInputTimerBtn").addEventListener("click", toggleInputTimerUI);
  document.getElementById("startInputTimerBtn").addEventListener("click", handleInputTimerAction);
  document.getElementById("toggleOutputTimerBtn").addEventListener("click", toggleOutputTimerUI);
  document.getElementById("startOutputTimerBtn").addEventListener("click", handleOutputTimerAction);

  // Zone Mode Controls
  document.getElementById("zoneStopBtn").addEventListener("click", () => {
    if (activeTimerType === "input") {
      handleInputTimerAction();
    } else if (activeTimerType === "output") {
      handleOutputTimerAction();
    }
  });
  document.getElementById("zoneMinimizeBtn").addEventListener("click", () => {
    document.getElementById("zoneOverlay").classList.remove("show");
    document.getElementById("zoneFloatingBadge").style.display = "block";
  });
  document.getElementById("zoneFloatingBadge").addEventListener("click", () => {
    document.getElementById("zoneOverlay").classList.add("show");
    document.getElementById("zoneFloatingBadge").style.display = "none";
  });

  // Page Visibility listeners
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("focus", handleVisibilityChange);
}

/* ==========================================================================
   Rendering Controls
   ========================================================================== */
function renderAll() {
  renderStats();
  renderHeatmap();
  renderHistory();
  renderVocab();
  renderCheckpoints();
  updateSyncStatusText();
}

// Render Header Statistics
function renderStats() {
  // 1. Total Hours
  let totalMinutes = 0;
  logs.forEach(l => totalMinutes += Number(l.duration));
  const totalHrs = (totalMinutes / 60).toFixed(1);
  document.getElementById("totalHours").innerText = totalHrs;

  // Milestone Progress (Goal: 100 Hours)
  const progressPct = Math.min(100, Math.round((totalHrs / 100) * 100));
  const progressBar = document.getElementById("hoursProgressBar");
  if (progressBar) progressBar.style.width = `${progressPct}%`;
  document.getElementById("progressPctText").innerText = `已完成 ${progressPct}% 的里程碑目標 (100 小時)`;

  // 2. Streak Days
  const streak = calculateStreak();
  document.getElementById("streakDays").innerText = streak;

  // 3. Last Test Score
  if (checkpoints.length > 0) {
    // Sort by date descending
    const sorted = [...checkpoints].sort((a, b) => new Date(b.date) - new Date(a.date));
    document.getElementById("lastTestScore").innerText = sorted[0].score;
  } else {
    document.getElementById("lastTestScore").innerText = "N/A";
  }
}

// Calculate Streak Days
function calculateStreak() {
  if (logs.length === 0) return 0;

  // Extract unique dates of logs
  const logDates = [...new Set(logs.map(l => l.date))].sort().reverse();
  
  // Get local date representation
  const todayStr = getLocalDateString(new Date());
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);

  // If no logs today and no logs yesterday, streak is broken
  if (!logDates.includes(todayStr) && !logDates.includes(yesterdayStr)) {
    return 0;
  }

  let streak = 0;
  let checkDate = new Date();
  
  // If no log today but there is one yesterday, start checking from yesterday
  if (!logDates.includes(todayStr) && logDates.includes(yesterdayStr)) {
    checkDate = yesterday;
  }

  while (true) {
    const checkDateStr = getLocalDateString(checkDate);
    if (logDates.includes(checkDateStr)) {
      streak++;
      // Go back one day
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

// Render GitHub-Style Contribution Heatmap
function renderHeatmap() {
  const grid = document.getElementById("heatmapGrid");
  if (!grid) return;
  grid.innerHTML = "";

  // We want to render cells representing the past 365 days ending today
  // Let's find the start date (364 days ago)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 364);

  // Calculate day-of-week offset for row align
  const startDay = startDate.getDay(); // 0 is Sunday, 1 is Monday...
  
  // Add empty placeholders for grid alignment so columns represent weeks (Sun-Sat)
  // We want rows 0-6 represent Sunday to Saturday
  for (let i = 0; i < startDay; i++) {
    const placeholder = document.createElement("div");
    placeholder.className = "heatmap-cell level-0";
    placeholder.style.visibility = "hidden";
    grid.appendChild(placeholder);
  }

  // Map logs by date for efficient lookup
  // Format: { "YYYY-MM-DD": { input: mins, output: mins, passive: mins } }
  const dateMap = {};
  logs.forEach(log => {
    if (!dateMap[log.date]) {
      dateMap[log.date] = { input: 0, output: 0, passive: 0 };
    }
    if (log.type === "input") {
      if (log.passive) {
        dateMap[log.date].passive += Number(log.duration);
      } else {
        dateMap[log.date].input += Number(log.duration);
      }
    } else if (log.type === "output") {
      dateMap[log.date].output += Number(log.duration);
    }
  });

  // Render 365 cells
  const tempDate = new Date(startDate);
  for (let d = 0; d <= 364; d++) {
    const dateStr = getLocalDateString(tempDate);
    const dayLog = dateMap[dateStr] || { input: 0, output: 0, passive: 0 };

    const cell = document.createElement("div");
    cell.className = "heatmap-cell";
    cell.setAttribute("data-date", dateStr);

    // Determine Heatmap Color Level
    let level = 0;
    const totalActiveMins = dayLog.input + dayLog.output;
    const totalPassiveMins = dayLog.passive;

    if (dayLog.input >= 60 && dayLog.output >= 60) {
      level = 4; // Perfect Day (Reached both goals)
    } else if (dayLog.input >= 60 || dayLog.output >= 60 || totalActiveMins >= 90) {
      level = 3; // Reached one side goal or high activity
    } else if (totalActiveMins > 0 && totalActiveMins < 90) {
      level = 2; // Moderate activity
    } else if (totalPassiveMins > 0) {
      level = 1; // Passive background listening only
    } else {
      level = 0; // Empty day
    }

    cell.classList.add(`level-${level}`);
    
    // Formatting tooltip text
    const labelDate = tempDate.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric', year: 'numeric' });
    let tooltip = `${labelDate}: `;
    if (level === 0) {
      tooltip += "無學習紀錄";
    } else {
      const items = [];
      if (dayLog.input > 0) items.push(`輸入 ${dayLog.input} 分鐘`);
      if (dayLog.passive > 0) items.push(`背景聽讀 ${dayLog.passive} 分鐘`);
      if (dayLog.output > 0) items.push(`輸出 ${dayLog.output} 分鐘`);
      tooltip += items.join(", ");
    }
    
    // Custom cursor-following tooltip events and click history modal
    cell.addEventListener("mouseenter", (e) => {
      showTooltip(e, tooltip);
    });
    cell.addEventListener("mousemove", (e) => {
      moveTooltip(e);
    });
    cell.addEventListener("mouseleave", () => {
      hideTooltip();
    });
    cell.addEventListener("click", () => {
      openHistoryModal(dateStr);
    });

    grid.appendChild(cell);
    tempDate.setDate(tempDate.getDate() + 1);
  }
}

// Render History Log List
function renderHistory() {
  const historyList = document.getElementById("historyList");
  if (!historyList) return;
  historyList.innerHTML = "";

  if (logs.length === 0) {
    historyList.innerHTML = `<div class="text-muted" style="text-align:center; padding: 20px;">尚無學習紀錄，快去新增一筆吧！</div>`;
    return;
  }

  // Sort logs by date descending, then id descending
  const sortedLogs = [...logs].sort((a, b) => {
    if (a.date !== b.date) {
      return new Date(b.date) - new Date(a.date);
    }
    return b.id.localeCompare(a.id);
  });

  // Display top 10 logs in history list
  sortedLogs.slice(0, 10).forEach(log => {
    const item = document.createElement("div");
    item.className = "history-item";

    const badgeClass = log.type;
    const badgeExtra = log.passive ? " passive" : "";
    const badgeText = log.type === "input" ? (log.passive ? "背景" : "輸入") : "輸出";
    
    // Icon representations
    const icon = log.type === "input" ? '<i class="fas fa-headphones"></i>' : '<i class="fas fa-comment"></i>';
    const detailMeta = log.type === "input" ? `來源: ${log.source}` : `方式: ${log.outputType}`;
    const dateFormatted = new Date(log.date).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' });

    item.innerHTML = `
      <div class="history-item-details">
        <span class="badge-log ${badgeClass}${badgeExtra}">${badgeText}</span>
        <h4>${log.title}</h4>
        <div class="history-item-meta">
          <span>${icon} ${log.duration} 分鐘</span>
          <span><i class="far fa-calendar"></i> ${dateFormatted}</span>
          <span><i class="fas fa-info-circle"></i> ${detailMeta}</span>
        </div>
      </div>
      <div>
        <button class="btn-delete-log" onclick="deleteLog('${log.id}')" title="刪除此紀錄"><i class="fas fa-trash-alt"></i></button>
      </div>
    `;

    historyList.appendChild(item);
  });
}

// Render Anki Vocabulary chips list
function renderVocab() {
  const vocabList = document.getElementById("vocabList");
  const countSpan = document.getElementById("vocabCount");
  if (!vocabList || !countSpan) return;

  vocabList.innerHTML = "";
  countSpan.innerText = vocab.length;

  if (vocab.length === 0) {
    vocabList.innerHTML = `<div class="text-muted" style="font-size:12px; padding: 10px; width:100%; text-align:center;">生字庫為空</div>`;
    return;
  }

  // Display all vocabularies
  vocab.forEach((item, index) => {
    const chip = document.createElement("span");
    chip.className = "vocab-chip";
    chip.title = `${item.definition || "尚未填寫定義"} (${item.source || "自訂"})`;
    chip.innerHTML = `
      <strong>${item.word}</strong>
      <span class="vocab-chip-remove" onclick="deleteVocab(${index})">&times;</span>
    `;
    vocabList.appendChild(chip);
  });
}

// Render Checkpoint Milestone Table
function renderCheckpoints() {
  const tbody = document.getElementById("checkpointTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (checkpoints.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-muted" style="text-align:center; padding: 20px;">尚無里程碑檢核點。累積時數至 80~100 小時後進行吧！</td></tr>`;
    return;
  }

  // Sort by date descending
  const sortedCheckpoints = [...checkpoints].sort((a, b) => new Date(b.date) - new Date(a.date));

  sortedCheckpoints.forEach((item, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.date}</td>
      <td>${item.hours} 小時</td>
      <td>${item.score} 分</td>
      <td>${item.notes || "無"}</td>
      <td>
        <button class="btn-delete-log" onclick="deleteCheckpoint('${item.id}')" title="刪除"><i class="fas fa-trash-alt"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ==========================================================================
   Data Logs Form Handlers
   ========================================================================== */
function handleInputLog(e) {
  if (e) e.preventDefault();
  submitInputLog();
}

function submitInputLog() {
  const source = document.getElementById("inputSource").value;
  const duration = document.getElementById("inputDuration").value;
  const title = document.getElementById("inputTitle").value.trim();
  const rawVocab = document.getElementById("inputVocabulary").value.trim();
  const passive = document.getElementById("inputPassive").checked;

  if (!duration || Number(duration) <= 0) {
    alert("請輸入或計時有效的學習時間！");
    return;
  }
  if (!title) {
    alert("請輸入素材主題！");
    return;
  }

  const logId = "in-" + Date.now();
  const dateStr = getLocalDateString(new Date());

  const newLog = {
    id: logId,
    type: "input",
    date: dateStr,
    duration: Number(duration),
    source,
    title,
    passive,
    synced: false
  };

  // Add words to vocabulary database
  if (rawVocab) {
    const words = rawVocab.split(",").map(w => w.trim()).filter(w => w);
    words.forEach(word => {
      // Avoid duplicate adding
      if (!vocab.some(v => v.word.toLowerCase() === word.toLowerCase())) {
        vocab.push({
          word,
          definition: "",
          date: dateStr,
          source: title,
          synced: false
        });
      }
    });
  }

  logs.push(newLog);
  saveData();
  renderAll();

  // Reset Form
  document.getElementById("inputLogForm").reset();
  
  // Hide timer alert if visible
  const alertEl = document.getElementById("inputTimerAlert");
  if (alertEl) alertEl.style.display = "none";
  
  // Auto-sync
  syncWithGoogleSheets();
}

function handleOutputLog(e) {
  if (e) e.preventDefault();
  submitOutputLog();
}

function submitOutputLog() {
  const outputType = document.getElementById("outputType").value;
  const duration = document.getElementById("outputDuration").value;
  const title = document.getElementById("outputTitle").value.trim();
  const ratingEl = document.querySelector('input[name="rating"]:checked');
  const rating = ratingEl ? ratingEl.value : 3;

  if (!duration || Number(duration) <= 0) {
    alert("請輸入或計時有效的練習時間！");
    return;
  }
  if (!title) {
    alert("請輸入對話主題！");
    return;
  }

  const logId = "out-" + Date.now();
  const dateStr = getLocalDateString(new Date());

  const newLog = {
    id: logId,
    type: "output",
    date: dateStr,
    duration: Number(duration),
    outputType,
    title,
    rating: Number(rating),
    synced: false
  };

  logs.push(newLog);
  saveData();
  renderAll();

  // Reset Form
  document.getElementById("outputLogForm").reset();

  // Hide timer alert
  const alertEl = document.getElementById("outputTimerAlert");
  if (alertEl) alertEl.style.display = "none";

  // Auto-sync
  syncWithGoogleSheets();
}

window.deleteLog = function(id) {
  if (!confirm("確定要刪除此筆學習紀錄嗎？")) return;
  logs = logs.filter(l => l.id !== id);
  saveData();
  renderAll();
};

window.deleteVocab = function(index) {
  vocab.splice(index, 1);
  saveData();
  renderAll();
};

/* ==========================================================================
   Gemini Live Integration
   ========================================================================== */
function copyGeminiPrompt() {
  const holder = document.getElementById("hiddenPromptHolder");
  holder.value = GEMINI_SYSTEM_PROMPT;
  holder.style.display = "block";
  holder.select();
  document.execCommand("copy");
  holder.style.display = "none";

  const copyBtn = document.getElementById("copyPromptBtn");
  const originalText = copyBtn.innerHTML;
  copyBtn.innerHTML = '<i class="fas fa-check"></i> 已複製';
  copyBtn.style.background = "var(--accent-emerald)";
  
  setTimeout(() => {
    copyBtn.innerHTML = originalText;
    copyBtn.style.background = "";
  }, 2000);
}

// Parse Vocabulary and Feedback text pasted from Gemini Live summary
function parseGeminiFeedback() {
  const input = document.getElementById("geminiFeedbackInput").value.trim();
  if (!input) {
    alert("請先貼入 Gemini 的總結回饋文字。");
    return;
  }

  // Regex patterns to capture words.
  // E.g., Matches lines like:
  // - **Word**: Definition
  // - Word: Definition
  // * Word - Definition
  // Word - Definition
  const lines = input.split("\n");
  let parsedCount = 0;
  const dateStr = getLocalDateString(new Date());

  lines.forEach(line => {
    // Regex matches formats: "- **word**: definition" or "* word - definition" or "1. word: definition"
    // Capture group 1 is word, group 2 is definition
    const match = line.match(/^\s*[-*•\d\.]*\s*\*?\*?([a-zA-Z\s'-]+)\*?\*?\s*[:\-–—]\s*(.+)$/);
    if (match) {
      const word = match[1].trim();
      const definition = match[2].trim();

      // Check validation (words only, length check)
      if (word.length > 1 && word.length < 40 && !vocab.some(v => v.word.toLowerCase() === word.toLowerCase())) {
        vocab.push({
          word: word,
          definition: definition,
          date: dateStr,
          source: "Gemini Live Feedback",
          synced: false
        });
        parsedCount++;
      }
    }
  });

  if (parsedCount > 0) {
    saveData();
    renderAll();
    alert(`成功解析並新增 ${parsedCount} 個生字至生字庫！`);
    document.getElementById("geminiFeedbackInput").value = "";
  } else {
    // Fallback: search for potential bracket words like "word (definition)"
    alert("未能解析出符合規範的格式。建議將 Gemini 提供的「單字 - 定義」逐行列表貼入。");
  }
}

/* ==========================================================================
   Anki CSV Exporter
   ========================================================================== */
function exportAnkiCSV() {
  if (vocab.length === 0) {
    alert("生字庫目前沒有資料可匯出！");
    return;
  }

  // Generate CSV Headers and Rows
  // Anki supports importing comma-separated values: Front, Back, Tags
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Front,Back,Tags\n";

  vocab.forEach(v => {
    // Escape quotes in CSV
    const cleanWord = v.word.replace(/"/g, '""');
    const cleanDef = (v.definition || "").replace(/"/g, '""');
    const tag = "Brian_Immersion_Tracker";

    csvContent += `"${cleanWord}","${cleanDef}","${tag}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", encodedUri);
  downloadAnchor.setAttribute("download", `anki_english_cards_${getLocalDateString(new Date())}.csv`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/* ==========================================================================
   Milestones & Checkpoints Modals
   ========================================================================== */
function openCheckpointModal() {
  document.getElementById("checkpointDate").value = getLocalDateString(new Date());
  
  // Calculate total logged hours so far to pre-fill
  let totalMinutes = 0;
  logs.forEach(l => totalMinutes += Number(l.duration));
  const currentHours = (totalMinutes / 60).toFixed(1);
  document.getElementById("checkpointHours").value = currentHours;

  document.getElementById("checkpointModal").classList.add("show");
}

window.closeCheckpointModal = function() {
  document.getElementById("checkpointModal").classList.remove("show");
};

function handleCheckpointAdd(e) {
  e.preventDefault();

  const date = document.getElementById("checkpointDate").value;
  const hours = document.getElementById("checkpointHours").value;
  const score = document.getElementById("checkpointScore").value;
  const notes = document.getElementById("checkpointNotes").value.trim();

  const newCheckpoint = {
    id: "cp-" + Date.now(),
    date,
    hours: Number(hours),
    score: Number(score),
    notes,
    synced: false
  };

  checkpoints.push(newCheckpoint);
  saveData();
  renderAll();
  
  closeCheckpointModal();
  document.getElementById("checkpointForm").reset();

  // Auto-sync
  syncWithGoogleSheets();
}

window.deleteCheckpoint = function(id) {
  if (!confirm("確定要刪除此筆里程碑檢核紀錄嗎？")) return;
  checkpoints = checkpoints.filter(c => c.id !== id);
  saveData();
  renderAll();
};

/* ==========================================================================
   JSON Import/Export Local Backup
   ========================================================================== */
function exportLocalBackup() {
  const backupData = {
    logs,
    vocab,
    checkpoints
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `english_tracker_backup_${getLocalDateString(new Date())}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importLocalBackup(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const data = JSON.parse(evt.target.result);
      if (data.logs || data.vocab || data.checkpoints) {
        if (confirm("匯入備份將會覆蓋您目前的本地資料，確定要繼續嗎？")) {
          logs = data.logs || [];
          vocab = data.vocab || [];
          checkpoints = data.checkpoints || [];
          
          saveData();
          renderAll();
          alert("資料備份匯入成功！");
        }
      } else {
        alert("格式錯誤：此檔案不包含合法的學習紀錄備份資料。");
      }
    } catch (err) {
      alert("讀取檔案失敗：" + err.message);
    }
  };
  reader.readAsText(file);
  // Reset input value to allow triggering change on same file
  e.target.value = "";
}

function clearAllLogs() {
  if (!confirm("⚠️ 警告：這將徹底清除您本機上的所有學習紀錄與單字庫！確定要全部刪除嗎？")) return;
  logs = [];
  vocab = [];
  checkpoints = [];
  saveData();
  renderAll();
}

/* ==========================================================================
   Cloudflare Worker Sync Integration
   ========================================================================== */
async function syncWithGoogleSheets() {
  const url = "/api/sync";
  const token = localStorage.getItem(SESSION_KEY);

  const syncStatus = document.getElementById("syncStatusText");
  const syncBtn = document.getElementById("syncNowBtn");
  const originalBtnHtml = syncBtn.innerHTML;

  try {
    syncBtn.disabled = true;
    syncBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 同步中...`;
    syncStatus.innerText = "正在透過 Cloudflare Pages 代理同步資料...";

    // Package the full database state to push
    const payload = {
      action: "sync",
      logs: logs,
      vocab: vocab,
      checkpoints: checkpoints
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sync-Token": token || ""
      },
      body: JSON.stringify(payload)
    });
    
    if (res.status === 401) {
      alert("授權已過期或密碼錯誤，請重新登入！");
      localStorage.removeItem(SESSION_KEY);
      location.reload();
      return;
    }
    
    if (!res.ok) throw new Error(`HTTP ${res.status} 錯誤。伺服器或代理端回傳異常。`);
    
    const responseJson = await res.json();
    if (responseJson.status === "success") {
      syncStatus.innerText = `同步成功！上次同步時間: ${new Date().toLocaleTimeString()}`;
      
      // Update local storage with merged lists
      if (responseJson.logs) {
        logs = responseJson.logs;
        logs.forEach(l => l.synced = true);
      }
      if (responseJson.vocab) {
        vocab = responseJson.vocab;
        vocab.forEach(v => v.synced = true);
      }
      if (responseJson.checkpoints) {
        checkpoints = responseJson.checkpoints;
        checkpoints.forEach(c => c.synced = true);
      }
      
      saveData();
      renderAll();
      
      alert("同步成功！資料已與 Google 試算表完成雙向安全同步。");
    } else {
      throw new Error(responseJson.message || "未知伺服器錯誤");
    }
  } catch (error) {
    console.error("Sync Error:", error);
    syncStatus.innerText = "同步失敗，請確認 Worker 網址與金鑰配置。";
    alert(`雲端同步失敗！\n錯誤原因：${error.message}\n\n請確認以下項目：\n1. Cloudflare Worker 已部署且環境變數配置正確。\n2. Worker 網址與安全金鑰正確無誤。\n3. 您是從允許的網域（如 GitHub Pages）進行存取。`);
  } finally {
    syncBtn.disabled = false;
    syncBtn.innerHTML = originalBtnHtml;
  }
}

function updateSyncStatusText() {
  const syncStatus = document.getElementById("syncStatusText");
  if (!syncStatus) return;

  // Check if any logs, vocab, or checkpoints are unsynced
  const unsyncedLogs = logs.filter(l => !l.synced).length;
  const unsyncedVocabs = vocab.filter(v => !v.synced).length;
  const unsyncedCps = checkpoints.filter(c => !c.synced).length;
  const unsyncedCount = unsyncedLogs + unsyncedVocabs + unsyncedCps;

  if (unsyncedCount > 0) {
    syncStatus.innerHTML = `<span class="text-orange"><i class="fas fa-exclamation-triangle"></i> 有 ${unsyncedCount} 筆新資料尚未同步</span>`;
  } else {
    syncStatus.innerHTML = `<span class="text-emerald"><i class="fas fa-check-circle"></i> 資料已全數安全同步至雲端</span>`;
  }
}

/* ==========================================================================
   Helper Utilities
   ========================================================================== */
// Get date represented in "YYYY-MM-DD" local timezone string
function getLocalDateString(date) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
}

/* ==========================================================================
   4. Immersion Timers / Stopwatch Logic & Zone Overlay
   ========================================================================== */

// Input Timer Toggle
function toggleInputTimerUI() {
  const manualBox = document.getElementById("inputManualTimeBox");
  const timerBox = document.getElementById("inputTimerBox");
  const btn = document.getElementById("toggleInputTimerBtn");

  if (timerBox.style.display === "none") {
    // Switch to Timer Mode
    manualBox.style.display = "none";
    timerBox.style.display = "flex";
    btn.innerHTML = `<i class="fas fa-keyboard"></i> 手動輸入`;
    document.getElementById("inputDuration").removeAttribute("required");
  } else {
    // Switch to Manual Mode
    if (inputTimerInterval) {
      if (!confirm("計時器正在運作中，切換模式會中斷計時，確定嗎？")) return;
      resetInputTimer();
    }
    manualBox.style.display = "block";
    timerBox.style.display = "none";
    btn.innerHTML = `<i class="fas fa-stopwatch"></i> 啟動計時器`;
    document.getElementById("inputDuration").setAttribute("required", "required");
  }
}

function handleInputTimerAction() {
  const startBtn = document.getElementById("startInputTimerBtn");
  
  if (!inputTimerInterval) {
    // Start Timer
    inputTimerSeconds = 0;
    inputTimerStartTime = Date.now();
    activeTimerType = "input";
    
    // Configure and show Zone Overlay
    const titleField = document.getElementById("inputTitle");
    const focusTitle = titleField.value.trim() || "未命名沉浸影片/素材";
    
    const zoneOverlay = document.getElementById("zoneOverlay");
    zoneOverlay.classList.remove("output-mode");
    document.getElementById("zoneBadgeType").innerText = "輸入沉浸中";
    document.getElementById("zoneFocusTitle").innerText = focusTitle;
    
    updateInputTimerDisplay();
    
    zoneOverlay.classList.add("show");
    document.getElementById("zoneFloatingBadge").style.display = "none";
    
    startBtn.innerHTML = `<i class="fas fa-stop"></i> 結束沉浸`;
    startBtn.classList.add("active");
    
    // Hide previous alerts
    document.getElementById("inputTimerAlert").style.display = "none";

    inputTimerInterval = setInterval(() => {
      if (inputTimerStartTime) {
        inputTimerSeconds = Math.floor((Date.now() - inputTimerStartTime) / 1000);
      }
      updateInputTimerDisplay();
    }, 1000);
  } else {
    // Stop Timer
    clearInterval(inputTimerInterval);
    inputTimerInterval = null;
    
    // Hide overlay & badge
    document.getElementById("zoneOverlay").classList.remove("show");
    document.getElementById("zoneFloatingBadge").style.display = "none";
    activeTimerType = null;
    
    const mins = Math.max(1, Math.round(inputTimerSeconds / 60));
    
    // Form verification & auto submit
    const titleField = document.getElementById("inputTitle");
    let title = titleField.value.trim();
    let apply = false;

    if (!title) {
      title = prompt(`本次沉浸計時共 ${mins} 分鐘！\n\n請輸入您剛才觀看/聽讀的影片或素材標題，確認後將自動寫入學習日誌：`, "");
      if (title && title.trim()) {
        titleField.value = title.trim();
        apply = true;
      }
    } else {
      apply = confirm(`計時結束！本次沉浸共 ${mins} 分鐘。\n\n素材標題: "${title}"\n\n是否確認將此學習日誌寫入紀錄？`);
    }

    if (apply) {
      document.getElementById("inputDuration").value = mins;
      submitInputLog();
      alert(`成功記錄 ${mins} 分鐘的輸入沉浸練習！`);
      
      // Auto toggle back to manual UI for next entry
      showInputManualUI();
    } else {
      // Just populate time and show alert
      document.getElementById("inputDuration").value = mins;
      const alertEl = document.getElementById("inputTimerAlert");
      alertEl.style.display = "flex";
      alertEl.innerHTML = `<i class="fas fa-info-circle"></i> 本次累計計時 <strong>${mins}</strong> 分鐘。您可修改欄位後點擊下方按鈕以存檔。`;
      
      // Toggle back to manual to let them see duration field
      showInputManualUI();
    }
    
    resetInputTimer();
  }
}

function updateInputTimerDisplay() {
  const mins = Math.floor(inputTimerSeconds / 60).toString().padStart(2, '0');
  const secs = (inputTimerSeconds % 60).toString().padStart(2, '0');
  const timeStr = `${mins}:${secs}`;
  document.getElementById("inputTimerDisplay").innerText = timeStr;
  document.getElementById("zoneTimerDisplay").innerText = timeStr;
  document.getElementById("floatingBadgeTimer").innerText = timeStr;
}

function resetInputTimer() {
  if (inputTimerInterval) {
    clearInterval(inputTimerInterval);
    inputTimerInterval = null;
  }
  inputTimerSeconds = 0;
  inputTimerStartTime = null;
  updateInputTimerDisplay();
  const startBtn = document.getElementById("startInputTimerBtn");
  startBtn.innerHTML = `<i class="fas fa-play"></i> 開始沉浸`;
  startBtn.classList.remove("active");
}

function showInputManualUI() {
  document.getElementById("inputManualTimeBox").style.display = "block";
  document.getElementById("inputTimerBox").style.display = "none";
  document.getElementById("toggleInputTimerBtn").innerHTML = `<i class="fas fa-stopwatch"></i> 啟動計時器`;
  document.getElementById("inputDuration").setAttribute("required", "required");
}


// Output Timer Toggle
function toggleOutputTimerUI() {
  const manualBox = document.getElementById("outputManualTimeBox");
  const timerBox = document.getElementById("outputTimerBox");
  const btn = document.getElementById("toggleOutputTimerBtn");

  if (timerBox.style.display === "none") {
    // Switch to Timer Mode
    manualBox.style.display = "none";
    timerBox.style.display = "flex";
    btn.innerHTML = `<i class="fas fa-keyboard"></i> 手動輸入`;
    document.getElementById("outputDuration").removeAttribute("required");
  } else {
    // Switch to Manual Mode
    if (outputTimerInterval) {
      if (!confirm("計時器正在運作中，切換模式會中斷計時，確定嗎？")) return;
      resetOutputTimer();
    }
    manualBox.style.display = "block";
    timerBox.style.display = "none";
    btn.innerHTML = `<i class="fas fa-stopwatch"></i> 啟動計時器`;
    document.getElementById("outputDuration").setAttribute("required", "required");
  }
}

function handleOutputTimerAction() {
  const startBtn = document.getElementById("startOutputTimerBtn");
  
  if (!outputTimerInterval) {
    // Start Timer
    outputTimerSeconds = 0;
    outputTimerStartTime = Date.now();
    activeTimerType = "output";
    
    // Configure and show Zone Overlay
    const titleField = document.getElementById("outputTitle");
    const focusTitle = titleField.value.trim() || "未命名口說對練主題";
    
    const zoneOverlay = document.getElementById("zoneOverlay");
    zoneOverlay.classList.add("output-mode");
    document.getElementById("zoneBadgeType").innerText = "口說輸出中";
    document.getElementById("zoneFocusTitle").innerText = focusTitle;
    
    updateOutputTimerDisplay();
    
    zoneOverlay.classList.add("show");
    document.getElementById("zoneFloatingBadge").style.display = "none";
    
    startBtn.innerHTML = `<i class="fas fa-stop"></i> 結束沉浸`;
    startBtn.classList.add("active");
    
    document.getElementById("outputTimerAlert").style.display = "none";

    outputTimerInterval = setInterval(() => {
      if (outputTimerStartTime) {
        outputTimerSeconds = Math.floor((Date.now() - outputTimerStartTime) / 1000);
      }
      updateOutputTimerDisplay();
    }, 1000);
  } else {
    // Stop Timer
    clearInterval(outputTimerInterval);
    outputTimerInterval = null;
    
    // Hide overlay & badge
    document.getElementById("zoneOverlay").classList.remove("show");
    document.getElementById("zoneFloatingBadge").style.display = "none";
    activeTimerType = null;
    
    const mins = Math.max(1, Math.round(outputTimerSeconds / 60));
    
    const titleField = document.getElementById("outputTitle");
    let title = titleField.value.trim();
    let apply = false;

    if (!title) {
      title = prompt(`本次口說輸出共計 ${mins} 分鐘！\n\n請輸入您剛才討論的主題或練習內容，確認後將自動寫入日誌：`, "");
      if (title && title.trim()) {
        titleField.value = title.trim();
        apply = true;
      }
    } else {
      apply = confirm(`計時結束！本次輸出共 ${mins} 分鐘。\n\n討論主題: "${title}"\n\n是否確認將此學習日誌寫入紀錄？`);
    }

    if (apply) {
      document.getElementById("outputDuration").value = mins;
      submitOutputLog();
      alert(`成功記錄 ${mins} 分鐘的輸出練習！`);
      
      showOutputManualUI();
    } else {
      document.getElementById("outputDuration").value = mins;
      const alertEl = document.getElementById("outputTimerAlert");
      alertEl.style.display = "flex";
      alertEl.innerHTML = `<i class="fas fa-info-circle"></i> 本次累計口說計時 <strong>${mins}</strong> 分鐘。您可修改欄位後點擊下方按鈕以存檔。`;
      
      showOutputManualUI();
    }
    
    resetOutputTimer();
  }
}

function updateOutputTimerDisplay() {
  const mins = Math.floor(outputTimerSeconds / 60).toString().padStart(2, '0');
  const secs = (outputTimerSeconds % 60).toString().padStart(2, '0');
  const timeStr = `${mins}:${secs}`;
  document.getElementById("outputTimerDisplay").innerText = timeStr;
  document.getElementById("zoneTimerDisplay").innerText = timeStr;
  document.getElementById("floatingBadgeTimer").innerText = timeStr;
}

function resetOutputTimer() {
  if (outputTimerInterval) {
    clearInterval(outputTimerInterval);
    outputTimerInterval = null;
  }
  outputTimerSeconds = 0;
  outputTimerStartTime = null;
  updateOutputTimerDisplay();
  const startBtn = document.getElementById("startOutputTimerBtn");
  startBtn.innerHTML = `<i class="fas fa-play"></i> 開始沉浸`;
  startBtn.classList.remove("active");
}

function showOutputManualUI() {
  document.getElementById("outputManualTimeBox").style.display = "block";
  document.getElementById("outputTimerBox").style.display = "none";
  document.getElementById("toggleOutputTimerBtn").innerHTML = `<i class="fas fa-stopwatch"></i> 啟動計時器`;
  document.getElementById("outputDuration").setAttribute("required", "required");
}

/* ==========================================================================
   5. Interactive Heatmap Tooltip & History Modal
   ========================================================================== */

function showTooltip(e, text) {
  const tooltip = document.getElementById("heatmapTooltip");
  tooltip.innerHTML = text;
  tooltip.style.display = "block";
  moveTooltip(e);
}

function moveTooltip(e) {
  const tooltip = document.getElementById("heatmapTooltip");
  tooltip.style.left = (e.pageX + 10) + "px";
  tooltip.style.top = (e.pageY - 40) + "px";
}

function hideTooltip() {
  const tooltip = document.getElementById("heatmapTooltip");
  tooltip.style.display = "none";
}

function openHistoryModal(dateStr) {
  const modal = document.getElementById("dayHistoryModal");
  document.getElementById("historyModalDate").innerText = dateStr;
  
  // Find data for this specific day
  const dayLogs = logs.filter(l => l.date === dateStr);
  const dayVocabs = vocab.filter(v => v.date === dateStr);
  const dayCps = checkpoints.filter(c => c.date === dateStr);
  
  let html = "";
  
  if (dayLogs.length === 0 && dayVocabs.length === 0 && dayCps.length === 0) {
    html = `<div class="text-muted" style="text-align:center; padding: 20px;">當天無任何學習或里程碑紀錄。</div>`;
  } else {
    // Render Logs
    if (dayLogs.length > 0) {
      html += `<h5 style="margin-top:0; margin-bottom:10px; font-weight:600; color:var(--accent-cyan); border-color:var(--accent-cyan);"><i class="fas fa-book-open"></i> 學習紀錄</h5>`;
      html += `<div style="display:flex; flex-direction:column; gap:10px; margin-bottom:20px;">`;
      dayLogs.forEach(log => {
        const isInput = log.type === "input";
        const icon = isInput ? `<i class="fas fa-sign-in-alt text-cyan"></i>` : `<i class="fas fa-sign-out-alt text-emerald"></i>`;
        const typeLabel = isInput ? `輸入 (${log.source})` : `輸出 (${log.outputType})`;
        const passiveLabel = isInput && log.passive ? ` <span class="badge" style="background:#edf2f7; color:#4a5568; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:5px;">被動聽讀</span>` : "";
        
        let detailHtml = "";
        if (!isInput && log.rating) {
          detailHtml += `<span style="color:#eab308; margin-left:10px;">${"★".repeat(log.rating)}${"☆".repeat(5-log.rating)}</span>`;
        }
        
        html += `
          <div style="background:#f8fafc; border:1px solid var(--border-color); border-radius:8px; padding:10px; font-size:13px; color:var(--text-primary);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <strong>${icon} ${typeLabel}${passiveLabel}</strong>
              <span class="text-muted" style="font-size:11px;">${log.duration} 分鐘</span>
            </div>
            <div style="color:var(--text-secondary);">${log.title}${detailHtml}</div>
          </div>
        `;
      });
      html += `</div>`;
    }
    
    // Render Vocab
    if (dayVocabs.length > 0) {
      html += `<h5 style="margin-bottom:10px; font-weight:600; color:var(--accent-emerald); border-color:var(--accent-emerald);"><i class="fas fa-brain"></i> 新增生字</h5>`;
      html += `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:20px;">`;
      dayVocabs.forEach(v => {
        html += `
          <div style="background:var(--accent-emerald-glow); border:1px solid rgba(44,62,80,0.15); border-radius:20px; padding:4px 12px; font-size:12px; display:inline-flex; align-items:center; gap:6px; color:var(--text-primary);">
            <strong>${v.word}</strong>: <span style="font-size:11px; color:var(--text-secondary);">${v.definition || '未填寫定義'}</span>
          </div>
        `;
      });
      html += `</div>`;
    }
    
    // Render Checkpoints
    if (dayCps.length > 0) {
      html += `<h5 style="margin-bottom:10px; font-weight:600; color:var(--accent-blue); border-color:var(--accent-blue);"><i class="fas fa-flag"></i> 里程碑紀錄</h5>`;
      html += `<div style="display:flex; flex-direction:column; gap:10px;">`;
      dayCps.forEach(cp => {
        html += `
          <div style="background:#eff6ff; border:1px solid rgba(59,130,246,0.15); border-radius:8px; padding:10px; font-size:13px; color:var(--text-primary);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <strong><i class="fas fa-trophy text-orange"></i> 測驗/自評成績: ${cp.score} 分</strong>
              <span class="text-muted" style="font-size:11px;">累計 ${cp.hours} 小時</span>
            </div>
            <div style="color:var(--text-secondary); font-style:italic;">"${cp.notes || '無備註'}"</div>
          </div>
        `;
      });
      html += `</div>`;
    }
  }
  
  document.getElementById("historyModalContent").innerHTML = html;
  modal.classList.add("show");
}

function closeHistoryModal() {
  document.getElementById("dayHistoryModal").classList.remove("show");
}

function handleVisibilityChange() {
  if (document.visibilityState === "visible") {
    if (activeTimerType === "input" && inputTimerStartTime) {
      inputTimerSeconds = Math.floor((Date.now() - inputTimerStartTime) / 1000);
      updateInputTimerDisplay();
    } else if (activeTimerType === "output" && outputTimerStartTime) {
      outputTimerSeconds = Math.floor((Date.now() - outputTimerStartTime) / 1000);
      updateOutputTimerDisplay();
    }
  }
}
