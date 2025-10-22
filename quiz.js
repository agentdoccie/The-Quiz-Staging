// =========================================
// Correct your Status — Quiz (Staging Build)
// Resilient loader + mobile-friendly
// =========================================

// ---------- Config ----------
const PASSING_SCORE = 70;
const VOLUNTEER_TRIGGER = 80;
const TOTAL_LEVELS = 100;          // supports future growth
const KNOWN_LEVELS = 5;            // how many levels you currently ship
const FETCH_TIMEOUT_MS = 7000;     // timeout for each fetch try
const FETCH_RETRIES = 2;           // total tries = 1 + RETRIES
const QUESTIONS_VERSION = "v1";    // bump to invalidate local cache

// Detect if we’re running under a Pages subfolder
const basePath = (function () {
  const parts = location.pathname.split("/").filter(Boolean);
  return parts.length >= 1 ? `/${parts[0]}/` : "/";
})();

// ---------- State ----------
let currentLevel = parseInt(localStorage.getItem("tsaaLevel") || "1", 10);
let currentQuestion = 0;
let score = 0;
let levelData = [];
let playerName = localStorage.getItem("playerName") || "";

// ---------- Elements ----------
const quizContainer   = document.getElementById("quiz");
const nextBtn         = document.getElementById("nextBtn");
const resultContainer = document.getElementById("result");
const progressBar     = document.getElementById("progressBar");
const levelTitle      = document.getElementById("levelTitle");
const resetAllBtn     = document.getElementById("resetAllBtn");

// Ensure welcome screen exists once and only once
function ensureWelcomeScreen() {
  let screen = document.getElementById("welcomeScreen");
  if (!screen) {
    screen = document.createElement("div");
    screen.id = "welcomeScreen";
    screen.innerHTML = `
      <h2>Welcome to the Southern African Assembly Knowledge Quiz</h2>
      <p>Please enter your name to begin:</p>
      <input type="text" id="playerNameInput" placeholder="Your full name" autocomplete="name" />
      <button id="startQuizBtn" type="button">Start Quiz</button>
    `;
    const container = document.getElementById("container");
    container.prepend(screen);
  }
  const startBtn = document.getElementById("startQuizBtn");
  startBtn.onclick = null;
  startBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const name = (document.getElementById("playerNameInput").value || "").trim();
    if (name.length < 2) {
      alert("Please enter your full name to continue.");
      return;
    }
    playerName = name;
    localStorage.setItem("playerName", playerName);
    screen.classList.add("hidden");
    startQuiz();
  }, { passive: true });

  // Show welcome, hide quiz pieces on first visit
  quizContainer.innerHTML = "";
  quizContainer.classList.add("hidden");
  nextBtn.classList.add("hidden");
  resultContainer.classList.add("hidden");
  screen.classList.remove("hidden");
}

// Boot
document.addEventListener("DOMContentLoaded", () => {
  ensureWelcomeScreen();
  if (playerName && playerName.trim().length > 1) {
    document.getElementById("welcomeScreen")?.classList.add("hidden");
    startQuiz();
  }
});

// ---------- Robust fetch with retry & timeout ----------
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))
  ]);
}

async function fetchJSONWithRetry(url, { retries = FETCH_RETRIES, timeout = FETCH_TIMEOUT_MS } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // cache-bust to avoid stale CDN content
      const bust = url.includes("?") ? `&cb=${Date.now()}` : `?cb=${Date.now()}`;
      const res = await withTimeout(fetch(url + bust, { cache: "no-store" }), timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      await new Promise(r => setTimeout(r, 300 * (attempt + 1))); // small backoff
    }
  }
  throw lastErr;
}

