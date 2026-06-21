const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const elements = {
  introScreen: document.querySelector("#introScreen"),
  playScreen: document.querySelector("#playScreen"),
  summaryScreen: document.querySelector("#summaryScreen"),
  modeSelect: document.querySelector("#modeSelect"),
  modeBadge: document.querySelector("#modeBadge"),
  roundInstruction: document.querySelector("#roundInstruction"),
  scoreValue: document.querySelector("#scoreValue"),
  finalScoreValue: document.querySelector("#finalScoreValue"),
  activeHandValue: document.querySelector("#activeHandValue"),
  timerValue: document.querySelector("#timerValue"),
  trackingValue: document.querySelector("#trackingValue"),
  startButton: document.querySelector("#startButton"),
  endButton: document.querySelector("#endButton"),
  resetButton: document.querySelector("#resetButton"),
  demoButton: document.querySelector("#demoButton"),
  pointerDemoButton: document.querySelector("#pointerDemoButton"),
  cameraButton: document.querySelector("#cameraButton"),
  cameraStatus: document.querySelector("#cameraStatus"),
  cameraPreview: document.querySelector("#cameraPreview"),
  emptyState: document.querySelector("#emptyState"),
  diagnosisTitle: document.querySelector("#diagnosisTitle"),
  diagnosisText: document.querySelector("#diagnosisText"),
  preferenceValue: document.querySelector("#preferenceValue"),
  learnedValue: document.querySelector("#learnedValue"),
  leftUsage: document.querySelector("#leftUsage"),
  rightUsage: document.querySelector("#rightUsage"),
  leftSpeed: document.querySelector("#leftSpeed"),
  rightSpeed: document.querySelector("#rightSpeed"),
  leftAccuracy: document.querySelector("#leftAccuracy"),
  rightAccuracy: document.querySelector("#rightAccuracy"),
  leftQuality: document.querySelector("#leftQuality"),
  rightQuality: document.querySelector("#rightQuality"),
  leftPhysical: document.querySelector("#leftPhysical"),
  rightPhysical: document.querySelector("#rightPhysical"),
  leftGap: document.querySelector("#leftGap"),
  rightGap: document.querySelector("#rightGap"),
};

const HANDS = ["left", "right"];
const COLORS = ["#e2b714", "#8fcf69", "#ca4754", "#7aa2f7"];
const TARGET_LABEL = { left: "L", right: "R", either: "" };
const MODE_LABEL = {
  free: "free choice",
  forced: "forced hand",
  adaptive: "adaptive training",
};
const HAND_CONNECTIONS = [
  [0, 5],
  [5, 8],
  [0, 9],
  [9, 12],
  [0, 13],
  [13, 16],
  [0, 17],
  [17, 20],
  [5, 9],
  [9, 13],
  [13, 17],
];
const SESSION_SECONDS = 60;
const CAMERA_INFERENCE_MS = 50;

const state = {
  phase: "intro",
  running: false,
  score: 0,
  activeHand: "left",
  mode: "free",
  fruits: [],
  particles: [],
  pointer: null,
  pointerTrail: [],
  lastSpawnAt: 0,
  spawnEveryMs: 960,
  lastTime: performance.now(),
  sessionStartedAt: 0,
  forcedNextHand: "left",
  handOverrideUntil: 0,
  camera: {
    enabled: false,
    hands: null,
    cameraRunner: null,
    trackedHands: [],
    lastStatus: "camera off",
    lastSendAt: 0,
    lastTrackedAt: 0,
  },
  metrics: createMetrics(),
};

function createMetrics() {
  return {
    freeOpportunities: 0,
    left: createHandMetrics(),
    right: createHandMetrics(),
  };
}

function createHandMetrics() {
  return {
    freeChoices: 0,
    forcedOpportunities: 0,
    hits: 0,
    misses: 0,
    reactionTimes: [],
    velocities: [],
    directness: [],
    smoothness: [],
    range: [],
  };
}

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(420, Math.floor(rect.width * scale));
  canvas.height = Math.max(360, Math.floor(rect.height * scale));
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}

function showPhase(phase) {
  state.phase = phase;
  elements.introScreen.classList.toggle("hidden", phase !== "intro");
  elements.playScreen.classList.toggle("hidden", phase !== "play");
  elements.summaryScreen.classList.toggle("hidden", phase !== "summary");
  resizeCanvas();
}

