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
let activeTimerType = null; // 'input' or 'output' or null

class CustomDialog {
  static show({ title, message, inputs = [], confirmText = '確定', cancelText = '取消', onConfirm }) {
    const modal = document.getElementById('customDialogModal');
    document.getElementById('customDialogTitle').innerHTML = title;
    
    const msgEl = document.getElementById('customDialogMessage');
    if (message) {
      msgEl.innerText = message;
      msgEl.style.display = 'block';
    } else {
      msgEl.style.display = 'none';
    }
    
    const inputsContainer = document.getElementById('customDialogInputs');
    inputsContainer.innerHTML = '';
    const inputElements = [];
    
    inputs.forEach(inp => {
      const wrapper = document.createElement('div');
      wrapper.style.marginBottom = '10px';
      
      const label = document.createElement('label');
      label.innerText = inp.label;
      label.className = 'form-label';
      wrapper.appendChild(label);
      
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-control-custom';
      input.placeholder = inp.placeholder || '';
      input.value = inp.value || '';
      wrapper.appendChild(input);
      inputElements.push(input);
      inputsContainer.appendChild(wrapper);
    });
    
    const confirmBtn = document.getElementById('customDialogConfirmBtn');
    const cancelBtn = document.getElementById('customDialogCancelBtn');
    confirmBtn.innerText = confirmText;
    cancelBtn.innerText = cancelText;
    
    const cleanup = () => {
      modal.classList.remove('show');
      confirmBtn.onclick = null;
      cancelBtn.onclick = null;
    };
    
    confirmBtn.onclick = () => {
      const values = inputElements.map(el => el.value);
      cleanup();
      if (onConfirm) onConfirm(values);
    };
    
    cancelBtn.onclick = () => {
      cleanup();
    };
    
    modal.classList.add('show');
    if (inputElements.length > 0) {
      setTimeout(() => inputElements[0].focus(), 100);
    }
  }

  static confirm(title, message, callback) {
    this.show({
      title: `<i class="fas fa-exclamation-triangle text-orange"></i> ${title}`,
      message,
      confirmText: '確認',
      onConfirm: () => callback(true)
    });
  }
}

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

class AppStore {
  static get logs() { return logs; }
  static set logs(val) { logs = val; this.save(); }
  
  static get vocab() { return vocab; }
  static set vocab(val) { vocab = val; this.save(); }
  
  static get checkpoints() { return checkpoints; }
  static set checkpoints(val) { checkpoints = val; this.save(); }

  static load() {
    try {
      logs = JSON.parse(localStorage.getItem(LOGS_KEY)) || [];
    } catch (e) {
      console.warn("Failed to parse logs from localStorage, resetting to empty array.");
      logs = [];
    }
    try {
      vocab = JSON.parse(localStorage.getItem(VOCAB_KEY)) || [];
    } catch (e) {
      console.warn("Failed to parse vocab from localStorage, resetting to empty array.");
      vocab = [];
    }
    try {
      checkpoints = JSON.parse(localStorage.getItem(CHECKPOINTS_KEY)) || [];
    } catch (e) {
      console.warn("Failed to parse checkpoints from localStorage, resetting to empty array.");
      checkpoints = [];
    }
  }

  static save() {
    try {
      localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
      localStorage.setItem(VOCAB_KEY, JSON.stringify(vocab));
      localStorage.setItem(CHECKPOINTS_KEY, JSON.stringify(checkpoints));
    } catch (e) {
      console.error("Local storage quota exceeded or unavailable.", e);
      showToast("儲存失敗：本機空間不足或瀏覽器設定阻擋", "error");
    }
  }
}

