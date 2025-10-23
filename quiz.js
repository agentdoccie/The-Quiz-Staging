// ===============================
// The Southern African Assembly – Correct Your Status Quiz
// Final Redundant Auto-Start Build (No Name Input)
// ===============================

// --- Configuration ---
const PASSING_SCORE = 70;
const VOLUNTEER_TRIGGER = 80;
const TOTAL_LEVELS = 100;

// --- Universal base path for GitHub Pages ---
const basePath = window.location.pathname.includes("The-Quiz-Staging")
  ? "/The-Quiz-Staging/"
  : "/";

// --- State variables ---
let currentLevel = parseInt(localStorage.getItem("tsaaLevel")) || 1;
let currentQuestion = 0;
let score = 0;
let levelData = [];

// --- Elements ---
const quizContainer = document.getElementById("quiz");
const nextBtn = document.getElementById("nextBtn");
const resultContainer = document.getElementById("result");
const restartBtn = document.getElementById("restartBtn");
const progressBar = document.getElementById("progressBar");
const levelTitle = document.getElementById("levelTitle");

// --- Boot ---
document.addEventListener("DOMContentLoaded", () => {
  startQuiz();
});

// --- Core Game Start ---
function startQuiz() {
  quizContainer.classList.remove("hidden");
  loadLevel(currentLevel);
}

// --- Load Level (with redundancy) ---
function loadLevel(level, retry = false) {
  quizContainer.classList.remove("hidden");
  resultContainer.classList.add("hidden");
  restartBtn.classList.add("hidden");
  nextBtn.classList.add("hidden");
  progressBar.style.width = "0%";
  quizContainer.innerHTML = "";

  const url = `${basePath}questions/level${level}.json`;

  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`Level ${level} file not found`);
      return res.json();
    })
    .then((data) => {
      levelData = shuffleArray(data.questions || []).slice(0, 10);
      currentQuestion = 0;
      score = 0;

      if (levelTitle) {
        levelTitle.innerHTML = `Level ${data.level}: ${data.title || ""}`;
      }

      if (data.summary) {
        quizContainer.innerHTML = `
          <div class="summary-card">
            <h3>Level Overview</h3>
            <p>${data.summary}</p>
            <button id="startLevelBtn">Start Level ${data.level}</button>
          </div>
        `;
        nextBtn.classList.add("hidden");
        const startBtn = document.getElementById("startLevelBtn");
        if (startBtn) {
          startBtn.addEventListener("click", () => {
            nextBtn.classList.remove("hidden");
            loadQuestion();
          });
        }
        return;
      }

      loadQuestion();
      nextBtn.classList.remove("hidden");
    })
    .catch((err) => {
      console.error("Error loading level:", err);
      if (!retry) {
        console.warn("Retrying level load once...");
        setTimeout(() => loadLevel(level, true), 800);
        return;
      }
      quizContainer.innerHTML = `
        <p style="color:#b22222;">⚠️ Could not load Level ${level}.<br>
        Please ensure the file <strong>questions/level${level}.json</strong> exists or refresh the page.</p>
      `;
      nextBtn.classList.add("hidden");
      resultContainer.classList.add("hidden");
      restartBtn.classList.remove("hidden");
    });
}

// --- Shuffle Helper ---
function shuffleArray(arr) {
  return arr
    .map((val) => ({ val, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ val }) => val);
}

// --- Display Question ---
function loadQuestion() {
  const q = levelData[currentQuestion];
  progressBar.style.width = `${((currentQuestion + 1) / levelData.length) * 100}%`;

  quizContainer.innerHTML = `
    <div class="question">
      <h3>Question ${currentQuestion + 1} of ${levelData.length}</h3>
      <p>${q.question}</p>
    </div>
  `;

  const shuffledOptions = shuffleArray([...q.options]);

  shuffledOptions.forEach((option) => {
    const btn = document.createElement("button");
    btn.textContent = option;
    btn.classList.add("option");
    btn.addEventListener("click", () => selectAnswer(q.options.indexOf(option), btn));
    quizContainer.appendChild(btn);
  });

  nextBtn.disabled = true;
}

// --- Handle Answer ---
function selectAnswer(index, btn) {
  levelData[currentQuestion].selected = index;
  nextBtn.disabled = false;
  document.querySelectorAll(".option").forEach((opt) => (opt.style.background = "#fff"));
  btn.style.background = "#c5f2cc";
}

// --- Next Question / Progression ---
nextBtn.addEventListener("click", () => {
  const current = levelData[currentQuestion];
  if (current.selected === current.correctIndex) score++;
  currentQuestion++;
  if (currentQuestion < levelData.length) loadQuestion();
  else finishLevel();
});

// --- Finish Level ---
function finishLevel() {
  progressBar.style.width = "100%";
  const total = levelData.length;
  const percent = (score / total) * 100;

  quizContainer.classList.add("hidden");
  nextBtn.classList.add("hidden");
  resultContainer.classList.remove("hidden");
  restartBtn.classList.remove("hidden");

  let color = percent >= PASSING_SCORE ? "#d8f7d3" : "#f9d3d3";
  resultContainer.style.background = color;

  let feedback =
    percent >= 90
      ? "🌟 Excellent! You’ve mastered this level."
      : percent >= 70
      ? "✅ Great job! You passed this level."
      : "⚠️ Keep going! Try again for a higher score.";

  resultContainer.innerHTML = `
    <h2>Level ${currentLevel} Complete</h2>
    <h3>Your Score: ${score}/${total} (${Math.round(percent)}%)</h3>
    <p>${feedback}</p>
  `;

  if (percent >= VOLUNTEER_TRIGGER) showVolunteerPrompt();

  let tsaaScores = JSON.parse(localStorage.getItem("tsaaScores")) || {};
  tsaaScores[`level${currentLevel}`] = percent;
  localStorage.setItem("tsaaScores", JSON.stringify(tsaaScores));

  if (percent >= PASSING_SCORE && currentLevel < TOTAL_LEVELS) {
    resultContainer.innerHTML += `<button id="nextLevelBtn">Next Level</button>`;
    document.getElementById("nextLevelBtn").addEventListener("click", () => {
      currentLevel++;
      localStorage.setItem("tsaaLevel", currentLevel);
      loadLevel(currentLevel);
    });
  } else if (percent < PASSING_SCORE) {
    setTimeout(() => {
      if (confirm("Restart from Level 1?")) {
        resetQuiz();
      }
    }, 300);
  }
}

// --- Volunteer Prompt ---
function showVolunteerPrompt() {
  const overlay = document.createElement("div");
  overlay.id = "volunteerModal";
  overlay.innerHTML = `
    <div class="modal-content">
      <h3>🌿 Wow! You really understand all this!</h3>
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

// --- Safe Restart Logic ---
function resetQuiz() {
  try {
    localStorage.clear();
    currentLevel = 1;
    currentQuestion = 0;
    score = 0;
    quizContainer.innerHTML = "";
    resultContainer.classList.add("hidden");
    nextBtn.classList.add("hidden");
    restartBtn.classList.add("hidden");
    setTimeout(() => startQuiz(), 300);
  } catch (err) {
    console.error("Restart error:", err);
    alert("⚠️ Restart encountered a problem — reloading the page...");
    location.reload();
  }
}

// --- Manual Restart Button ---
restartBtn.addEventListener("click", resetQuiz);