function setActiveHand(hand, manual = true) {
  state.activeHand = hand;
  if (manual) state.handOverrideUntil = performance.now() + 1800;
  elements.activeHandValue.textContent = hand;
}

function setTrackedActiveHand(hand) {
  if (performance.now() < state.handOverrideUntil) return;
  setActiveHand(hand, false);
}

function startSession({ pointerOnly = false } = {}) {
  state.mode = elements.modeSelect.value;
  state.running = true;
  state.score = 0;
  state.fruits = [];
  state.particles = [];
  state.pointerTrail = [];
  state.lastSpawnAt = 0;
  state.sessionStartedAt = performance.now();
  state.metrics = createMetrics();
  elements.emptyState.classList.remove("hidden");
  elements.emptyState.querySelector("strong").textContent = pointerOnly ? "pointer demo" : "camera ready";
  elements.emptyState.querySelector("span").textContent = pointerOnly
    ? "move your pointer through fruit to slice"
    : "move your index finger through fruit to slice";
  elements.scoreValue.textContent = "0";
  elements.timerValue.textContent = String(SESSION_SECONDS);
  updateInstruction();
  showPhase("play");
}

async function startCameraSession() {
  const ok = await enableCamera();
  if (ok) startSession();
}

function endSession() {
  state.running = false;
  state.fruits = [];
  state.particles = [];
  renderSummary();
  showPhase("summary");
}

function resetMetrics() {
  state.score = 0;
  state.fruits = [];
  state.particles = [];
  state.pointerTrail = [];
  state.metrics = createMetrics();
  renderSummary();
}

function loadDemoPattern() {
  state.running = false;
  state.score = 180;
  const metrics = createMetrics();
  metrics.freeOpportunities = 20;
  metrics.left.freeChoices = 4;
  metrics.right.freeChoices = 16;

  metrics.left.forcedOpportunities = 10;
  metrics.left.hits = 8;
  metrics.left.misses = 2;
  metrics.left.reactionTimes = [690, 710, 740, 760, 780, 810, 820, 840];
  metrics.left.velocities = [720, 760, 810, 790, 830, 770, 800, 840];
  metrics.left.directness = [72, 76, 80, 78, 82, 75, 79, 81];
  metrics.left.smoothness = [68, 72, 74, 70, 76, 71, 73, 75];
  metrics.left.range = [66, 70, 72, 69, 73, 68, 71, 74];

  metrics.right.forcedOpportunities = 10;
  metrics.right.hits = 9;
  metrics.right.misses = 1;
  metrics.right.reactionTimes = [520, 540, 560, 570, 590, 610, 625, 650, 680];
  metrics.right.velocities = [880, 910, 930, 900, 960, 940, 920, 970, 950];
  metrics.right.directness = [84, 86, 88, 82, 87, 89, 85, 86, 88];
  metrics.right.smoothness = [82, 85, 86, 84, 87, 88, 83, 86, 87];
  metrics.right.range = [74, 78, 80, 76, 81, 79, 77, 80, 82];

  state.metrics = metrics;
  renderSummary();
}

async function enableCamera() {
  if (state.camera.enabled) return true;
  if (!navigator.mediaDevices?.getUserMedia) {
    setCameraStatus("camera unavailable", "warn");
    return false;
  }
  if (!window.Hands || !window.Camera) {
    setCameraStatus("mediapipe unavailable", "warn");
    return false;
  }

  try {
    setCameraStatus("starting camera", "active");
    const hands = new window.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 0,
      minDetectionConfidence: 0.65,
      minTrackingConfidence: 0.65,
    });
    hands.onResults(handleHandResults);

    const cameraRunner = new window.Camera(elements.cameraPreview, {
      width: 640,
      height: 480,
      onFrame: async () => {
        const now = performance.now();
        if (now - state.camera.lastSendAt < CAMERA_INFERENCE_MS) return;
        state.camera.lastSendAt = now;
        await hands.send({ image: elements.cameraPreview });
      },
    });

    await cameraRunner.start();
    state.camera.enabled = true;
    state.camera.hands = hands;
    state.camera.cameraRunner = cameraRunner;
    elements.cameraPreview.classList.add("active");
    setCameraStatus("camera ready", "active");
    return true;
  } catch (error) {
    setCameraStatus("camera failed", "warn");
    console.warn("Camera or MediaPipe failed:", error);
    return false;
  }
}