// Helper aliases to maintain compatibility with existing codebase
function loadData() { AppStore.load(); }
function saveData() { AppStore.save(); }

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
  document.getElementById("toggleInputTimerBtn").addEventListener("click", () => TimerManager.toggleUI("input"));
  document.getElementById("startInputTimerBtn").addEventListener("click", () => TimerManager.handleAction("input"));
  document.getElementById("pauseInputTimerBtn").addEventListener("click", () => TimerManager.handlePause());
  document.getElementById("toggleOutputTimerBtn").addEventListener("click", () => TimerManager.toggleUI("output"));
  document.getElementById("startOutputTimerBtn").addEventListener("click", () => TimerManager.handleAction("output"));
  document.getElementById("pauseOutputTimerBtn").addEventListener("click", () => TimerManager.handlePause());

  // Zone Mode Controls
  document.getElementById("zonePauseBtn").addEventListener("click", () => TimerManager.handlePause());
  document.getElementById("zoneStopBtn").addEventListener("click", () => {
    if (activeTimerType) TimerManager.handleAction(activeTimerType);
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
  const customDateInput = document.getElementById("customLogDate");
  const dateStr = (customDateInput && customDateInput.style.display !== "none" && customDateInput.value) 
    ? customDateInput.value 
    : getLocalDateString(new Date());

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
  renderStats();
  renderHistory();
  renderHeatmap();

  // Reset Form
  document.getElementById("inputLogForm").reset();
  
  // Clear Drafts
  const inputFields = ["inputSource", "inputDuration", "inputTitle", "inputPassive", "aiVocabInputText"];
  inputFields.forEach(id => localStorage.removeItem('draft_' + id));
  
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
  const customDateInput = document.getElementById("customLogDate");
  const dateStr = (customDateInput && customDateInput.style.display !== "none" && customDateInput.value) 
    ? customDateInput.value 
    : getLocalDateString(new Date());

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
  renderStats();
  renderHistory();
  renderHeatmap();

  // Reset Form
  document.getElementById("outputLogForm").reset();

  // Clear Drafts
  const outputFields = ["outputType", "outputDuration", "outputTitle"];
  outputFields.forEach(id => localStorage.removeItem('draft_' + id));

  // Hide timer alert
  const alertEl = document.getElementById("outputTimerAlert");
  if (alertEl) alertEl.style.display = "none";

  // Auto-sync
  syncWithGoogleSheets();
}

window.deleteLog = function(id) {
  CustomDialog.confirm("刪除紀錄", "確定要刪除此筆學習紀錄嗎？", (confirmed) => {
    if (confirmed) {
      logs = logs.filter(l => l.id !== id);
      saveData();
      renderStats();
      renderHistory();
      renderHeatmap();
      syncWithGoogleSheets();
    }
  });
};

window.deleteVocab = function(index) {
  vocab.splice(index, 1);
  saveData();
  renderVocab();
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
  renderCheckpoints();
  
  closeCheckpointModal();
  document.getElementById("checkpointForm").reset();

  // Auto-sync
  syncWithGoogleSheets();
}

window.deleteCheckpoint = function(id) {
  CustomDialog.confirm("刪除檢核點", "確定要刪除此筆里程碑檢核紀錄嗎？", (confirmed) => {
    if (confirmed) {
      checkpoints = checkpoints.filter(c => c.id !== id);
      saveData();
      renderAll();
      syncWithGoogleSheets();
    }
  });
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
    CustomDialog.confirm("警告", "匯入備份將會覆蓋您目前的本地資料，確定要繼續嗎？", (confirmed) => {
      if (confirmed) {
        try {
          const backupData = JSON.parse(evt.target.result);
          if (backupData && backupData.logs) {
            logs = backupData.logs;
            vocab = backupData.vocab || [];
            checkpoints = backupData.checkpoints || [];
            saveData();
            renderStats();
            renderHistory();
            renderHeatmap();
            renderVocab();
            renderCheckpoints();
            showToast("資料備份匯入成功！", "success");
            syncWithGoogleSheets();
          } else {
            CustomDialog.show({ title: "錯誤", message: "格式錯誤：此檔案不包含合法的學習紀錄備份資料。" });
          }
        } catch (err) {
          CustomDialog.show({ title: "錯誤", message: "讀取檔案失敗：" + err.message });
        }
      }
    });
  };
  reader.readAsText(file);
  // Reset input value to allow triggering change on same file
  e.target.value = "";
}