// ---------- Local cache helpers ----------
function cacheKey(level) {
  return `tsaa_questions_${QUESTIONS_VERSION}_L${level}`;
}
function saveQuestionsToCache(level, json) {
  try { localStorage.setItem(cacheKey(level), JSON.stringify(json)); } catch {}
}
function readQuestionsFromCache(level) {
  try {
    const raw = localStorage.getItem(cacheKey(level));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ---------- Fallback (used only if remote & cache both fail) ----------
const FALLBACK = {
  1: {
    level: 1,
    title: "Fundamentals (Fallback)",
    summary: "Temporary questions shown because the remote file didn’t load.",
    questions: [
      { question: "Fallback Q1: TSAA stands for…?", options: [
        "The South African Assembly", "Transport Safety Admin", "Trade Services Assoc. Africa", "Tri-State Admin Agency"
      ], correctIndex: 0 },
      { question: "Fallback Q2: The quiz saves your name in…", options: [
        "Local Storage", "A blockchain", "Your email", "Paper ledger"
      ], correctIndex: 0 }
    ]
  }
  // You can add minimal fallbacks for 2..5 if desired
};

// ---------- Core flow ----------
function startQuiz() {
  quizContainer.classList.remove("hidden");
  loadLevel(currentLevel);
}

async function loadLevel(level) {
  // Reset UI
  resultContainer.classList.add("hidden");
  quizContainer.classList.remove("hidden");
  nextBtn.classList.add("hidden");
  progressBar.style.width = "0%";
  quizContainer.innerHTML = "<p>Loading…</p>";

  // Try remote -> local cache -> fallback
  const url = `${basePath}questions/level${level}.json`;

  let data = null;

  // 1) Try remote
  try {
    data = await fetchJSONWithRetry(url);
    saveQuestionsToCache(level, data);
  } catch {
    // 2) Try cache
    data = readQuestionsFromCache(level);
  }

  // 3) Fallback
  if (!data) data = FALLBACK[level] || FALLBACK[1];

  levelData = data.questions || [];
  currentQuestion = 0;
  score = 0;

  levelTitle.textContent = `Level ${data.level}: ${data.title || ""}`;

  if (data.summary) {
    quizContainer.innerHTML = `
      <div class="summary-card">
        <h3>Level Overview</h3>
        <p>${data.summary}</p>
        <button id="startLevelBtn" type="button">Start Level ${data.level}</button>
      </div>
    `;
    document.getElementById("startLevelBtn").onclick = () => {
      nextBtn.classList.remove("hidden");
      loadQuestion();
    };
    return;
  }

  nextBtn.classList.remove("hidden");
  loadQuestion();
}

function loadQuestion() {
  const q = levelData[currentQuestion];
  progressBar.style.width = `${(currentQuestion / levelData.length) * 100}%`;

  quizContainer.innerHTML = `
    <div class="question">
      <h3>Question ${currentQuestion + 1} of ${levelData.length}</h3>
      <p>${q.question}</p>
    </div>
  `;

  q.options.forEach((option, i) => {
    const btn = document.createElement("button");
    btn.className = "option";
    btn.textContent = option;
    btn.addEventListener("click", () => selectAnswer(i, btn));
    quizContainer.appendChild(btn);
  });

  nextBtn.disabled = true;
}

function selectAnswer(index, btn) {
  levelData[currentQuestion].selected = index;
  nextBtn.disabled = false;
  document.querySelectorAll(".option").forEach(b => (b.style.background = "#f9fcff", b.style.color = "#003366"));
  btn.style.background = "var(--success)";
}

nextBtn.onclick = () => {
  const current = levelData[currentQuestion];
  if (current.selected === current.correctIndex) score++;
  currentQuestion++;
  if (currentQuestion < levelData.length) loadQuestion();
  else finishLevel();
};

function finishLevel() {
  progressBar.style.width = "100%";
  const total = levelData.length || 1;
  const percent = (score / total) * 100;

  quizContainer.classList.add("hidden");
  nextBtn.classList.add("hidden");
  resultContainer.classList.remove("hidden");

  resultContainer.style.background = percent >= PASSING_SCORE ? "#d8f7d3" : "#f9d3d3";
  resultContainer.innerHTML = `
    <h2>Level ${currentLevel} Complete</h2>
    <p>Well done, ${playerName || "friend"}!</p>
    <h3>Your Score: ${score}/${total} (${Math.round(percent)}%)</h3>
    <p>${
      percent >= 90 ? "🌟 Excellent! You’ve mastered this level." :
      percent >= 70 ? "✅ Great job! You passed and built strong understanding." :
                      "⚠️ Keep going! Try again for a higher score."
    }</p>
  `;

  if (percent >= VOLUNTEER_TRIGGER) showVolunteerPrompt();

  // Save progress & average
  const scores = JSON.parse(localStorage.getItem("tsaaScores") || "{}");
  scores[`level${currentLevel}`] = percent;
  localStorage.setItem("tsaaScores", JSON.stringify(scores));

  // Continue if passed
  if (percent >= PASSING_SCORE && currentLevel < KNOWN_LEVELS) {
    const btn = document.createElement("button");
    btn.textContent = "Next Level";
    btn.onclick = () => {
      currentLevel++;
      localStorage.setItem("tsaaLevel", String(currentLevel));
      loadLevel(currentLevel);
    };
    resultContainer.appendChild(btn);
  }
}

function showVolunteerPrompt() {
  const overlay = document.createElement("div");
  overlay.id = "volunteerModal";
  overlay.innerHTML = `
    <div class="modal-content" role="dialog" aria-modal="true">
      <h3>🌿 Wow ${playerName || "friend"}, you really understand all this!</h3>
      <p>Have you thought about being a volunteer for the Assembly?</p>
      <div class="modal-buttons">
        <button id="yesVolunteer" type="button">Yes! I'd love to</button>
        <button id="noVolunteer" class="secondary" type="button">Not for now, let's continue</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById("yesVolunteer").onclick = () => {
    window.open("https://thesouthafricanassembly.org/contact-us/", "_blank");
    overlay.remove();
  };
  document.getElementById("noVolunteer").onclick = () => overlay.remove();
}

// Full reset to Level 1
resetAllBtn.onclick = () => {
  if (!confirm("Are you sure you want to restart from Level 1?")) return;
  localStorage.removeItem("tsaaScores");
  localStorage.removeItem("tsaaLevel");
  currentLevel = 1;
  currentQuestion = 0;
  ensureWelcomeScreen();
};