function handleHandResults(results) {
  const landmarks = results.multiHandLandmarks || [];
  const handedness = results.multiHandedness || [];
  state.camera.trackedHands = landmarks.map((handLandmarks, index) => {
    const label = handedness[index]?.label || "Unknown";
    const hand = normalizeHandedness(label);
    const point = landmarkToCanvasPoint(handLandmarks[8]);
    return {
      hand,
      point,
      landmarks: handLandmarks.map(landmarkToCanvasPoint),
      motion: distanceToLastPoint(hand, point),
    };
  });

  if (!state.camera.trackedHands.length) {
    setCameraStatus("no hand detected", "warn");
    elements.trackingValue.textContent = "no hand detected";
    return;
  }

  state.camera.lastTrackedAt = performance.now();
  const active = chooseActiveTrackedHand(state.camera.trackedHands);
  if (active) {
    setTrackedActiveHand(active.hand);
    updatePointerFromCamera(active.point);
  }

  const status = state.camera.trackedHands.length > 1
    ? "tracking both hands"
    : `tracking ${state.camera.trackedHands[0].hand}`;
  setCameraStatus(status, "active");
  elements.trackingValue.textContent = status;
}

function normalizeHandedness(label) {
  if (label === "Left") return "right";
  if (label === "Right") return "left";
  return state.activeHand;
}

function landmarkToCanvasPoint(landmark) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clamp((1 - landmark.x) * rect.width, 0, rect.width),
    y: clamp(landmark.y * rect.height, 0, rect.height),
    time: performance.now(),
  };
}

function distanceToLastPoint(hand, point) {
  const previous = state.camera.trackedHands.find((tracked) => tracked.hand === hand)?.point;
  if (!previous) return 0;
  return Math.hypot(point.x - previous.x, point.y - previous.y);
}

function chooseActiveTrackedHand(trackedHands) {
  if (trackedHands.length === 1) return trackedHands[0];
  const nearestFruit = state.fruits.find((fruit) => !fruit.sliced);
  if (nearestFruit) {
    return [...trackedHands].sort((a, b) => {
      const distanceA = Math.hypot(a.point.x - nearestFruit.x, a.point.y - nearestFruit.y);
      const distanceB = Math.hypot(b.point.x - nearestFruit.x, b.point.y - nearestFruit.y);
      return distanceA - distanceB;
    })[0];
  }
  return [...trackedHands].sort((a, b) => b.motion - a.motion)[0];
}

function updatePointerFromCamera(point) {
  updatePointerPoint({ ...point, time: performance.now() });
}

function updatePointerPoint(point) {
  state.pointer = point;
  state.pointerTrail.push(point);
  if (state.pointerTrail.length > 32) state.pointerTrail.shift();
}

function setCameraStatus(message, tone = "neutral") {
  state.camera.lastStatus = message;
  elements.cameraStatus.textContent = message;
  elements.cameraStatus.classList.toggle("active", tone === "active");
  elements.cameraStatus.classList.toggle("warn", tone === "warn");
}

function spawnFruit(now) {
  const rect = canvas.getBoundingClientRect();
  let targetHand = "either";

  if (state.mode === "forced") {
    targetHand = state.forcedNextHand;
    state.forcedNextHand = state.forcedNextHand === "left" ? "right" : "left";
  } else if (state.mode === "adaptive") {
    targetHand = chooseTrainingHand(summarizeMetrics());
  }

  if (targetHand === "either") state.metrics.freeOpportunities += 1;
  else state.metrics[targetHand].forcedOpportunities += 1;

  const bias = targetHand === "left" ? 0.34 : targetHand === "right" ? 0.66 : 0.5;
  state.fruits.push({
    id: crypto.randomUUID(),
    x: clamp(rect.width * (bias + randomBetween(-0.16, 0.16)), 58, rect.width - 58),
    y: rect.height + 42,
    vx: randomBetween(-48, 48),
    vy: randomBetween(-860, -700),
    radius: state.mode === "adaptive" ? randomBetween(36, 48) : randomBetween(30, 42),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    targetHand,
    spawnedAt: now,
    sliced: false,
  });
}

function chooseTrainingHand(summary) {
  const leftNeed = summary.left.gap + (100 - summary.left.physical) * 0.2;
  const rightNeed = summary.right.gap + (100 - summary.right.physical) * 0.2;
  if (Math.abs(leftNeed - rightNeed) < 8) return state.forcedNextHand;
  return leftNeed > rightNeed ? "left" : "right";
}

