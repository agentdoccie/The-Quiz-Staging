// ===============================
// The Southern African Assembly – Correct Your Status Quiz
// Stable randomization & 10-question display fix
// ===============================

const basePath = "/The-Quiz-Staging/";
const PASSING_SCORE = 70;
const VOLUNTEER_TRIGGER = 80;
const MAX_LEVEL = 100;
const KNOWN_LEVELS = [1, 2, 3, 4, 5];

let currentLevel = parseInt(localStorage.getItem("tsaaLevel")) || 1;
let currentQuestion = 0;
let score = 0;
let levelData = [];
let playerName = localStorage.getItem("playerName") || "";

const quizContainer = document.getElementById("quiz");
const nextBtn = document.getElementById("nextBtn");
const resultContainer = document.getElementById("result");
const progressBar = document.getElementById("progressBar");
const levelTitle = document.getElementById("levelTitle");
const resetAllBtn = document.getElementById("resetAllBtn");

// --- Utility ---
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function sampleN(array, n) {
  const copy = [...array];
  shuffle(copy);
  return copy.slice(0, n);
}

// --- Welcome screen ---
function ensureWelcomeScreen() {
  let screen = document.getElementById("welcomeScreen");
  if (!screen) {
    screen = document.createElement("div");
    screen.id = "welcomeScreen";
    screen.innerHTML = `
      <h2>Welcome to the Southern African Assembly Knowledge Quiz</h2>
      <p>Please enter your name to begin:</p>
      <input type="text" id="playerNameInput" placeholder="Your full name" />
      <button id="startQuizBtn" type="button">Start Quiz</button>
    `;
    document.getElementById("container").prepend(screen);
  }

  const startBtn = document.getElementById("startQuizBtn");
  startBtn.onclick = null;
  startBtn.addEventListener("click", () => {
    const nameInput = document.getElementById("playerNameInput").value.trim();
    if (nameInput.length < 2) {
      alert("Please enter your full name to continue.");
      return;
    }
    playerName = nameInput;
    localStorage.setItem("playerName", playerName);
    screen.classList.add("hidden");
    startQuiz();
  });
}

// --- Boot ---
document.addEventListener("DOMContentLoaded", () => {
  ensureWelcomeScreen();
  if (playerName && playerName.trim().length > 1) {
    document.getElementById("welcomeScreen")?.classList.add("hidden");
    startQuiz();
  }
});

function startQuiz() {
  quizContainer.classList.remove("hidden");
  loadLevel(currentLevel);
}

// --- Load Level ---
async function loadLevel(level) {
  levelTitle.textContent = "";
  quizContainer.innerHTML = "";
  resultContainer.classList.add("hidden");
  nextBtn.classList.add("hidden");
  progressBar.style.width = "0%";
  score = 0;
  currentQuestion = 0;

  try {
    const res = await fetch(`${basePath}questions/level${level}.json?v=${Date.now()}`);
    if (!res.ok) throw new Error("File not found");
    const json = await res.json();

    levelTitle.textContent = `Level ${json.level}: ${json.title || ""}`;

    // --- NEW FIX: randomize & trim to 10 ---
    levelData = prepareLevelData(json.questions || []);

    quizContainer.innerHTML = `
      <div class="summary-card">
        <h3>Level Overview</h3>
        <p>${json.summary || ""}</p>
        <button id="startLevelBtn">Start Level ${json.level}</button>
      </div>
    `;

    document.getElementById("startLevelBtn").addEventListener("click", () => {
      loadQuestion();
      nextBtn.classList.remove("hidden");
    });
  } catch (err) {
    console.error("Error loading level:", err);
    quizContainer.innerHTML = `<p style="color:#b22222;">⚠️ Could not load Level ${level}. Try again later.</p>`;
  }
}

// --- Randomize questions & answers ---
function prepareLevelData(allQuestions) {
  const selected = sampleN(allQuestions, Math.min(10, allQuestions.length));
  return selected.map((q) => {
    const answers = q.options.map((text, idx) => ({
      text,
      isCorrect: idx === q.correctIndex,
    }));
    shuffle(answers);
    return {
      question: q.question,
      options: answers.map((a) => a.text),
      correctIndex: answers.findIndex((a) => a.isCorrect),
    };
  });
}

// --- Render a question ---
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

// --- Select answer ---
function selectAnswer(index, btn) {
  levelData[currentQuestion].selected = index;
  nextBtn.disabled = false;
  document.querySelectorAll(".option").forEach((opt) => (opt.style.background = "#fff"));
  btn.style.background = "#c5f2cc";
}

// --- Next / finish ---
nextBtn.addEventListener("click", () => {
  const current = levelData[currentQuestion];
  if (current.selected === current.correctIndex) score++;
  currentQuestion++;
  if (currentQuestion < levelData.length) loadQuestion();
  else finishLevel();
});

// --- Finish level ---
function finishLevel() {
  progressBar.style.width = "100%";
  const total = levelData.length || 1;
  const percent = (score / total) * 100;

  quizContainer.innerHTML = "";
  nextBtn.classList.add("hidden");
  resultContainer.classList.remove("hidden");
  resultContainer.style.background = percent >= PASSING_SCORE ? "#d8f7d3" : "#f9d3d3";

  const feedback =
    percent >= 90
      ? "🌟 Excellent! You’ve mastered this level."
      : percent >= 70
      ? "✅ Great job! You passed and built strong understanding."
      : "⚠️ Keep going! Try again for a higher score.";

  resultContainer.innerHTML = `
    <h2>Level ${currentLevel} Complete</h2>
    <p>Well done, ${playerName}!</p>
    <h3>Your Score: ${score}/${total} (${Math.round(percent)}%)</h3>
    <p>${feedback}</p>
  `;

  if (percent >= VOLUNTEER_TRIGGER) showVolunteerPrompt();

  if (percent >= PASSING_SCORE && currentLevel < MAX_LEVEL) {
    const nextLevelBtn = document.createElement("button");
    nextLevelBtn.textContent = "Next Level";
    nextLevelBtn.addEventListener("click", () => {
      currentLevel++;
      localStorage.setItem("tsaaLevel", currentLevel);
      loadLevel(currentLevel);
    });
    resultContainer.appendChild(nextLevelBtn);
  }
}

// --- Volunteer prompt ---
function showVolunteerPrompt() {
  const overlay = document.createElement("div");
  overlay.id = "volunteerModal";
  overlay.innerHTML = `
    <div class="modal-content">
      <h3>🌿 Wow ${playerName}, you really understand all this!</h3>
      <p>Have you thought about being a volunteer for the Assembly?</p>
      <div class="modal-buttons">
        <button id="yesVolunteer">Yes! I'd love to</button>
        <button id="noVolunteer">Not for now, let's continue</button>
      </div>
    </div>
  `;
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

// --- Restart Quiz ---
resetAllBtn.addEventListener("click", () => {
  if (confirm("Restart from Level 1?")) {
    localStorage.removeItem("tsaaScores");
    localStorage.removeItem("tsaaLevel");
    currentLevel = 1;
    ensureWelcomeScreen();
  }
});