function clearAllLogs() {
  CustomDialog.confirm("警告", "⚠️ 警告：這將徹底清除您本機上的所有學習紀錄與單字庫！確定要全部刪除嗎？", (confirmed) => {
    if (confirmed) {
      logs = [];
      vocab = [];
      checkpoints = [];
      saveData();
      renderStats();
      renderHistory();
      renderHeatmap();
      renderVocab();
      renderCheckpoints();
      showToast("已清空所有紀錄", "success");
      syncWithGoogleSheets();
    }
  });
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
      renderStats();
      renderHeatmap();
      renderHistory();
      renderVocab();
      renderFullVocabList();
      renderCheckpoints();
      
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

class TimerManager {
  static getTimerState(type) {
    if (!this.state) this.state = { input: { seconds: 0, interval: null, startTime: null, isPaused: false }, output: { seconds: 0, interval: null, startTime: null, isPaused: false } };
    return this.state[type];
  }

  static toggleUI(type) {
    const manualBox = document.getElementById(`${type}ManualTimeBox`);
    const timerBox = document.getElementById(`${type}TimerBox`);
    const btn = document.getElementById(`toggle${type === 'input' ? 'Input' : 'Output'}TimerBtn`);
    const durationInput = document.getElementById(`${type}Duration`);
    const state = this.getTimerState(type);

    if (timerBox.style.display === "none") {
      manualBox.style.display = "none";
      timerBox.style.display = "flex";
      btn.innerHTML = `<i class="fas fa-keyboard"></i> 手動輸入`;
      durationInput.removeAttribute("required");
    } else {
      if (state.interval) {
        CustomDialog.confirm("警告", "計時器正在運作中，切換模式會中斷計時，確定嗎？", (confirmed) => {
          if (confirmed) {
            this.reset(type);
            this.showManualUI(type);
          }
        });
        return;
      }
      this.showManualUI(type);
    }
  }

  static showManualUI(type) {
    const manualBox = document.getElementById(`${type}ManualTimeBox`);
    const timerBox = document.getElementById(`${type}TimerBox`);
    const btn = document.getElementById(`toggle${type === 'input' ? 'Input' : 'Output'}TimerBtn`);
    const durationInput = document.getElementById(`${type}Duration`);
    manualBox.style.display = "block";
    timerBox.style.display = "none";
    btn.innerHTML = `<i class="fas fa-stopwatch"></i> 啟動計時器`;
    durationInput.setAttribute("required", "required");
  }

  static handleAction(type) {
    const capType = type === 'input' ? 'Input' : 'Output';
    const startBtn = document.getElementById(`start${capType}TimerBtn`);
    const state = this.getTimerState(type);
    
    if (!state.interval) {
      // Start Timer
      state.seconds = 0;
      state.startTime = Date.now();
      state.isPaused = false;
      activeTimerType = type;
      
      const pauseBtn = document.getElementById(`pause${capType}TimerBtn`);
      pauseBtn.style.display = "block";
      pauseBtn.innerHTML = `<i class="fas fa-pause"></i> 暫停`;
      
      const titleField = document.getElementById(`${type}Title`);
      const focusTitle = titleField.value.trim() || (type === 'input' ? "未命名沉浸影片/素材" : "未命名口說對練主題");
      
      const zoneOverlay = document.getElementById("zoneOverlay");
      if (type === 'output') zoneOverlay.classList.add("output-mode");
      else zoneOverlay.classList.remove("output-mode");
      
      document.getElementById("zoneBadgeType").innerText = type === 'input' ? "輸入沉浸中" : "口說輸出中";
      document.getElementById("zoneFocusTitle").innerText = focusTitle;
      
      this.updateDisplay(type);
      
      zoneOverlay.classList.add("show");
      document.getElementById("zoneFloatingBadge").style.display = "none";
      
      startBtn.innerHTML = `<i class="fas fa-stop"></i> 結束沉浸`;
      startBtn.classList.add("active");
      
      document.getElementById(`${type}TimerAlert`).style.display = "none";

      state.interval = setInterval(() => {
        if (state.startTime) {
          state.seconds = Math.floor((Date.now() - state.startTime) / 1000);
        }
        this.updateDisplay(type);
      }, 1000);
    } else {
      // Stop Timer
      clearInterval(state.interval);
      state.interval = null;
      document.getElementById(`pause${capType}TimerBtn`).style.display = "none";
      
      document.getElementById("zoneOverlay").classList.remove("show");
      document.getElementById("zoneFloatingBadge").style.display = "none";
      activeTimerType = null;
      
      const mins = Math.max(1, Math.round(state.seconds / 60));
      document.getElementById(`${type}Duration`).value = minsToTime(mins);
      this.showManualUI(type);
      
      const todayStr = getLocalDateString(new Date());
      const todayLogs = logs.filter(l => l.date === todayStr); // 計算當日所有目標時長
      const todayMins = todayLogs.reduce((sum, l) => sum + l.duration, 0);
      const totalMins = todayMins + mins;
      
      let alertHtml = `<i class="fas fa-info-circle"></i> 本次${type === 'input'?'':'口說'}計時 <strong>${mins}</strong> 分鐘。請填寫完下方資訊後手動新增紀錄。`;
      if (totalMins >= 120) {
        alertHtml += ` <span style="color:var(--accent-emerald);font-weight:bold;margin-left:10px;">🌟 恭喜！加上本次，已達標 2 小時完美目標！</span>`;
      } else if (totalMins >= 60) {
        alertHtml += ` <span style="color:var(--accent-emerald);font-weight:bold;margin-left:10px;">🎉 恭喜！加上本次，已達標 1 小時最低標準！</span>`;
      } else {
        alertHtml += ` <span style="margin-left:10px;">(今日預估累計 ${totalMins} 分鐘，距離 1 小時還差 ${60 - totalMins} 分鐘)</span>`;
      }
      
      const alertEl = document.getElementById(`${type}TimerAlert`);
      alertEl.style.display = "flex";
      alertEl.innerHTML = alertHtml;
      
      this.reset(type);
    }
  }

  static handlePause() {
    if (!activeTimerType) return;
    const type = activeTimerType;
    const capType = type === 'input' ? 'Input' : 'Output';
    const state = this.getTimerState(type);
    const badgeType = type === 'input' ? "輸入沉浸中" : "口說輸出中";
    
    const pauseBtn = document.getElementById(`pause${capType}TimerBtn`);
    const zonePauseBtn = document.getElementById("zonePauseBtn");
    
    if (state.isPaused) {
      state.startTime = Date.now() - (state.seconds * 1000);
      state.isPaused = false;
      state.interval = setInterval(() => {
        state.seconds = Math.floor((Date.now() - state.startTime) / 1000);
        this.updateDisplay(type);
      }, 1000);
      
      pauseBtn.innerHTML = `<i class="fas fa-pause"></i> 暫停`;
      zonePauseBtn.innerHTML = `<i class="fas fa-pause"></i> 暫停`;
      document.getElementById("zoneBadgeType").innerText = badgeType;
    } else {
      clearInterval(state.interval);
      state.isPaused = true;
      pauseBtn.innerHTML = `<i class="fas fa-play"></i> 繼續`;
      zonePauseBtn.innerHTML = `<i class="fas fa-play"></i> 繼續`;
      document.getElementById("zoneBadgeType").innerText = "暫停中";
    }
  }

  static updateDisplay(type) {
    const state = this.getTimerState(type);
    const mins = Math.floor(state.seconds / 60).toString().padStart(2, '0');
    const secs = (state.seconds % 60).toString().padStart(2, '0');
    const timeStr = `${mins}:${secs}`;
    
    document.getElementById(`${type}TimerDisplay`).innerText = timeStr;
    document.getElementById("zoneTimerDisplay").innerText = timeStr;
    document.getElementById("floatingBadgeTimer").innerText = timeStr;
  }

  static reset(type) {
    const state = this.getTimerState(type);
    const capType = type === 'input' ? 'Input' : 'Output';
    
    if (state.interval) {
      clearInterval(state.interval);
      state.interval = null;
    }
    state.seconds = 0;
    state.startTime = null;
    state.isPaused = false;
    
    document.getElementById(`pause${capType}TimerBtn`).style.display = "none";
    this.updateDisplay(type);
    
    const startBtn = document.getElementById(`start${capType}TimerBtn`);
    startBtn.innerHTML = `<i class="fas fa-play"></i> 開始沉浸`;
    startBtn.classList.remove("active");
  }
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
  if (document.visibilityState === "visible" && activeTimerType) {
    const state = TimerManager.getTimerState(activeTimerType);
    if (state.startTime && !state.isPaused) {
      state.seconds = Math.floor((Date.now() - state.startTime) / 1000);
      TimerManager.updateDisplay(activeTimerType);
    }
  }
}

/* ==========================================================================
   AI Vocab Extraction & Review Modal
   ========================================================================== */
let pendingAiVocabList = [];
let confirmedPendingVocabs = [];

let aiExtractAbortController = null;

document.getElementById("aiExtractVocabBtn").addEventListener("click", async () => {
  const textInput = document.getElementById("aiVocabInputText");
  const text = textInput.value.trim();
  const btn = document.getElementById("aiExtractVocabBtn");

  if (!text) {
    showToast("請先貼上英文文章、對話或字幕！", "error");
    return;
  }

  aiExtractAbortController = new AbortController();
  const signal = aiExtractAbortController.signal;

  const modal = document.getElementById("aiExtractProgressModal");
  if (modal) modal.classList.add("show");
  
  const timerDisplay = document.getElementById("aiExtractTimerDisplay");
  const cancelBtn = document.getElementById("cancelAiExtractBtn");
  if (cancelBtn) cancelBtn.style.display = "none";
  if (timerDisplay) timerDisplay.innerText = "0s";
  
  let seconds = 0;
  const timerInterval = setInterval(() => {
    seconds++;
    if (timerDisplay) timerDisplay.innerText = seconds + "s";
    if (seconds >= 10 && cancelBtn) {
      cancelBtn.style.display = "block";
    }
  }, 1000);

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
      body: JSON.stringify({ text }),
      signal
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
    if (err.name === 'AbortError') {
      showToast("已取消 AI 萃取。", "info");
    } else {
      showToast("AI 萃取失敗：" + err.message, "error");
    }
  } finally {
    clearInterval(timerInterval);
    if (modal) modal.classList.remove("show");
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
});

document.getElementById("cancelAiExtractBtn")?.addEventListener("click", () => {
  if (aiExtractAbortController) {
    aiExtractAbortController.abort();
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
      <span class="vocab-chip-edit" onclick="editPendingVocab(${index})" style="color:var(--text-secondary); cursor: pointer; font-size: 10px; margin-left: 4px;"><i class="fas fa-edit"></i></span>
      <span class="vocab-chip-remove" onclick="removePendingVocab(${index})" style="color:var(--text-secondary); cursor: pointer; margin-left: 4px;">&times;</span>
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

// ==========================================
// Enhancements: Form Persistence, Quiz, Lib
// ==========================================
(function initEnhancements() {
  // 1. Custom Log Date
  const dateBtn = document.getElementById("toggleCustomDateBtn");
  const dateInput = document.getElementById("customLogDate");
  if (dateBtn && dateInput) {
    dateInput.value = getLocalDateString(new Date());
    dateBtn.addEventListener("click", () => {
      if (dateInput.style.display === "none") {
        dateInput.style.display = "inline-block";
      } else {
        dateInput.style.display = "none";
        dateInput.value = getLocalDateString(new Date()); // Reset
      }
    });
  }

  // 2. Form Persistence
  const formFields = ["inputSource", "inputDuration", "inputTitle", "aiVocabInputText", "outputType", "outputDuration", "outputTitle"];
  formFields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const saved = localStorage.getItem('draft_' + id);
      if (saved) el.value = saved;
      el.addEventListener("input", () => localStorage.setItem('draft_' + id, el.value));
    }
  });

  const checkbox = document.getElementById("inputPassive");
  if (checkbox) {
    const saved = localStorage.getItem('draft_inputPassive');
    if (saved === 'true') checkbox.checked = true;
    checkbox.addEventListener("change", () => localStorage.setItem('draft_inputPassive', checkbox.checked));
  }

  // 3. Vocab Library UI bindings
  document.getElementById("openVocabLibraryBtn")?.addEventListener("click", () => {
    document.getElementById("vocabLibraryModal").classList.add("show");
    renderFullVocabList();
  });
  
  document.getElementById("vocabSearchInput")?.addEventListener("input", renderFullVocabList);

  window.closeVocabLibraryModal = function() {
    document.getElementById("vocabLibraryModal").classList.remove("show");
  };

  document.getElementById("manualAddVocabLibBtn")?.addEventListener("click", () => {
    CustomDialog.show({
      title: "新增單字",
      inputs: [
        { label: "英文單字", placeholder: "例如: apple" },
        { label: "中文解釋", placeholder: "例如: 蘋果" },
        { label: "例句 (選填)", placeholder: "例如: I eat an apple." }
      ],
      onConfirm: (values) => {
        const word = values[0]?.trim();
        if (!word) return;
        const meaning = values[1]?.trim();
        const sentence = values[2]?.trim();
        
        vocab.push({
          id: "v-" + Date.now(),
          date: getLocalDateString(new Date()),
          word: word,
          definition: meaning || "",
          sentence: sentence || "",
          source: "Manual",
          synced: false
        });
        saveData();
        renderVocab();
        renderFullVocabList();
        showToast("單字已新增至單字庫", "success");
      }
    });
  });

  // 4. Pending Vocab Edit & Add
  window.editPendingVocab = function(index) {
    const item = confirmedPendingVocabs[index];
    CustomDialog.show({
      title: "編輯單字",
      inputs: [
        { label: "英文單字", value: item.word },
        { label: "中文解釋", value: item.definition }
      ],
      onConfirm: (values) => {
        const newWord = values[0]?.trim();
        if (!newWord) return;
        item.word = newWord;
        item.definition = values[1]?.trim() || "";
        renderPendingVocabChips();
      }
    });
  };

  document.getElementById("addPendingVocabBtn")?.addEventListener("click", () => {
    CustomDialog.show({
      title: "加入待寫入單字",
      inputs: [
        { label: "英文單字", placeholder: "例如: banana" },
        { label: "中文解釋", placeholder: "例如: 香蕉" }
      ],
      onConfirm: (values) => {
        const word = values[0]?.trim();
        if (!word) return;
        confirmedPendingVocabs.push({ word: word, definition: values[1]?.trim() || "", sentence: "" });
        renderPendingVocabChips();
      }
    });
  });

  // 5. Daily Quiz Setup
  checkDailyQuizState();
  document.getElementById("startQuizBtn")?.addEventListener("click", startDailyQuiz);
})();

// ==========================================
// Daily Quiz Logic
// ==========================================
let currentQuizIndex = 0;
let currentQuizQuestions = [];

function checkDailyQuizState() {
  const badge = document.getElementById("quizStatusBadge");
  const startBtn = document.getElementById("startQuizBtn");
  const today = getLocalDateString(new Date());
  
  const savedState = JSON.parse(localStorage.getItem("dailyQuizState")) || {};
  
  if (savedState.date === today && savedState.completed) {
    if(badge) {
      badge.innerText = "今日已完成";
      badge.style.background = "rgba(16, 185, 129, 0.2)";
      badge.style.color = "#10b981";
    }
    if(startBtn) startBtn.disabled = true;
  }
}

function startDailyQuiz() {
  if (vocab.length < 5) {
    alert("單字庫中少於 5 個單字，無法進行測驗！請先多多累積單字喔！");
    return;
  }

  // Randomly select 5 words
  const shuffledVocab = [...vocab].sort(() => 0.5 - Math.random());
  const selectedVocab = shuffledVocab.slice(0, 5);
  
  currentQuizQuestions = selectedVocab.map(v => {
    // Generate 3 distractors
    const distractors = [...vocab].filter(dist => dist.id !== v.id).sort(() => 0.5 - Math.random()).slice(0, 3);
    const options = [v.definition, ...distractors.map(d => d.definition)];
    // Ensure unique options if possible, fallback to word if definition is empty
    const uniqueOptions = [...new Set(options.map((opt, i) => opt || `(無定義 ${i})`))];
    while(uniqueOptions.length < 4) {
      uniqueOptions.push(`干擾選項 ${uniqueOptions.length}`);
    }
    const finalOptions = uniqueOptions.slice(0, 4).sort(() => 0.5 - Math.random());
    
    return {
      word: v.word,
      correct: v.definition || "(無定義)",
      options: finalOptions
    };
  });

  currentQuizIndex = 0;
  document.getElementById("startQuizBtn").style.display = "none";
  document.getElementById("quizContainer").style.display = "block";
  document.getElementById("quizIntroText").style.display = "none";
  
  renderQuizQuestion();
}

function renderQuizQuestion() {
  if (currentQuizIndex >= currentQuizQuestions.length) {
    finishDailyQuiz();
    return;
  }

  const q = currentQuizQuestions[currentQuizIndex];
  document.getElementById("quizCurrentQ").innerText = currentQuizIndex + 1;
  document.getElementById("quizQuestionText").innerText = q.word;
  
  const optsContainer = document.getElementById("quizOptionsContainer");
  optsContainer.innerHTML = "";
  
  q.options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "quiz-option-btn";
    btn.innerText = opt;
    btn.onclick = () => handleQuizAnswer(btn, opt, q.correct);
    optsContainer.appendChild(btn);
  });
}

