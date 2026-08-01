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
let inputTimerIsPaused = false;
let outputTimerInterval = null;
let outputTimerSeconds = 0;
let outputTimerStartTime = null;
let outputTimerIsPaused = false;
let activeTimerType = null; // 'input' or 'output' or null

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem(SESSION_KEY);
  if (token) {
    // 已登入 (不自動同步)
    document.getElementById("loginOverlay").classList.add("hidden");
    document.getElementById("logoutBtn").style.display = "block";
    initApp(false);
  } else {
    // 未登入
    setupLoginListeners();
  }
});

function initApp(isFirstLogin = false) {
  loadData();
  setupEventListeners();
  renderAll();
  
  // 首次登入時才執行自動同步，後續依賴行為驅動
  if (isFirstLogin) {
    syncWithGoogleSheets();
  }
}

/* ==========================================================================
   Toast Notification System
   ========================================================================== */
function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  let iconClass = "fas fa-info-circle";
  if (type === "success") iconClass = "fas fa-check-circle";
  if (type === "error") iconClass = "fas fa-exclamation-circle";

  toast.innerHTML = `
    <i class="${iconClass} toast-icon"></i>
    <div class="toast-content">${message}</div>
    <button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
  `;

  container.appendChild(toast);

  // Trigger animation
  setTimeout(() => toast.classList.add("show"), 10);

  // Auto remove after 3s
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
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
        
        // 隱藏登入畫面並啟動系統 (傳入 true 觸發首次同步)
        document.getElementById("loginOverlay").classList.add("hidden");
        document.getElementById("logoutBtn").style.display = "block";
        initApp(true);
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



  // Exporters
  document.getElementById("exportAnkiBtn").addEventListener("click", exportAnkiCSV);

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
  document.getElementById("pauseInputTimerBtn").addEventListener("click", handlePauseTimerAction);
  document.getElementById("toggleOutputTimerBtn").addEventListener("click", toggleOutputTimerUI);
  document.getElementById("startOutputTimerBtn").addEventListener("click", handleOutputTimerAction);
  document.getElementById("pauseOutputTimerBtn").addEventListener("click", handlePauseTimerAction);

  // Zone Mode Controls
  document.getElementById("zonePauseBtn").addEventListener("click", handlePauseTimerAction);
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
  // 1. Total Hours (Apply 0.33x multiplier for passive fatigue backup)
  let totalMinutes = 0;
  logs.forEach(l => {
    if (l.passive) {
      totalMinutes += Number(l.duration) * 0.33;
    } else {
      totalMinutes += Number(l.duration);
    }
  });
  const totalHrs = (totalMinutes / 60).toFixed(1);
  document.getElementById("totalHours").innerText = totalHrs;

  // Daily Goal Progress
  renderDailyGoal();

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

