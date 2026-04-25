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
    targetCard: $('target-card'),
    gameBody: $('game-body'),
    colorCompare: $('color-compare'),
    similarityContainer: $('similarity-container'),
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
    // 2D Picker
    pickerContainer: $('picker-container'),
    pickerCanvas: $('picker-canvas'),
    pickerCursor: $('picker-cursor'),
    pickerHue: $('picker-hue'),
    hueCursor: $('hue-cursor'),
    // Flash
    targetFlash: $('target-flash'),
    flashCountdown: $('flash-countdown'),
  };

  // ─── State ─────────────────────────────────
  const TOTAL_ROUNDS = 10;
  let difficulty = 'easy';
  let currentRound = 0;
  let totalScore = 0;
  let roundScores = [];
  let targetRGB = { r: 0, g: 0, b: 0 };
  let timerInterval = null;
  let flashInterval = null;
  let timeLeft = 15;

  // Picker state (HSV)
  let currentHue = 0;       // 0-360
  let currentSat = 1;       // 0-1
  let currentVal = 1;       // 0-1
  let isDraggingPicker = false;
  let isDraggingHue = false;

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

  // ─── Color Utility ─────────────────────────
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

  function hsvToRGB(h, s, v) {
    h = ((h % 360) + 360) % 360;
    const c = v * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = v - c;
    let r1, g1, b1;
    if (h < 60)       { r1 = c; g1 = x; b1 = 0; }
    else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
    else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
    else if (h < 240) { r1 = 0; g1 = x; b1 = c; }
    else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
    else              { r1 = c; g1 = 0; b1 = x; }
    return {
      r: Math.round((r1 + m) * 255),
      g: Math.round((g1 + m) * 255),
      b: Math.round((b1 + m) * 255),
    };
  }

  function rgbToHSV(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === r) h = 60 * (((g - b) / d) % 6);
      else if (max === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
    }
    if (h < 0) h += 360;
    const s = max === 0 ? 0 : d / max;
    return { h, s, v: max };
  }

  function colorDistance(c1, c2) {
    const dr = c1.r - c2.r;
    const dg = c1.g - c2.g;
    const db = c1.b - c2.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  function distanceToScore(dist) {
    const maxDist = Math.sqrt(255 * 255 * 3);
    const raw = Math.max(0, 1 - dist / maxDist) * 100;
    return Math.round(raw);
  }

  // ─── 2D Color Picker ──────────────────────
  const pickerCtx = els.pickerCanvas.getContext('2d');
  const hueCtx = els.pickerHue.getContext('2d');

  function drawHueBar() {
    const w = els.pickerHue.width;
    const h = els.pickerHue.height;
    const gradient = hueCtx.createLinearGradient(0, 0, 0, h);
    const steps = [0, 0.17, 0.33, 0.5, 0.67, 0.83, 1];
    const colors = ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000'];
    steps.forEach((s, i) => gradient.addColorStop(s, colors[i]));
    hueCtx.fillStyle = gradient;
    hueCtx.fillRect(0, 0, w, h);
  }

  function drawPickerPlane() {
    const w = els.pickerCanvas.width;
    const h = els.pickerCanvas.height;
    const baseColor = hsvToRGB(currentHue, 1, 1);

    // Draw base hue
    pickerCtx.fillStyle = `rgb(${baseColor.r},${baseColor.g},${baseColor.b})`;
    pickerCtx.fillRect(0, 0, w, h);

    // White gradient (left to right = low sat to high sat — inverted: white on left)
    const whiteGrad = pickerCtx.createLinearGradient(0, 0, w, 0);
    whiteGrad.addColorStop(0, 'rgba(255,255,255,1)');
    whiteGrad.addColorStop(1, 'rgba(255,255,255,0)');
    pickerCtx.fillStyle = whiteGrad;
    pickerCtx.fillRect(0, 0, w, h);

    // Black gradient (top to bottom = high value to low value)
    const blackGrad = pickerCtx.createLinearGradient(0, 0, 0, h);
    blackGrad.addColorStop(0, 'rgba(0,0,0,0)');
    blackGrad.addColorStop(1, 'rgba(0,0,0,1)');
    pickerCtx.fillStyle = blackGrad;
    pickerCtx.fillRect(0, 0, w, h);
  }

  function resizePickerCanvas() {
    const wrap = els.pickerCanvas.parentElement;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w > 0 && h > 0) {
      els.pickerCanvas.width = w;
      els.pickerCanvas.height = h;
      drawPickerPlane();
      updatePickerCursor();
    }
  }

  function updatePickerCursor() {
    const wrap = els.pickerCanvas.parentElement;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    // sat = x (left=0, right=1)
    // val = y (top=1, bottom=0)
    const x = currentSat * w;
    const y = (1 - currentVal) * h;
    els.pickerCursor.style.left = x + 'px';
    els.pickerCursor.style.top = y + 'px';
  }

  function updateHueCursor() {
    const h = els.pickerHue.parentElement.clientHeight;
    const y = (currentHue / 360) * h;
    els.hueCursor.style.top = y + 'px';
  }

  function getPlayerRGB() {
    return hsvToRGB(currentHue, currentSat, currentVal);
  }

  function updatePlayerColor() {
    const rgb = getPlayerRGB();
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    els.playerColor.style.backgroundColor = hex;
    els.playerHex.textContent = hex;

    // Similarity (only show in easy mode)
    if (difficulty === 'easy') {
      const dist = colorDistance(rgb, targetRGB);
      const sim = distanceToScore(dist);
      els.similarityValue.textContent = sim + '%';
      els.similarityFill.style.width = sim + '%';

      if (sim > 0) {
        els.similarityFill.classList.add('has-value');
      } else {
        els.similarityFill.classList.remove('has-value');
      }

      if (sim >= 90) els.similarityValue.style.color = '#51cf66';
      else if (sim >= 70) els.similarityValue.style.color = '#fcc419';
      else els.similarityValue.style.color = '#ff6b6b';
    }
  }

  // ─── Picker Mouse/Touch Events ─────────────
  function handlePickerStart(e) {
    isDraggingPicker = true;
    handlePickerMove(e);
  }

  function handlePickerMove(e) {
    if (!isDraggingPicker) return;
    e.preventDefault();
    const rect = els.pickerCanvas.parentElement.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    currentSat = x;
    currentVal = 1 - y;
    updatePickerCursor();
    updatePlayerColor();
  }

  function handlePickerEnd() {
    isDraggingPicker = false;
  }

  function handleHueStart(e) {
    isDraggingHue = true;
    handleHueMove(e);
  }

  function handleHueMove(e) {
    if (!isDraggingHue) return;
    e.preventDefault();
    const rect = els.pickerHue.parentElement.getBoundingClientRect();
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    currentHue = y * 360;
    updateHueCursor();
    drawPickerPlane();
    updatePlayerColor();
  }

  function handleHueEnd() {
    isDraggingHue = false;
  }

  // Picker events
  const pickerWrap = els.pickerCanvas.parentElement;
  pickerWrap.addEventListener('mousedown', handlePickerStart);
  pickerWrap.addEventListener('touchstart', handlePickerStart, { passive: false });
  window.addEventListener('mousemove', handlePickerMove);
  window.addEventListener('touchmove', handlePickerMove, { passive: false });
  window.addEventListener('mouseup', handlePickerEnd);
  window.addEventListener('touchend', handlePickerEnd);

  // Hue events
  const hueWrap = els.pickerHue.parentElement;
  hueWrap.addEventListener('mousedown', handleHueStart);
  hueWrap.addEventListener('touchstart', handleHueStart, { passive: false });
  window.addEventListener('mousemove', handleHueMove);
  window.addEventListener('touchmove', handleHueMove, { passive: false });
  window.addEventListener('mouseup', handleHueEnd);
  window.addEventListener('touchend', handleHueEnd);

  // Init picker
  drawHueBar();
  drawPickerPlane();
  updatePickerCursor();
  updateHueCursor();

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
    const targetHex = rgbToHex(targetRGB.r, targetRGB.g, targetRGB.b);

    // Auto-set hue to target's correct hue; player only adjusts sat & val on the 2D plane
    const targetHSV = rgbToHSV(targetRGB.r, targetRGB.g, targetRGB.b);
    currentHue = targetHSV.h;
    currentSat = 0.5;
    currentVal = 0.5;
    drawPickerPlane();
    updatePickerCursor();
    updatePlayerColor();

    // Similarity bar: only visible in easy mode
    if (difficulty === 'easy') {
      els.similarityContainer.classList.remove('hidden');
    } else {
      els.similarityContainer.classList.add('hidden');
    }

    // Hard mode: fullscreen picker, hide cards, 3s flash
    if (difficulty === 'hard') {
      els.gameBody.classList.add('hard-mode');
      els.colorCompare.classList.add('hidden-hard');
      els.pickerContainer.classList.add('fullscreen-picker');
      els.targetCard.classList.add('target-hidden');
      els.targetHex.textContent = '???';
      showTargetFlash(targetHex);
    } else {
      els.gameBody.classList.remove('hard-mode');
      els.colorCompare.classList.remove('hidden-hard');
      els.pickerContainer.classList.remove('fullscreen-picker');
      els.targetCard.classList.remove('target-hidden');
      els.targetColor.style.backgroundColor = targetHex;
      els.targetHex.textContent = targetHex;

      // Timer for medium
      if (difficulty === 'medium') {
        els.timerContainer.classList.add('visible');
        timeLeft = 20;
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
  }

  // ─── Hard Mode: Fullscreen Flash ──────────
  function showTargetFlash(hexColor) {
    const flash = els.targetFlash;
    flash.style.backgroundColor = hexColor;

    // Determine if text should be light or dark
    const lum = (targetRGB.r * 0.299 + targetRGB.g * 0.587 + targetRGB.b * 0.114);
    const textColor = lum > 150 ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)';
    flash.querySelector('.flash-text').style.color = textColor;
    flash.querySelector('.flash-countdown').style.color = textColor;
    flash.querySelector('.flash-icon').style.filter = lum > 150 ? 'none' : 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))';

    flash.classList.add('active');

    let count = 3;
    els.flashCountdown.textContent = count;

    clearInterval(flashInterval);
    flashInterval = setInterval(() => {
      count--;
      els.flashCountdown.textContent = count;
      if (count <= 0) {
        clearInterval(flashInterval);
        flash.classList.remove('active');

        // Now show game screen with hidden target
        els.targetColor.style.backgroundColor = '#1a1a2e';
        showScreen('game');

        // Resize picker canvas for fullscreen after layout settles
        requestAnimationFrame(() => resizePickerCanvas());

        // Start timer for hard mode
        els.timerContainer.classList.add('visible');
        timeLeft = 20;
        els.timerText.textContent = timeLeft;
        els.timerRing.style.strokeDashoffset = '0';
        els.timerRing.classList.remove('danger');
        els.timerText.classList.remove('danger');
        startTimer();
      }
    }, 1000);

    showScreen('game');
  }

  function startTimer() {
    clearInterval(timerInterval);
    const totalTime = timeLeft;
    const circumference = 2 * Math.PI * 17;

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

  // ─── Submit ────────────────────────────────
  els.btnConfirm.addEventListener('click', submitAnswer);

  function submitAnswer() {
    clearInterval(timerInterval);
    clearInterval(flashInterval);
    els.targetFlash.classList.remove('active');

    // Cleanup hard mode fullscreen
    els.gameBody.classList.remove('hard-mode');
    els.colorCompare.classList.remove('hidden-hard');
    els.pickerContainer.classList.remove('fullscreen-picker');

    const playerRGB = getPlayerRGB();
    const dist = colorDistance(playerRGB, targetRGB);
    const score = distanceToScore(dist);

    roundScores.push(score);
    totalScore += score;

    showRoundResult(score, playerRGB);
  }

  // ─── Round Result ──────────────────────────
  function showRoundResult(score, playerRGB) {
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

    if (currentRound >= TOTAL_ROUNDS) {
      els.btnNext.textContent = '查看結果 🏆';
    } else {
      els.btnNext.textContent = '下一關 →';
    }

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

    els.finalStats.innerHTML = `
      <div class="stat-item"><span class="stat-value">${avgScore}</span><span class="stat-label">平均分</span></div>
      <div class="stat-item"><span class="stat-value">${bestRound}</span><span class="stat-label">最高分</span></div>
      <div class="stat-item"><span class="stat-value">${worstRound}</span><span class="stat-label">最低分</span></div>
      <div class="stat-item"><span class="stat-value">${TOTAL_ROUNDS}</span><span class="stat-label">總關數</span></div>
    `;

    showScreen('final');

    requestAnimationFrame(() => {
      const circumference = 2 * Math.PI * 52;
      const maxScore = TOTAL_ROUNDS * 100;
      const progress = totalScore / maxScore;
      els.finalRing.style.strokeDashoffset = (circumference * (1 - progress)).toString();
    });

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
