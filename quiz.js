// ===============================
// The Southern African Assembly – Correct Your Status Quiz
// Staging build: The-Quiz-Staging
// Enhancements:
//  • Randomize answer order per question
//  • Randomly sample 10 questions from 50 on every run (Option A)
//  • Resilient loading (cache + retry) and mobile-safe UI
// ===============================

const basePath = "/The-Quiz-Staging/";
const PASSING_SCORE = 70;
const VOLUNTEER_TRIGGER = 80;
const MAX_LEVEL = 100;
const KNOWN_LEVELS = [1, 2, 3, 4, 5];

let currentLevel = parseInt(localStorage.getItem("tsaaLevel")) || 1;
let currentQuestion = 0;
let score = 0;
let levelData = [];   // after preparation, will contain 10 randomized questions
let playerName = localStorage.getItem("playerName") || "";

const quizContainer   = document.getElementById("quiz");
const nextBtn         = document.getElementById("nextBtn");
const resultContainer = document.getElementById("result");
const progressBar     = document.getElementById("progressBar");
const levelTitle      = document.getElementById("levelTitle");
const resetAllBtn     = document.getElementById("resetAllBtn");

// Utility: Fisher-Yates shuffle (in-place)
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Utility: sample N unique items from an array (no mutation of original)
function sampleN(arr, n) {
  if (n >= arr.length) return [...arr];
  const copy = [...arr];
  shuffle(copy);
  return copy.slice(0, n);
}

// Create/ensure welcome screen (single instance)
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
  if (startBtn) {
    startBtn.onclick = null;
    startBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const input = document.getElementById("playerNameInput");
      const nameInput = (input?.value || "").trim();
      if (nameInput.length < 2) {
        alert("Please enter your full name to continue.");
        input?.focus();
        return;
      }
      playerName = nameInput;
      localStorage.setItem("playerName", playerName);
      screen.classList.add("hidden");
      startQuiz();
    }, { passive: true });
  }

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

function startQuiz() {
  quizContainer.classList.remove("hidden");
  loadLevel(currentLevel).then(() => prefetchLevels(KNOWN_LEVELS.filter(n => n !== currentLevel)));
}

const cacheKey = (lvl) => `tsaaLevelCache_${lvl}`;

// Load JSON with resilience (online → cache; fallback to cache)
async function loadLevel(level) {
  levelTitle.textContent = "";
  quizContainer.innerHTML = "";
  resultContainer.classList.add("hidden");
  nextBtn.classList.add("hidden");
  progressBar.style.width = "0%";
  score = 0;
  currentQuestion = 0;

  const paths = [
    `${basePath}questions/level${level}.json`,
    `/questions/level${level}.json`,
  ];

  let json = null;

  for (const url of paths) {
    try {
      const res = await fetch(`${url}?v=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) continue;
      json = await res.json();
      localStorage.setItem(cacheKey(level), JSON.stringify(json));
      break;
    } catch { /* no-op */ }
  }

  if (!json) {
    const cached = localStorage.getItem(cacheKey(level));
    if (cached) {
      try { json = JSON.parse(cached); } catch {}
    }
  }

  if (!json) {
    quizContainer.innerHTML = `
      <div class="error-card">
        <p style="color:#b22222;">⚠️ Could not load Level ${level}. Try again later.</p>
        <button id="retryLoad">Retry</button>
      </div>`;
    document.getElementById("retryLoad")?.addEventListener("click", () => loadLevel(level));
    return;
  }

  // Prepare title
  levelTitle.textContent = `Level ${json.level}: ${json.title || ""}`;

  // If summary exists, show intro card
  if (json.summary) {
    quizContainer.innerHTML = `
      <div class="summary-card">
        <h3>Level Overview</h3>
        <p>${json.summary}</p>
        <button id="startLevelBtn">Start Level ${json.level}</button>
      </div>`;
    document.getElementById("startLevelBtn")?.addEventListener("click", () => {
      // Prepare level data when user actually starts the level
      levelData = prepareLevelData(json.questions || []);
      loadQuestion();
      nextBtn.classList.remove("hidden");
    });
    return;
  }

  // Otherwise, prepare immediately and start
  levelData = prepareLevelData(json.questions || []);
  loadQuestion();
  nextBtn.classList.remove("hidden");
}

// Prefetch & cache (non-blocking)
async function prefetchLevels(levels) {
  for (const lvl of levels) {
    try {
      const res = await fetch(`${basePath}questions/level${lvl}.json?v=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        localStorage.setItem(cacheKey(lvl), JSON.stringify(json));
      }
    } catch { /* ignore */ }
  }
}

/**
 * Prepare level data:
 * - Randomly choose 10 questions from the source (50 expected)
 * - For each chosen question, shuffle its answer options
 * - Recompute correctIndex to match the shuffled options
 */
