/* ==============================================
   調色大師 (Color Master) — Game Logic
   ============================================== */

(function () {
  'use strict';

  // ─── DOM refs ──────────────────────────────
  const $ = (id) => document.getElementById(id);

  const screens = {
    start: $('screen-start'),
    game: $('screen-game'),
    result: $('screen-result'),
    final: $('screen-final'),
  };

  const els = {
    btnStart: $('btn-start'),
    btnConfirm: $('btn-confirm'),
    btnNext: $('btn-next'),
    btnRestart: $('btn-restart'),
    roundBadge: $('round-badge'),
    totalScore: $('total-score'),
    targetColor: $('target-color'),
    playerColor: $('player-color'),
    targetHex: $('target-hex'),
    playerHex: $('player-hex'),
    sliderR: $('slider-r'),
    sliderG: $('slider-g'),
    sliderB: $('slider-b'),
    valR: $('val-r'),
    valG: $('val-g'),
    valB: $('val-b'),
    similarityFill: $('similarity-fill'),
    similarityValue: $('similarity-value'),
    timerContainer: $('timer-container'),
    timerRing: $('timer-ring'),
    timerText: $('timer-text'),
    resultEmoji: $('result-emoji'),
    resultScoreBig: $('result-score-big'),
    resultText: $('result-text'),
    resultTarget: $('result-target'),
    resultPlayer: $('result-player'),
    finalTrophy: $('final-trophy'),
    finalRing: $('final-ring'),
    finalScoreNum: $('final-score-num'),
    finalGrade: $('final-grade'),
    finalMessage: $('final-message'),
    finalStats: $('final-stats'),
    slidersContainer: $('sliders-container'),
  };

  // ─── State ─────────────────────────────────
  const TOTAL_ROUNDS = 10;
  let difficulty = 'easy'; // easy | medium | hard
  let currentRound = 0;
  let totalScore = 0;
  let roundScores = [];
  let targetRGB = { r: 0, g: 0, b: 0 };
  let timerInterval = null;
  let timeLeft = 15;

  // ─── Background Particles ──────────────────
  const bgCanvas = $('bg-canvas');
  const ctx = bgCanvas.getContext('2d');
  let particles = [];

  function resizeCanvas() {
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
  }

  function createParticles() {
    particles = [];
    const count = Math.floor((bgCanvas.width * bgCanvas.height) / 12000);
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * bgCanvas.width,
        y: Math.random() * bgCanvas.height,
        r: Math.random() * 2 + 0.5,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.3,
        alpha: Math.random() * 0.3 + 0.05,
        hue: Math.random() * 360,
      });
    }
  }

  function drawParticles() {
    ctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);

    // Subtle gradient background
    const grad = ctx.createRadialGradient(
      bgCanvas.width / 2, bgCanvas.height / 2, 0,
      bgCanvas.width / 2, bgCanvas.height / 2, bgCanvas.width * 0.7
    );
    grad.addColorStop(0, '#111327');
    grad.addColorStop(1, '#0c0e1a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

    for (const p of particles) {
      p.x += p.dx;
      p.y += p.dy;
      if (p.x < 0) p.x = bgCanvas.width;
      if (p.x > bgCanvas.width) p.x = 0;
      if (p.y < 0) p.y = bgCanvas.height;
      if (p.y > bgCanvas.height) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 60%, 70%, ${p.alpha})`;
      ctx.fill();
    }

    requestAnimationFrame(drawParticles);
  }

  resizeCanvas();
  createParticles();
  drawParticles();
  window.addEventListener('resize', () => {
    resizeCanvas();
    createParticles();
  });

  // ─── Utility ───────────────────────────────
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0').toUpperCase()).join('');
  }

  function randomRGB() {
    return {
      r: Math.floor(Math.random() * 256),
      g: Math.floor(Math.random() * 256),
      b: Math.floor(Math.random() * 256),
    };
  }

  /** CIE76 ΔE approximation (using sRGB → Lab shortcut) */
  function colorDistance(c1, c2) {
    // Simple Euclidean in sRGB — good enough for a game
    const dr = c1.r - c2.r;
    const dg = c1.g - c2.g;
    const db = c1.b - c2.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  /** Convert distance (max ~441.67) to a 0–100 similarity score */
  function distanceToScore(dist) {
    const maxDist = Math.sqrt(255 * 255 * 3);
    const raw = Math.max(0, 1 - dist / maxDist) * 100;
    return Math.round(raw);
  }

  // ─── Screen Management ─────────────────────
  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  // ─── Difficulty ────────────────────────────
  document.querySelectorAll('.btn-difficulty').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-difficulty').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      difficulty = btn.dataset.difficulty;
    });
  });

  // ─── Start Game ────────────────────────────
  els.btnStart.addEventListener('click', () => {
    currentRound = 0;
    totalScore = 0;
    roundScores = [];
    els.totalScore.textContent = '0';
    startRound();
  });

  // ─── Round Logic ───────────────────────────
  function startRound() {
    currentRound++;
    els.roundBadge.textContent = `第 ${currentRound} 關`;
    els.totalScore.textContent = totalScore;

    // Generate target
    targetRGB = randomRGB();
    els.targetColor.style.backgroundColor = rgbToHex(targetRGB.r, targetRGB.g, targetRGB.b);

    // Show / hide hex hint in hard mode
    if (difficulty === 'hard') {
      els.targetHex.textContent = '???';
    } else {
      els.targetHex.textContent = rgbToHex(targetRGB.r, targetRGB.g, targetRGB.b);
    }

    // Reset sliders
    els.sliderR.value = 128;
    els.sliderG.value = 128;
    els.sliderB.value = 128;
    updatePlayerColor();

    // Timer
    if (difficulty === 'medium' || difficulty === 'hard') {
      els.timerContainer.classList.add('visible');
      timeLeft = difficulty === 'hard' ? 10 : 15;
      els.timerText.textContent = timeLeft;
      els.timerRing.style.strokeDashoffset = '0';
      els.timerRing.classList.remove('danger');
      els.timerText.classList.remove('danger');
      startTimer();
    } else {
      els.timerContainer.classList.remove('visible');
    }

    showScreen('game');
  }

  function startTimer() {
    clearInterval(timerInterval);
    const totalTime = timeLeft;
    const circumference = 2 * Math.PI * 17; // r=17

    timerInterval = setInterval(() => {
      timeLeft--;
      els.timerText.textContent = timeLeft;
      const progress = 1 - timeLeft / totalTime;
      els.timerRing.style.strokeDashoffset = (progress * circumference).toString();

      if (timeLeft <= 5) {
        els.timerRing.classList.add('danger');
        els.timerText.classList.add('danger');
      }

      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        submitAnswer();
      }
    }, 1000);
  }

  // ─── Slider Updates ────────────────────────
  function updatePlayerColor() {
    const r = parseInt(els.sliderR.value);
    const g = parseInt(els.sliderG.value);
    const b = parseInt(els.sliderB.value);

    els.valR.textContent = r;
    els.valG.textContent = g;
    els.valB.textContent = b;

    const hex = rgbToHex(r, g, b);
    els.playerColor.style.backgroundColor = hex;
    els.playerHex.textContent = hex;

    // Similarity
    const dist = colorDistance({ r, g, b }, targetRGB);
    const sim = distanceToScore(dist);
    els.similarityValue.textContent = sim + '%';
    els.similarityFill.style.width = sim + '%';

    if (sim > 0) {
      els.similarityFill.classList.add('has-value');
    } else {
      els.similarityFill.classList.remove('has-value');
    }

    // Color the similarity text
    if (sim >= 90) {
      els.similarityValue.style.color = '#51cf66';
    } else if (sim >= 70) {
      els.similarityValue.style.color = '#fcc419';
    } else {
      els.similarityValue.style.color = '#ff6b6b';
    }
  }

  els.sliderR.addEventListener('input', updatePlayerColor);
  els.sliderG.addEventListener('input', updatePlayerColor);
  els.sliderB.addEventListener('input', updatePlayerColor);

  // ─── Submit ────────────────────────────────
  els.btnConfirm.addEventListener('click', submitAnswer);

  function submitAnswer() {
    clearInterval(timerInterval);

    const r = parseInt(els.sliderR.value);
    const g = parseInt(els.sliderG.value);
    const b = parseInt(els.sliderB.value);
    const playerRGB = { r, g, b };

    const dist = colorDistance(playerRGB, targetRGB);
    const score = distanceToScore(dist);

    roundScores.push(score);
    totalScore += score;

    showRoundResult(score, playerRGB);
  }

  // ─── Round Result ──────────────────────────
  function showRoundResult(score, playerRGB) {
    // Emoji & text
    let emoji, text;
    if (score >= 95) { emoji = '🤩'; text = '完美！你是色彩天才！'; }
    else if (score >= 85) { emoji = '🎯'; text = '太厲害了！'; }
    else if (score >= 70) { emoji = '😊'; text = '不錯喔！'; }
    else if (score >= 50) { emoji = '🤔'; text = '還可以，繼續努力！'; }
    else { emoji = '😅'; text = '差了一點點...'; }

    els.resultEmoji.textContent = emoji;
    els.resultScoreBig.textContent = score;
    els.resultText.textContent = text;
    els.resultTarget.style.backgroundColor = rgbToHex(targetRGB.r, targetRGB.g, targetRGB.b);
    els.resultPlayer.style.backgroundColor = rgbToHex(playerRGB.r, playerRGB.g, playerRGB.b);

    // Button text
    if (currentRound >= TOTAL_ROUNDS) {
      els.btnNext.textContent = '查看結果 🏆';
    } else {
      els.btnNext.textContent = '下一關 →';
    }

    // Confetti for high score
    if (score >= 85) {
      spawnConfetti();
    }

    showScreen('result');
  }

  // ─── Next Round / Final ────────────────────
  els.btnNext.addEventListener('click', () => {
    if (currentRound >= TOTAL_ROUNDS) {
      showFinalScreen();
    } else {
      startRound();
    }
  });

  // ─── Final Screen ──────────────────────────
  function showFinalScreen() {
    const avgScore = Math.round(totalScore / TOTAL_ROUNDS);
    const bestRound = Math.max(...roundScores);
    const worstRound = Math.min(...roundScores);

    // Grade
    let grade, trophy, message;
    if (avgScore >= 95) { grade = 'S+'; trophy = '👑'; message = '傳說級調色大師！無人能敵！'; }
    else if (avgScore >= 90) { grade = 'S'; trophy = '🏆'; message = '你是真正的調色大師！'; }
    else if (avgScore >= 80) { grade = 'A'; trophy = '🥇'; message = '色彩感知力超群！'; }
    else if (avgScore >= 70) { grade = 'B'; trophy = '🥈'; message = '表現不錯，繼續精進！'; }
    else if (avgScore >= 55) { grade = 'C'; trophy = '🥉'; message = '還有進步空間哦！'; }
    else { grade = 'D'; trophy = '💪'; message = '多練習幾次就會進步！'; }

    els.finalTrophy.textContent = trophy;
    els.finalScoreNum.textContent = totalScore;
    els.finalGrade.textContent = grade;
    els.finalMessage.textContent = message;

    // Stats
    els.finalStats.innerHTML = `
      <div class="stat-item"><span class="stat-value">${avgScore}</span><span class="stat-label">平均分</span></div>
      <div class="stat-item"><span class="stat-value">${bestRound}</span><span class="stat-label">最高分</span></div>
      <div class="stat-item"><span class="stat-value">${worstRound}</span><span class="stat-label">最低分</span></div>
      <div class="stat-item"><span class="stat-value">${TOTAL_ROUNDS}</span><span class="stat-label">總關數</span></div>
    `;

    showScreen('final');

    // Animate ring
    requestAnimationFrame(() => {
      const circumference = 2 * Math.PI * 52;
      const maxScore = TOTAL_ROUNDS * 100;
      const progress = totalScore / maxScore;
      els.finalRing.style.strokeDashoffset = (circumference * (1 - progress)).toString();
    });

    // Big confetti
    if (avgScore >= 80) {
      for (let i = 0; i < 3; i++) {
        setTimeout(() => spawnConfetti(40), i * 300);
      }
    }
  }

  // ─── Restart ───────────────────────────────
  els.btnRestart.addEventListener('click', () => {
    showScreen('start');
  });

  // ─── Confetti ──────────────────────────────
  function spawnConfetti(count = 25) {
    const colors = ['#7c5cfc', '#a78bfa', '#fcc419', '#ff6b6b', '#51cf66', '#339af0', '#ff922b', '#e599f7'];
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'confetti';
      el.style.left = Math.random() * 100 + 'vw';
      el.style.top = -10 + 'px';
      el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      el.style.width = (Math.random() * 8 + 5) + 'px';
      el.style.height = (Math.random() * 8 + 5) + 'px';
      el.style.animationDuration = (Math.random() * 1 + 0.8) + 's';
      el.style.animationDelay = (Math.random() * 0.5) + 's';
      el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      document.body.appendChild(el);
      el.addEventListener('animationend', () => el.remove());
    }
  }

  // ─── Keyboard shortcut ─────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (screens.start.classList.contains('active')) {
        els.btnStart.click();
      } else if (screens.game.classList.contains('active')) {
        els.btnConfirm.click();
      } else if (screens.result.classList.contains('active')) {
        els.btnNext.click();
      } else if (screens.final.classList.contains('active')) {
        els.btnRestart.click();
      }
    }
  });
})();