// Calculate and render Daily Goal progress
function renderDailyGoal() {
  const todayStr = getLocalDateString(new Date());
  const todayLogs = logs.filter(l => l.date === todayStr);
  const todayMins = todayLogs.reduce((sum, l) => sum + Number(l.duration), 0);
  const todayHrs = (todayMins / 60).toFixed(1);
  
  const dailyHoursEl = document.getElementById("dailyHoursLogged");
  const progressBar = document.getElementById("dailyProgressBar");
  const pctText = document.getElementById("dailyGoalPctText");
  
  if (!dailyHoursEl) return;
  
  dailyHoursEl.innerText = todayHrs;
  
  // Max cap the progress bar at 100% (2 hours = 120 mins)
  const progressPct = Math.min(100, Math.round((todayMins / 120) * 100));
  progressBar.style.width = `${progressPct}%`;
  
  if (todayMins >= 120) {
    pctText.innerHTML = `<span style="color: var(--accent-emerald); font-weight: bold;"><i class="fas fa-star"></i> 完美達標！今日學習 ${todayHrs} 小時</span>`;
    progressBar.style.background = "linear-gradient(90deg, #10b981, #34d399)";
  } else if (todayMins >= 60) {
    pctText.innerHTML = `<span style="color: var(--accent-emerald); font-weight: bold;"><i class="fas fa-check-circle"></i> 已達低標！距離完美還差 ${(120 - todayMins)} 分鐘</span>`;
    progressBar.style.background = "var(--accent-emerald)";
  } else {
    pctText.innerHTML = `距離最低標準 1 小時還差 ${60 - todayMins} 分鐘`;
    progressBar.style.background = "var(--accent-cyan)";
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

  // Always render exactly the last 364 days (~1 year, 52 weeks)
  const endDate = new Date();
  let startDate = new Date();
  startDate.setDate(endDate.getDate() - 364);

  // Calculate day-of-week offset for row align
  const startDay = isNaN(startDate.getDay()) ? 0 : startDate.getDay(); // 0 is Sunday, 1 is Monday...
  
  // Add empty placeholders for grid alignment so columns represent weeks (Sun-Sat)
  for (let i = 0; i < startDay; i++) {
    const placeholder = document.createElement("div");
    placeholder.className = "heatmap-cell level-0";
    placeholder.style.visibility = "hidden";
    grid.appendChild(placeholder);
  }

  // Map logs by date for efficient lookup
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

  // Calculate total days to render
  const timeDiff = endDate.getTime() - startDate.getTime();
  const totalDays = Math.max(0, Math.floor(timeDiff / (1000 * 3600 * 24)));

  // Render cells from startDate to endDate
  const tempDate = new Date(startDate);
  for (let d = 0; d <= totalDays; d++) {
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
      <div class="history-item-details" style="cursor: pointer;" onclick="openHistoryModal('${log.date}')">
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
    tbody.innerHTML = `<tr><td colspan="4" class="text-muted" style="text-align:center; padding: 20px;">尚無檢核點</td></tr>`;
    return;
  }

  // Sort by date descending
  const sortedCheckpoints = [...checkpoints].sort((a, b) => new Date(b.date) - new Date(a.date));

  sortedCheckpoints.forEach((item, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.date}</td>
      <td>${item.hours} h</td>
      <td>${item.score}</td>
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
  const durationStr = document.getElementById("inputDuration").value;
  const duration = timeToMins(durationStr);
  const title = document.getElementById("inputTitle").value.trim();
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

  logs.push(newLog);

  // 處理本次生字
  if (confirmedPendingVocabs && confirmedPendingVocabs.length > 0) {
      let addedVocabCount = 0;
      confirmedPendingVocabs.forEach(item => {
          const newVocab = {
              id: "v-" + Date.now() + Math.floor(Math.random() * 1000) + addedVocabCount,
              date: dateStr,
              word: item.word,
              definition: item.definition,
              sentence: item.sentence,
              source: title, // 自動設定為本次學習的素材主題
              synced: false
          };
          vocab.push(newVocab);
          addedVocabCount++;
      });
      
      showToast(`已隨紀錄新增 ${addedVocabCount} 個生字！`, "success");
      
      // 清空暫存
      confirmedPendingVocabs = [];
      renderPendingVocabChips();
  }

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
  const durationStr = document.getElementById("outputDuration").value;
  const duration = timeToMins(durationStr);
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
  // Auto-sync on delete
  syncWithGoogleSheets();
};

window.deleteVocab = function(index) {
  vocab.splice(index, 1);
  saveData();
  renderAll();
};



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
  // Auto-sync on delete
  syncWithGoogleSheets();
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

  const syncBtn = document.getElementById("syncNowBtn");
  const originalBtnHtml = syncBtn ? syncBtn.innerHTML : "";

  try {
    if (syncBtn) {
      syncBtn.disabled = true;
      syncBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 同步中...`;
    }

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
      showToast("授權已過期或密碼錯誤，請重新登入！", "error");
      localStorage.removeItem(SESSION_KEY);
      setTimeout(() => location.reload(), 1500);
      return;
    }
    
    if (!res.ok) throw new Error(`HTTP ${res.status} 錯誤。伺服器或代理端回傳異常。`);
    
    const responseJson = await res.json();
    if (responseJson.status === "success") {
      showToast("雲端同步成功！", "success");
      
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
      
      showToast("同步成功！資料已與 Google 試算表完成雙向安全同步。", "success");
    } else {
      throw new Error(responseJson.message || "未知伺服器錯誤");
    }
  } catch (error) {
    console.error("Sync Error:", error);
    syncStatus.innerHTML = `<i class="fas fa-exclamation-triangle text-orange"></i> 同步失敗`;
    showToast(`雲端同步失敗！錯誤原因：${error.message}`, "error");
  } finally {
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.innerHTML = originalBtnHtml;
    }
  }
}

function updateSyncStatusText() {
  // Sync status is now handled purely by toast notifications.
  return;
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
    inputTimerIsPaused = false;
    activeTimerType = "input";
    document.getElementById("pauseInputTimerBtn").style.display = "block";
    document.getElementById("pauseInputTimerBtn").innerHTML = `<i class="fas fa-pause"></i> 暫停`;
    
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
    document.getElementById("pauseInputTimerBtn").style.display = "none";
    
    // Hide overlay & badge
    document.getElementById("zoneOverlay").classList.remove("show");
    document.getElementById("zoneFloatingBadge").style.display = "none";
    activeTimerType = null;
    
    const mins = Math.max(1, Math.round(inputTimerSeconds / 60));
    
    // Update form duration and show manual UI
    document.getElementById("inputDuration").value = minsToTime(mins);
    showInputManualUI();
    
    // Calculate live goal progression
    const todayStr = getLocalDateString(new Date());
    const todayLogs = logs.filter(l => l.date === todayStr);
    const todayMins = todayLogs.reduce((sum, l) => sum + l.duration, 0);
    const totalMins = todayMins + mins;
    
    let alertHtml = `<i class="fas fa-info-circle"></i> 本次計時 <strong>${mins}</strong> 分鐘。請填寫完下方資訊後手動新增紀錄。`;
    if (totalMins >= 120) {
      alertHtml += ` <span style="color:var(--accent-emerald);font-weight:bold;margin-left:10px;">🌟 恭喜！加上本次，已達標 2 小時完美目標！</span>`;
    } else if (totalMins >= 60) {
      alertHtml += ` <span style="color:var(--accent-emerald);font-weight:bold;margin-left:10px;">🎉 恭喜！加上本次，已達標 1 小時最低標準！</span>`;
    } else {
      alertHtml += ` <span style="margin-left:10px;">(今日預估累計 ${totalMins} 分鐘，距離 1 小時還差 ${60 - totalMins} 分鐘)</span>`;
    }
    
    const alertEl = document.getElementById("inputTimerAlert");
    alertEl.style.display = "flex";
    alertEl.innerHTML = alertHtml;
    
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
  inputTimerIsPaused = false;
  document.getElementById("pauseInputTimerBtn").style.display = "none";
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
    outputTimerIsPaused = false;
    activeTimerType = "output";
    document.getElementById("pauseOutputTimerBtn").style.display = "block";
    document.getElementById("pauseOutputTimerBtn").innerHTML = `<i class="fas fa-pause"></i> 暫停`;
    
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
    document.getElementById("pauseOutputTimerBtn").style.display = "none";
    
    // Hide overlay & badge
    document.getElementById("zoneOverlay").classList.remove("show");
    document.getElementById("zoneFloatingBadge").style.display = "none";
    activeTimerType = null;
    
    const mins = Math.max(1, Math.round(outputTimerSeconds / 60));
    
    // Update form duration and show manual UI
    document.getElementById("outputDuration").value = minsToTime(mins);
    showOutputManualUI();
    
    // Calculate live goal progression
    const todayStr = getLocalDateString(new Date());
    const todayLogs = logs.filter(l => l.date === todayStr);
    const todayMins = todayLogs.reduce((sum, l) => sum + l.duration, 0);
    const totalMins = todayMins + mins;
    
    let alertHtml = `<i class="fas fa-info-circle"></i> 本次口說計時 <strong>${mins}</strong> 分鐘。請填寫完下方資訊後手動新增紀錄。`;
    if (totalMins >= 120) {
      alertHtml += ` <span style="color:var(--accent-emerald);font-weight:bold;margin-left:10px;">🌟 恭喜！加上本次，已達標 2 小時完美目標！</span>`;
    } else if (totalMins >= 60) {
      alertHtml += ` <span style="color:var(--accent-emerald);font-weight:bold;margin-left:10px;">🎉 恭喜！加上本次，已達標 1 小時最低標準！</span>`;
    } else {
      alertHtml += ` <span style="margin-left:10px;">(今日預估累計 ${totalMins} 分鐘，距離 1 小時還差 ${60 - totalMins} 分鐘)</span>`;
    }
    
    const alertEl = document.getElementById("outputTimerAlert");
    alertEl.style.display = "flex";
    alertEl.innerHTML = alertHtml;
    
    resetOutputTimer();
  }
}

function handlePauseTimerAction() {
  if (activeTimerType === "input") {
    if (inputTimerIsPaused) {
      // Resume
      inputTimerStartTime = Date.now() - (inputTimerSeconds * 1000);
      inputTimerIsPaused = false;
      inputTimerInterval = setInterval(() => {
        inputTimerSeconds = Math.floor((Date.now() - inputTimerStartTime) / 1000);
        updateInputTimerDisplay();
      }, 1000);
      
      document.getElementById("pauseInputTimerBtn").innerHTML = `<i class="fas fa-pause"></i> 暫停`;
      document.getElementById("zonePauseBtn").innerHTML = `<i class="fas fa-pause"></i> 暫停`;
      document.getElementById("zoneBadgeType").innerText = "輸入沉浸中";
    } else {
      // Pause
      clearInterval(inputTimerInterval);
      inputTimerIsPaused = true;
      document.getElementById("pauseInputTimerBtn").innerHTML = `<i class="fas fa-play"></i> 繼續`;
      document.getElementById("zonePauseBtn").innerHTML = `<i class="fas fa-play"></i> 繼續`;
      document.getElementById("zoneBadgeType").innerText = "暫停中";
    }
  } else if (activeTimerType === "output") {
    if (outputTimerIsPaused) {
      // Resume
      outputTimerStartTime = Date.now() - (outputTimerSeconds * 1000);
      outputTimerIsPaused = false;
      outputTimerInterval = setInterval(() => {
        outputTimerSeconds = Math.floor((Date.now() - outputTimerStartTime) / 1000);
        updateOutputTimerDisplay();
      }, 1000);
      
      document.getElementById("pauseOutputTimerBtn").innerHTML = `<i class="fas fa-pause"></i> 暫停`;
      document.getElementById("zonePauseBtn").innerHTML = `<i class="fas fa-pause"></i> 暫停`;
      document.getElementById("zoneBadgeType").innerText = "口說輸出中";
    } else {
      // Pause
      clearInterval(outputTimerInterval);
      outputTimerIsPaused = true;
      document.getElementById("pauseOutputTimerBtn").innerHTML = `<i class="fas fa-play"></i> 繼續`;
      document.getElementById("zonePauseBtn").innerHTML = `<i class="fas fa-play"></i> 繼續`;
      document.getElementById("zoneBadgeType").innerText = "暫停中";
    }
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
  outputTimerIsPaused = false;
  document.getElementById("pauseOutputTimerBtn").style.display = "none";
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

/* ==========================================================================
   AI Vocab Extraction & Review Modal
   ========================================================================== */
let pendingAiVocabList = [];
let confirmedPendingVocabs = [];

document.getElementById("aiExtractVocabBtn").addEventListener("click", async () => {
  const textInput = document.getElementById("aiVocabInputText");
  const text = textInput.value.trim();
  const btn = document.getElementById("aiExtractVocabBtn");

  if (!text) {
    showToast("請先貼上英文文章、對話或字幕！", "error");
    return;
  }

  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> AI 萃取中...`;

  try {
    const token = localStorage.getItem(SESSION_KEY);
    const res = await fetch("/api/extract-vocab", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Sync-Token": token || ""
      },
      body: JSON.stringify({ text })
    });

    if (res.status === 401) {
      showToast("登入已過期，請重新登入", "error");
      localStorage.removeItem(SESSION_KEY);
      setTimeout(() => location.reload(), 1500);
      return;
    }

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "未知錯誤");
    }

    const data = await res.json();
    if (data.status === "success" && data.vocab && data.vocab.length > 0) {
      pendingAiVocabList = data.vocab;
      renderVocabReviewModal(pendingAiVocabList);
      document.getElementById("vocabReviewModal").classList.add("show");
    } else {
      showToast("AI 無法萃取出任何單字，請嘗試提供更多上下文。", "info");
    }
  } catch (err) {
    showToast("AI 萃取失敗：" + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
});