function handleQuizAnswer(btn, selected, correct) {
  const allBtns = document.querySelectorAll(".quiz-option-btn");
  allBtns.forEach(b => b.disabled = true);
  
  if (selected === correct) {
    btn.classList.add("correct");
  } else {
    btn.classList.add("wrong");
    // highlight correct
    allBtns.forEach(b => {
      if (b.innerText === correct) b.classList.add("correct");
    });
  }
  
  setTimeout(() => {
    currentQuizIndex++;
    renderQuizQuestion();
  }, 1000);
}

function finishDailyQuiz() {
  document.getElementById("quizContainer").style.display = "none";
  document.getElementById("quizIntroText").style.display = "block";
  document.getElementById("quizIntroText").innerText = "恭喜完成今日的 5 題單字測驗！";
  
  const today = getLocalDateString(new Date());
  localStorage.setItem("dailyQuizState", JSON.stringify({ date: today, completed: true }));
  checkDailyQuizState();
}

// ==========================================
// Vocab Library Logic
// ==========================================
function renderFullVocabList() {
  const container = document.getElementById("fullVocabList");
  if (!container) return;
  
  const searchTxt = (document.getElementById("vocabSearchInput").value || "").toLowerCase();
  container.innerHTML = "";
  
  const filtered = vocab.filter(v => 
    (v.word && v.word.toLowerCase().includes(searchTxt)) || 
    (v.definition && v.definition.toLowerCase().includes(searchTxt))
  );
  
  if (filtered.length === 0) {
    container.innerHTML = `<div class="text-muted" style="text-align:center; padding:20px;">找不到符合的單字</div>`;
    return;
  }
  
  filtered.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach((v, index) => {
    const div = document.createElement("div");
    div.style.background = "#f8fafc";
    div.style.border = "1px solid var(--border-color)";
    div.style.borderRadius = "8px";
    div.style.padding = "12px 16px";
    div.style.display = "flex";
    div.style.flexDirection = "column";
    div.style.gap = "6px";
    
    div.innerHTML = `
      <div style="display:flex; justify-content: space-between; align-items: flex-start;">
        <h4 style="color:var(--accent-cyan); margin:0; font-size: 16px;">${v.word}</h4>
        <div>
          <button onclick="editVocabLib('${v.id}')" class="btn-text-only" style="padding:4px;"><i class="fas fa-edit"></i></button>
          <button onclick="deleteVocabLib('${v.id}')" class="btn-text-only" style="padding:4px;"><i class="fas fa-trash-alt"></i></button>
        </div>
      </div>
      <div style="font-size: 14px; font-weight: 500;">${v.definition || '(無定義)'}</div>
      ${v.sentence ? `<div style="font-size: 12px; color: var(--text-secondary); background: rgba(0,0,0,0.03); padding: 6px; border-radius: 4px;"><em>"${v.sentence}"</em></div>` : ''}
      <div style="font-size: 11px; color: var(--text-muted); text-align: right; margin-top: 4px;">來源: ${v.source || '手動加入'} | ${v.date}</div>
    `;
    container.appendChild(div);
  });
}

window.editVocabLib = function(id) {
  const v = vocab.find(x => x.id === id);
  if(!v) return;
  
  CustomDialog.show({
    title: "編輯單字庫",
    inputs: [
      { label: "英文單字", value: v.word },
      { label: "中文解釋", value: v.definition },
      { label: "例句", value: v.sentence }
    ],
    onConfirm: (values) => {
      const newWord = values[0]?.trim();
      if (!newWord) return;
      v.word = newWord;
      v.definition = values[1]?.trim() || "";
      v.sentence = values[2]?.trim() || "";
      saveData();
      renderVocab();
      renderFullVocabList();
    }
  });
};

window.deleteVocabLib = function(id) {
  CustomDialog.confirm("刪除單字", "確定要刪除此單字嗎？", (confirmed) => {
    if (confirmed) {
      vocab = vocab.filter(x => x.id !== id);
      saveData();
      renderVocab();
      renderFullVocabList();
    }
  });
};