function updateInstruction() {
  elements.modeBadge.textContent = MODE_LABEL[state.mode];
  if (state.mode === "free") {
    elements.roundInstruction.textContent = "slice with either hand";
  } else if (state.mode === "forced") {
    elements.roundInstruction.textContent = "slice only L/R targets with that hand";
  } else {
    elements.roundInstruction.textContent = "adaptive targets support the side that needs work";
  }
}

function updateFruit(fruit, dt) {
  fruit.vy += 860 * dt;
  fruit.x += fruit.vx * dt;
  fruit.y += fruit.vy * dt;
}

function handleMisses() {
  const rect = canvas.getBoundingClientRect();
  state.fruits = state.fruits.filter((fruit) => {
    const missed = fruit.y - fruit.radius > rect.height + 20;
    if (missed && !fruit.sliced && fruit.targetHand !== "either") {
      state.metrics[fruit.targetHand].misses += 1;
    }
    return !missed && !fruit.sliced;
  });
}

function sliceFruit(fruit, point, now) {
  fruit.sliced = true;
  state.score += fruit.targetHand === "either" || fruit.targetHand === state.activeHand ? 10 : 2;
  elements.scoreValue.textContent = String(state.score);
  elements.emptyState.classList.add("hidden");

  const hand = state.activeHand;
  const handMetrics = state.metrics[hand];
  const movement = calculateMovementQuality(point);
  const validForcedHit = fruit.targetHand === "either" || fruit.targetHand === hand;

  if (fruit.targetHand === "either") {
    handMetrics.freeChoices += 1;
  } else if (validForcedHit) {
    handMetrics.hits += 1;
  } else {
    state.metrics[fruit.targetHand].misses += 1;
    handMetrics.misses += 1;
  }

  if (validForcedHit) {
    handMetrics.reactionTimes.push(now - fruit.spawnedAt);
    handMetrics.velocities.push(movement.velocity);
    handMetrics.directness.push(movement.directness);
    handMetrics.smoothness.push(movement.smoothness);
    handMetrics.range.push(movement.range);
  }

  addParticles(fruit);
}

function calculateMovementQuality(point) {
  const trail = state.pointerTrail.slice(-10);
  if (trail.length < 3) return { velocity: 0, directness: 70, smoothness: 70, range: 40 };

  let path = 0;
  let acceleration = 0;
  let velocitySum = 0;
  let velocityCount = 0;
  for (let i = 1; i < trail.length; i += 1) {
    const prev = trail[i - 1];
    const current = trail[i];
    const distance = Math.hypot(current.x - prev.x, current.y - prev.y);
    const dt = Math.max(16, current.time - prev.time) / 1000;
    const velocity = distance / dt;
    path += distance;
    velocitySum += velocity;
    velocityCount += 1;
    if (i > 1) {
      const before = trail[i - 2];
      const previousVelocity = Math.hypot(prev.x - before.x, prev.y - before.y) / Math.max(0.016, (prev.time - before.time) / 1000);
      acceleration += Math.abs(velocity - previousVelocity);
    }
  }

  const start = trail[0];
  const straight = Math.hypot(point.x - start.x, point.y - start.y);
  return {
    velocity: velocitySum / Math.max(1, velocityCount),
    directness: clamp((straight / Math.max(1, path)) * 100, 0, 100),
    smoothness: clamp(100 - acceleration / Math.max(1, trail.length - 2) / 24, 0, 100),
    range: clamp((path / Math.max(canvas.getBoundingClientRect().width, 1)) * 220, 0, 100),
  };
}

function addParticles(fruit) {
  for (let i = 0; i < 12; i += 1) {
    state.particles.push({
      x: fruit.x,
      y: fruit.y,
      vx: randomBetween(-190, 190),
      vy: randomBetween(-220, 110),
      life: randomBetween(0.32, 0.58),
      color: fruit.color,
      radius: randomBetween(3, 7),
    });
  }
}

function updateParticles(dt) {
  for (const particle of state.particles) {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 680 * dt;
  }
  state.particles = state.particles.filter((particle) => particle.life > 0);
}

function detectSlices(now) {
  if (!state.pointer) return;
  for (const fruit of state.fruits) {
    if (fruit.sliced) continue;
    if (Math.hypot(state.pointer.x - fruit.x, state.pointer.y - fruit.y) <= fruit.radius + 10) {
      sliceFruit(fruit, state.pointer, now);
    }
  }
}