function renderVocabReviewModal(vocabItems) {
  const listContainer = document.getElementById("vocabReviewList");
  listContainer.innerHTML = "";

  vocabItems.forEach((item, index) => {
    const defaultDef = `${item.pos || ''} ${item.chinese || ''}`.trim();
    const sentence = item.sentence || "";
    
    const div = document.createElement("div");
    div.className = "vocab-review-item";
    div.style.flexDirection = "column";
    div.style.alignItems = "flex-start";
    div.style.gap = "10px";
    div.innerHTML = `
      <div style="display:flex; width: 100%; align-items:center; gap: 10px;">
        <input type="checkbox" id="review_check_${index}" checked>
        <label for="review_check_${index}" style="min-width: 120px; font-weight: bold; margin-bottom: 0; color:var(--text-primary); font-size:16px;">${item.word}</label>
        <input type="text" id="review_def_${index}" value="${defaultDef}" style="flex:1;">
      </div>
      ${sentence ? `<div style="display:flex; width: 100%; align-items:center; gap: 10px; margin-top: 5px;">
          <span style="font-size: 13px; color: var(--text-secondary); white-space: nowrap;">例句:</span>
          <input type="text" id="review_sent_${index}" value="${sentence}" style="flex:1; font-size: 13px; padding: 4px 8px; border: 1px solid var(--border-color); border-radius: 4px;">
      </div>` : ''}
    `;
    listContainer.appendChild(div);
  });
}