function prepareLevelData(allQuestions) {
  const picked = sampleN(allQuestions, Math.min(10, allQuestions.length));

  return picked.map((q) => {
    const originalOptions = q.options.map((text, idx) => ({
      text,
      isCorrect: idx === q.correctIndex
    }));

    shuffle(originalOptions);

    const newOptions = originalOptions.map(o => o.text);
    const newCorrectIndex = originalOptions.findIndex(o => o.isCorrect);

    return {
      question: q.question,
      options: newOptions,
      correctIndex: newCorrectIndex,
      // we can also carry any metadata if needed
    };
  });
}

// Render one question
function loadQuestion() {
  const q = levelData[currentQuestion];
  if (!q) return finishLevel();

  progressBar.style.width = `${(currentQuestion / levelData.length) * 100}%`;

  quizContainer.innerHTML = `
    <div class="question">
      <h3>Question ${currentQuestion + 1} of ${levelData.length}</h3>
      <p>${q.question}</p>
    </div>
  `;

  q.options.forEach((option, i) => {
    const btn = document.createElement("button");
    btn.textContent = option;
    btn.className = "option";
    btn.addEventListener("click", () => selectAnswer(i, btn));
    quizContainer.appendChild(btn);
  });

  nextBtn.disabled = true;
}

// Select answer
function selectAnswer(index, btn) {
  levelData[currentQuestion].selected = index;
  nextBtn.disabled = false;
  document.querySelectorAll(".option").forEach(opt => (opt.style.background = "#fff"));
  btn.style.background = "#c5f2cc";
}

// Next / finish
nextBtn.addEventListener("click", () => {
  const current = levelData[currentQuestion];
  if (current.selected === current.correctIndex) score++;
  currentQuestion++;
  if (currentQuestion < levelData.length) loadQuestion();
  else finishLevel();
});

// Finish level
function finishLevel() {
  progressBar.style.width = "100%";
  const total = levelData.length || 1;
  const percent = (score / total) * 100;

  quizContainer.innerHTML = "";
  nextBtn.classList.add("hidden");
  resultContainer.classList.remove("hidden");
  resultContainer.style.background = percent >= PASSING_SCORE ? "var(--ok)" : "var(--warn)";

  const scores = JSON.parse(localStorage.getItem("tsaaScores") || "{}");
  scores[`level${currentLevel}`] = percent;
  localStorage.setItem("tsaaScores", JSON.stringify(scores));

  const feedback =
    percent >= 90 ? "🌟 Excellent! You’ve mastered this level."
    : percent >= 70 ? "✅ Great job! You passed and built strong understanding."
    : "⚠️ Keep going! Try again for a higher score.";

  resultContainer.innerHTML = `
    <h2>Level ${currentLevel} Complete</h2>
    <p>Well done, ${playerName || "friend"}!</p>
    <h3>Your Score: ${score}/${total} (${Math.round(percent)}%)</h3>
    <p>${feedback}</p>
  `;

  if (percent >= VOLUNTEER_TRIGGER) showVolunteerPrompt();

  if (percent >= PASSING_SCORE && currentLevel < MAX_LEVEL) {
    const nextLevelBtn = document.createElement("button");
    nextLevelBtn.id = "nextLevelBtn";
    nextLevelBtn.textContent = "Next Level";
    nextLevelBtn.addEventListener("click", () => {
      currentLevel++;
      localStorage.setItem("tsaaLevel", currentLevel);
      loadLevel(currentLevel);
    });
    resultContainer.appendChild(nextLevelBtn);
  }
}

// Volunteer modal
function showVolunteerPrompt() {
  const overlay = document.createElement("div");
  overlay.id = "volunteerModal";
  overlay.innerHTML = `
    <div class="modal-content">
      <h3>🌿 Wow ${playerName || "friend"}, you really understand all this!</h3>
      <p>Have you thought about being a volunteer for the Assembly?</p>
      <div class="modal-buttons">
        <button id="yesVolunteer">Yes! I'd love to</button>
        <button id="noVolunteer">Not for now, let's continue</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById("yesVolunteer").addEventListener("click", () => {
    window.open("https://thesouthafricanassembly.org/contact-us/", "_blank");
    overlay.remove();
  });
  document.getElementById("noVolunteer").addEventListener("click", () => {
    alert("👍 Maybe in the future! Let's hammer on and see what else you know!");
    overlay.remove();
  });
}

// Full reset (keep cached questions for offline)
resetAllBtn.addEventListener("click", () => {
  if (!confirm("Are you sure you want to restart from Level 1?")) return;
  localStorage.removeItem("tsaaScores");
  localStorage.removeItem("tsaaLevel");
  // keep playerName so they don’t have to retype; remove this line if you want to clear name too:
  // localStorage.removeItem("playerName");
  currentLevel = 1;
  currentQuestion = 0;
  ensureWelcomeScreen();
});