function draw() {
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  if (state.phase !== "play") return;

  drawVignette(rect);
  drawTrackedHands();
  for (const fruit of state.fruits) drawFruit(fruit);
  for (const particle of state.particles) drawParticle(particle);
  drawTrail();
}

function drawVignette(rect) {
  ctx.save();
  const gradient = ctx.createRadialGradient(rect.width / 2, rect.height / 2, rect.width * 0.1, rect.width / 2, rect.height / 2, rect.width * 0.72);
  gradient.addColorStop(0, "rgba(17,17,17,0)");
  gradient.addColorStop(1, "rgba(17,17,17,0.55)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, rect.width, rect.height);
  ctx.restore();
}

function drawTrackedHands() {
  if (!state.camera.trackedHands.length) return;
  ctx.save();
  for (const tracked of state.camera.trackedHands) {
    const color = tracked.hand === "left" ? "#8fcf69" : "#e2b714";
    ctx.shadowBlur = 18;
    ctx.shadowColor = color;
    ctx.fillStyle = "rgba(17, 17, 17, 0.72)";
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(tracked.point.x, tracked.point.y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(tracked.point.x, tracked.point.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFruit(fruit) {
  ctx.save();
  ctx.translate(fruit.x, fruit.y);
  ctx.fillStyle = fruit.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, fruit.radius * 0.9, fruit.radius, -0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.beginPath();
  ctx.ellipse(-fruit.radius * 0.25, -fruit.radius * 0.3, fruit.radius * 0.2, fruit.radius * 0.13, -0.7, 0, Math.PI * 2);
  ctx.fill();

  if (fruit.targetHand !== "either") {
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(0, 0, fruit.radius * 0.46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = fruit.color;
    ctx.font = `900 ${Math.max(16, fruit.radius * 0.7)}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(TARGET_LABEL[fruit.targetHand], 0, 1);
  }
  ctx.restore();
}

function drawParticle(particle) {
  ctx.save();
  ctx.globalAlpha = clamp(particle.life / 0.58, 0, 1);
  ctx.fillStyle = particle.color;
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTrail() {
  const trail = state.pointerTrail.slice(-12);
  if (trail.length < 2) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 1; i < trail.length; i += 1) {
    const alpha = i / trail.length;
    ctx.strokeStyle = state.activeHand === "left" ? `rgba(143,207,105,${alpha})` : `rgba(226,183,20,${alpha})`;
    ctx.lineWidth = 3 + alpha * 6;
    ctx.beginPath();
    ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
    ctx.lineTo(trail[i].x, trail[i].y);
    ctx.stroke();
  }
  ctx.restore();
}

function loop(now) {
  const dt = Math.min(0.034, (now - state.lastTime) / 1000);
  state.lastTime = now;

  if (state.running) {
    const remaining = Math.max(0, SESSION_SECONDS - Math.floor((now - state.sessionStartedAt) / 1000));
    elements.timerValue.textContent = String(remaining);
    if (remaining <= 0) endSession();

    if (now - state.lastSpawnAt > state.spawnEveryMs * (state.mode === "adaptive" ? 1.15 : 1)) {
      spawnFruit(now);
      state.lastSpawnAt = now;
    }
    for (const fruit of state.fruits) updateFruit(fruit, dt);
    updateParticles(dt);
    detectSlices(now);
    handleMisses();
  }

  draw();
  requestAnimationFrame(loop);
}

function summarizeMetrics() {
  return {
    left: summarizeHand("left"),
    right: summarizeHand("right"),
  };
}

function summarizeHand(hand) {
  const metrics = state.metrics[hand];
  const usage = state.metrics.freeOpportunities ? (metrics.freeChoices / state.metrics.freeOpportunities) * 100 : 0;
  const avgReaction = average(metrics.reactionTimes);
  const speedFromReaction = avgReaction ? clamp(100 - ((avgReaction - 450) / 1550) * 100, 0, 100) : 0;
  const speedFromVelocity = clamp((average(metrics.velocities) / 950) * 100, 0, 100);
  const speed = metrics.reactionTimes.length ? speedFromReaction * 0.7 + speedFromVelocity * 0.3 : 0;
  const forcedAttempts = metrics.hits + metrics.misses;
  const accuracy = forcedAttempts ? (metrics.hits / forcedAttempts) * 100 : 0;
  const quality = metrics.directness.length
    ? average(metrics.directness) * 0.42 + average(metrics.smoothness) * 0.38 + average(metrics.range) * 0.2
    : 0;
  const physical = speed * 0.35 + accuracy * 0.35 + quality * 0.3;
  return { usage, speed, accuracy, quality, physical, gap: physical - usage };
}

function renderSummary() {
  const summary = summarizeMetrics();
  setMetricText("leftUsage", summary.left.usage);
  setMetricText("rightUsage", summary.right.usage);
  setMetricText("leftSpeed", summary.left.speed);
  setMetricText("rightSpeed", summary.right.speed);
  setMetricText("leftAccuracy", summary.left.accuracy);
  setMetricText("rightAccuracy", summary.right.accuracy);
  setMetricText("leftQuality", summary.left.quality);
  setMetricText("rightQuality", summary.right.quality);
  setMetricText("leftPhysical", summary.left.physical);
  setMetricText("rightPhysical", summary.right.physical);
  setMetricText("leftGap", summary.left.gap);
  setMetricText("rightGap", summary.right.gap);
  elements.finalScoreValue.textContent = String(state.score);

  const preference = inferPreference(summary);
  const learned = inferLearnedNonUse(summary);
  elements.preferenceValue.textContent = preference;
  elements.learnedValue.textContent = learned.label;
  elements.diagnosisTitle.textContent = learned.title;
  elements.diagnosisText.textContent = learned.text;
}

function inferPreference(summary) {
  const diff = summary.left.usage - summary.right.usage;
  if (state.metrics.freeOpportunities < 3) return "need data";
  if (Math.abs(diff) < 12) return "balanced";
  return diff > 0 ? "left hand" : "right hand";
}

function inferLearnedNonUse(summary) {
  const candidates = HANDS.map((hand) => ({ hand, ...summary[hand] })).filter(
    (item) => item.physical >= 55 && item.usage <= 42 && item.gap >= 22,
  );
  candidates.sort((a, b) => b.gap - a.gap);
  if (candidates.length) {
    const candidate = candidates[0];
    return {
      label: candidate.hand,
      title: `possible learned non-use: ${candidate.hand}`,
      text: `${candidate.hand} shows usable physical capability (${round(candidate.physical)}) but low voluntary use (${round(candidate.usage)}).`,
    };
  }
  if (state.metrics.freeOpportunities < 3) {
    return {
      label: "need data",
      title: "not enough session data",
      text: "Run a free-choice and forced-hand session to estimate preference and capability.",
    };
  }
  return {
    label: "not indicated",
    title: "no strong learned non-use signal",
    text: "Current usage and capability scores do not show a high capability plus low usage pattern.",
  };
}

function setMetricText(id, value) {
  elements[id].textContent = String(round(value));
}

function updatePointer(event) {
  if (shouldIgnoreMouseInput()) return;
  const rect = canvas.getBoundingClientRect();
  updatePointerPoint({
    x: clamp(event.clientX - rect.left, 0, rect.width),
    y: clamp(event.clientY - rect.top, 0, rect.height),
    time: performance.now(),
  });
}

function shouldIgnoreMouseInput() {
  return state.camera.enabled && performance.now() - state.camera.lastTrackedAt < 900;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value) {
  return Math.round(value);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

elements.cameraButton.addEventListener("click", startCameraSession);
elements.pointerDemoButton.addEventListener("click", () => startSession({ pointerOnly: true }));
elements.startButton.addEventListener("click", () => startSession({ pointerOnly: !state.camera.enabled }));
elements.endButton.addEventListener("click", endSession);
elements.resetButton.addEventListener("click", resetMetrics);
elements.demoButton.addEventListener("click", loadDemoPattern);
elements.modeSelect.addEventListener("change", () => {
  state.mode = elements.modeSelect.value;
  updateInstruction();
});

window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "l") setActiveHand("left");
  if (event.key.toLowerCase() === "r") setActiveHand("right");
});
canvas.addEventListener("pointermove", updatePointer);
canvas.addEventListener("pointerdown", (event) => {
  canvas.setPointerCapture(event.pointerId);
  updatePointer(event);
});
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
setActiveHand("left", false);
updateInstruction();
renderSummary();
requestAnimationFrame(loop);