document.getElementById("confirmVocabBtn").addEventListener("click", () => {
  let addedCount = 0;
  pendingAiVocabList.forEach((item, index) => {
    const checkbox = document.getElementById(`review_check_${index}`);
    if (checkbox && checkbox.checked) {
      const word = item.word;
      const def = document.getElementById(`review_def_${index}`).value.trim();
      const sentInput = document.getElementById(`review_sent_${index}`);
      const sentence = sentInput ? sentInput.value.trim() : (item.sentence || "");
      
      confirmedPendingVocabs.push({
        word: word,
        definition: def,
        sentence: sentence
      });
      addedCount++;
    }
  });

  if (addedCount > 0) {
    showToast(`已保留 ${addedCount} 個單字，將隨紀錄一起存入！`, "success");
    document.getElementById("aiVocabInputText").value = "";
    renderPendingVocabChips();
  }
  
  closeVocabReviewModal();
});

window.closeVocabReviewModal = function() {
  document.getElementById("vocabReviewModal").classList.remove("show");
};

function renderPendingVocabChips() {
  const container = document.getElementById("pendingVocabContainer");
  const chipsDiv = document.getElementById("pendingVocabChips");
  
  if (confirmedPendingVocabs.length === 0) {
    container.style.display = "none";
    chipsDiv.innerHTML = "";
    return;
  }
  
  container.style.display = "block";
  chipsDiv.innerHTML = "";
  
  confirmedPendingVocabs.forEach((item, index) => {
    const chip = document.createElement("span");
    chip.className = "vocab-chip";
    chip.style.background = "var(--accent-emerald-glow)";
    chip.style.borderColor = "var(--accent-emerald)";
    chip.title = item.definition;
    chip.innerHTML = `
      <strong>${item.word}</strong>
      <span class="vocab-chip-remove" onclick="removePendingVocab(${index})" style="color:var(--text-secondary);">&times;</span>
    `;
    chipsDiv.appendChild(chip);
  });
}

window.removePendingVocab = function(index) {
  confirmedPendingVocabs.splice(index, 1);
  renderPendingVocabChips();
};

// ==========================================
// Utils
// ==========================================
function timeToMins(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  if (parts.length !== 2) return 0;
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return (h * 60) + m;
}

function minsToTime(totalMins) {
  if (isNaN(totalMins) || totalMins < 0) return "00:00";
  const h = Math.floor(totalMins / 60).toString().padStart(2, '0');
  const m = (totalMins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}
