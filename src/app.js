const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const elements = {
  modeSelect: document.querySelector("#modeSelect"),
  modeBadge: document.querySelector("#modeBadge"),
  roundInstruction: document.querySelector("#roundInstruction"),
  scoreValue: document.querySelector("#scoreValue"),
  startButton: document.querySelector("#startButton"),
  resetButton: document.querySelector("#resetButton"),
  demoButton: document.querySelector("#demoButton"),
  cameraButton: document.querySelector("#cameraButton"),
  cameraStatus: document.querySelector("#cameraStatus"),
  cameraPreview: document.querySelector("#cameraPreview"),
  leftHandButton: document.querySelector("#leftHandButton"),
  rightHandButton: document.querySelector("#rightHandButton"),
  emptyState: document.querySelector("#emptyState"),
  diagnosisCard: document.querySelector("#diagnosisCard"),
  diagnosisTitle: document.querySelector("#diagnosisTitle"),
  diagnosisText: document.querySelector("#diagnosisText"),
  preferenceValue: document.querySelector("#preferenceValue"),
  learnedValue: document.querySelector("#learnedValue"),
  eventLog: document.querySelector("#eventLog"),
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
const COLORS = ["#ef476f", "#f9b437", "#0f8a5f", "#118ab2", "#8d5a97"];
const TARGET_LABEL = { left: "L", right: "R", either: "" };
const MODE_LABEL = {
  free: "Free Choice",
  forced: "Forced Hand",
  adaptive: "Adaptive Training",
};
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const state = {
  running: false,
  score: 0,
  activeHand: "left",
  mode: "free",
  fruits: [],
  particles: [],
  pointer: null,
  pointerTrail: [],
  lastSpawnAt: 0,
  spawnEveryMs: 920,
  lastTime: performance.now(),
  forcedNextHand: "left",
  handOverrideUntil: 0,
  camera: {
    enabled: false,
    hands: null,
    cameraRunner: null,
    trackedHands: [],
    lastStatus: "Camera off",
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

function setActiveHand(hand) {
  state.activeHand = hand;
  state.handOverrideUntil = performance.now() + 1800;
  elements.leftHandButton.classList.toggle("active", hand === "left");
  elements.rightHandButton.classList.toggle("active", hand === "right");
}

function setTrackedActiveHand(hand) {
  if (performance.now() < state.handOverrideUntil) return;
  state.activeHand = hand;
  elements.leftHandButton.classList.toggle("active", hand === "left");
  elements.rightHandButton.classList.toggle("active", hand === "right");
}

function startSession() {
  state.running = true;
  state.fruits = [];
  state.particles = [];
  state.score = 0;
  state.lastSpawnAt = 0;
  elements.emptyState.classList.add("hidden");
  elements.startButton.textContent = "Restart session";
  logEvent(`Started ${MODE_LABEL[state.mode]} mode.`);
  updateInstruction();
  updateAnalytics();
}

function resetMetrics() {
  state.score = 0;
  state.fruits = [];
  state.particles = [];
  state.pointerTrail = [];
  state.metrics = createMetrics();
  updateAnalytics();
  logEvent("Metrics reset.");
}

function loadDemoPattern() {
  state.running = false;
  state.fruits = [];
  state.particles = [];
  state.score = 180;
  elements.emptyState.classList.remove("hidden");
  elements.emptyState.querySelector("strong").textContent = "Demo pattern loaded";
  elements.emptyState.querySelector("span").textContent = "Left has capability but low voluntary usage.";

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
  updateAnalytics();
  logEvent("Loaded demo: possible left learned non-use pattern.");
}

async function enableCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    logEvent("Camera API is not available in this browser.");
    setCameraStatus("Camera unavailable", "warn");
    return;
  }

  if (!window.Hands || !window.Camera) {
    logEvent("MediaPipe unavailable. Check internet/CDN access; pointer and touch still work.");
    setCameraStatus("MediaPipe unavailable", "warn");
    return;
  }

  try {
    setCameraStatus("Starting camera...", "active");
    const hands = new window.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.65,
      minTrackingConfidence: 0.65,
    });
    hands.onResults(handleHandResults);

    const cameraRunner = new window.Camera(elements.cameraPreview, {
      width: 960,
      height: 540,
      onFrame: async () => {
        await hands.send({ image: elements.cameraPreview });
      },
    });

    await cameraRunner.start();
    state.camera.enabled = true;
    state.camera.hands = hands;
    state.camera.cameraRunner = cameraRunner;
    elements.cameraPreview.classList.add("active");
    elements.cameraButton.textContent = "Camera enabled";
    elements.cameraButton.disabled = true;
    setCameraStatus("Camera ready", "active");
    logEvent("Camera ready. MediaPipe hand tracking started.");
  } catch (error) {
    logEvent(`Camera or MediaPipe failed: ${error.message}`);
    setCameraStatus("Camera failed", "warn");
  }
}

function handleHandResults(results) {
  const landmarks = results.multiHandLandmarks || [];
  const handedness = results.multiHandedness || [];
  state.camera.trackedHands = landmarks.map((handLandmarks, index) => {
    const label = handedness[index]?.label || "Unknown";
    const hand = normalizeHandedness(label);
    const point = landmarkToCanvasPoint(handLandmarks[8]);
    const wrist = landmarkToCanvasPoint(handLandmarks[0]);
    return {
      hand,
      label,
      landmarks: handLandmarks.map(landmarkToCanvasPoint),
      point,
      wrist,
      motion: distanceToLastPoint(hand, point),
    };
  });

  if (!state.camera.trackedHands.length) {
    setCameraStatus("No hand detected", "warn");
    return;
  }

  const active = chooseActiveTrackedHand(state.camera.trackedHands);
  if (active) {
    setTrackedActiveHand(active.hand);
    updatePointerFromCamera(active.point);
  }

  const status = state.camera.trackedHands.length > 1
    ? "Tracking both hands"
    : `Tracking ${state.camera.trackedHands[0].hand}`;
  setCameraStatus(status, "active");
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
  const cameraPoint = { ...point, time: performance.now() };
  state.pointer = cameraPoint;
  state.pointerTrail.push(cameraPoint);
  if (state.pointerTrail.length > 40) state.pointerTrail.shift();
}

function setCameraStatus(message, tone = "neutral") {
  if (state.camera.lastStatus !== message) {
    state.camera.lastStatus = message;
    if (message.startsWith("Tracking")) logEvent(`${message} from camera.`);
  }
  elements.cameraStatus.textContent = message;
  elements.cameraStatus.classList.toggle("active", tone === "active");
  elements.cameraStatus.classList.toggle("warn", tone === "warn");
}

function spawnFruit(now) {
  const rect = canvas.getBoundingClientRect();
  const mode = state.mode;
  let targetHand = "either";

  if (mode === "forced") {
    targetHand = state.forcedNextHand;
    state.forcedNextHand = state.forcedNextHand === "left" ? "right" : "left";
  }

  if (mode === "adaptive") {
    const summary = summarizeMetrics();
    targetHand = chooseTrainingHand(summary);
  }

  if (targetHand === "either") {
    state.metrics.freeOpportunities += 1;
  } else {
    state.metrics[targetHand].forcedOpportunities += 1;
  }

  const weakerBias = targetHand === "left" ? 0.36 : targetHand === "right" ? 0.64 : 0.5;
  const x = clamp(rect.width * (weakerBias + randomBetween(-0.17, 0.17)), 58, rect.width - 58);
  const fruit = {
    id: crypto.randomUUID(),
    x,
    y: rect.height + 42,
    vx: randomBetween(-55, 55),
    vy: randomBetween(-640, -510),
    radius: mode === "adaptive" ? randomBetween(34, 46) : randomBetween(28, 40),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    targetHand,
    spawnedAt: now,
    sliced: false,
    peak: randomBetween(rect.height * 0.12, rect.height * 0.38),
  };
  state.fruits.push(fruit);
  updateInstruction();
}

function chooseTrainingHand(summary) {
  const leftNeed = summary.left.gap + (100 - summary.left.physical) * 0.2;
  const rightNeed = summary.right.gap + (100 - summary.right.physical) * 0.2;
  if (Math.abs(leftNeed - rightNeed) < 8) return state.forcedNextHand;
  return leftNeed > rightNeed ? "left" : "right";
}

function updateInstruction() {
  if (state.mode === "free") {
    elements.roundInstruction.textContent = "Slice fruit with either hand. We track voluntary hand choice.";
  } else if (state.mode === "forced") {
    elements.roundInstruction.textContent = "Slice only fruit marked L or R with that hand.";
  } else {
    elements.roundInstruction.textContent = "Targets bias toward the side that needs more training support.";
  }
  elements.modeBadge.textContent = MODE_LABEL[state.mode];
}

function updateFruit(fruit, dt) {
  const gravity = 980;
  fruit.vy += gravity * dt;
  fruit.x += fruit.vx * dt;
  fruit.y += fruit.vy * dt;
}

function handleMisses() {
  const rect = canvas.getBoundingClientRect();
  const remaining = [];

  for (const fruit of state.fruits) {
    const missed = fruit.y - fruit.radius > rect.height + 20;
    if (missed && !fruit.sliced && fruit.targetHand !== "either") {
      state.metrics[fruit.targetHand].misses += 1;
      logEvent(`${capitalize(fruit.targetHand)} forced target missed.`);
    }
    if (!missed && !fruit.sliced) remaining.push(fruit);
  }

  state.fruits = remaining;
}

function sliceFruit(fruit, point, now) {
  fruit.sliced = true;
  state.score += fruit.targetHand === "either" || fruit.targetHand === state.activeHand ? 10 : 2;

  const hand = state.activeHand;
  const handMetrics = state.metrics[hand];
  const reactionMs = now - fruit.spawnedAt;
  const movement = calculateMovementQuality(point);
  const validForcedHit = fruit.targetHand === "either" || fruit.targetHand === hand;

  if (fruit.targetHand === "either") {
    handMetrics.freeChoices += 1;
  } else if (validForcedHit) {
    handMetrics.hits += 1;
  } else {
    state.metrics[fruit.targetHand].misses += 1;
    handMetrics.misses += 1;
    logEvent(`Wrong hand used: ${capitalize(hand)} on ${capitalize(fruit.targetHand)} target.`);
  }

  if (validForcedHit) {
    handMetrics.reactionTimes.push(reactionMs);
    handMetrics.velocities.push(movement.velocity);
    handMetrics.directness.push(movement.directness);
    handMetrics.smoothness.push(movement.smoothness);
    handMetrics.range.push(movement.range);
  }

  addParticles(fruit);
  logEvent(
    `${capitalize(hand)} sliced ${fruit.targetHand === "either" ? "free" : fruit.targetHand} target in ${Math.round(
      reactionMs,
    )} ms.`,
  );
  updateAnalytics();
}

function calculateMovementQuality(point) {
  const trail = state.pointerTrail.slice(-12);
  if (trail.length < 3) {
    return { velocity: 0, directness: 70, smoothness: 70, range: 40 };
  }

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
  const end = point;
  const straight = Math.hypot(end.x - start.x, end.y - start.y);
  const directness = clamp((straight / Math.max(1, path)) * 100, 0, 100);
  const smoothness = clamp(100 - acceleration / Math.max(1, trail.length - 2) / 24, 0, 100);
  const range = clamp((path / Math.max(canvas.getBoundingClientRect().width, 1)) * 220, 0, 100);
  const velocity = velocitySum / Math.max(1, velocityCount);

  return { velocity, directness, smoothness, range };
}

function addParticles(fruit) {
  for (let i = 0; i < 16; i += 1) {
    state.particles.push({
      x: fruit.x,
      y: fruit.y,
      vx: randomBetween(-220, 220),
      vy: randomBetween(-260, 120),
      life: randomBetween(0.35, 0.65),
      color: fruit.color,
      radius: randomBetween(3, 8),
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
  const point = state.pointer;

  for (const fruit of state.fruits) {
    if (fruit.sliced) continue;
    const distance = Math.hypot(point.x - fruit.x, point.y - fruit.y);
    if (distance <= fruit.radius + 10) {
      sliceFruit(fruit, point, now);
    }
  }
}

function draw() {
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);

  drawGuide(rect);
  drawTrackedHands();
  for (const fruit of state.fruits) drawFruit(fruit);
  for (const particle of state.particles) drawParticle(particle);
  drawTrail();
}

function drawTrackedHands() {
  if (!state.camera.trackedHands.length) return;

  ctx.save();
  for (const tracked of state.camera.trackedHands) {
    const color = tracked.hand === "left" ? "#0f8a5f" : "#b84f18";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;

    for (const [startIndex, endIndex] of HAND_CONNECTIONS) {
      const start = tracked.landmarks[startIndex];
      const end = tracked.landmarks[endIndex];
      if (!start || !end) continue;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }

    for (const landmark of tracked.landmarks) {
      ctx.beginPath();
      ctx.arc(landmark.x, landmark.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(tracked.point.x, tracked.point.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawGuide(rect) {
  ctx.save();
  ctx.strokeStyle = "rgba(23, 32, 25, 0.08)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 10]);
  ctx.beginPath();
  ctx.moveTo(rect.width / 2, 0);
  ctx.lineTo(rect.width / 2, rect.height);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(23, 32, 25, 0.42)";
  ctx.font = "700 13px Inter, sans-serif";
  ctx.fillText("LEFT SPACE", 18, 28);
  ctx.textAlign = "right";
  ctx.fillText("RIGHT SPACE", rect.width - 18, 28);
  ctx.restore();
}

function drawFruit(fruit) {
  ctx.save();
  ctx.translate(fruit.x, fruit.y);
  ctx.fillStyle = fruit.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, fruit.radius * 0.92, fruit.radius, -0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.beginPath();
  ctx.ellipse(-fruit.radius * 0.28, -fruit.radius * 0.3, fruit.radius * 0.22, fruit.radius * 0.14, -0.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#5d3b1f";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(2, -fruit.radius + 4);
  ctx.quadraticCurveTo(8, -fruit.radius - 12, 18, -fruit.radius - 10);
  ctx.stroke();

  if (fruit.targetHand !== "either") {
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.beginPath();
    ctx.arc(0, 0, fruit.radius * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = fruit.targetHand === "left" ? "#076846" : "#b84f18";
    ctx.font = `800 ${Math.max(16, fruit.radius * 0.7)}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(TARGET_LABEL[fruit.targetHand], 0, 1);
  }

  ctx.restore();
}

function drawParticle(particle) {
  ctx.save();
  ctx.globalAlpha = clamp(particle.life / 0.6, 0, 1);
  ctx.fillStyle = particle.color;
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTrail() {
  const trail = state.pointerTrail.slice(-14);
  if (trail.length < 2) return;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 1; i < trail.length; i += 1) {
    const alpha = i / trail.length;
    ctx.strokeStyle = state.activeHand === "left" ? `rgba(15, 138, 95, ${alpha})` : `rgba(184, 79, 24, ${alpha})`;
    ctx.lineWidth = 3 + alpha * 7;
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
    const adaptiveModifier = state.mode === "adaptive" ? 1.18 : 1;
    if (now - state.lastSpawnAt > state.spawnEveryMs * adaptiveModifier) {
      spawnFruit(now);
      state.lastSpawnAt = now;
    }

    for (const fruit of state.fruits) updateFruit(fruit, dt);
    updateParticles(dt);
    detectSlices(now);
    handleMisses();
  }

  draw();
  elements.scoreValue.textContent = String(state.score);
  requestAnimationFrame(loop);
}

function summarizeMetrics() {
  const left = summarizeHand("left");
  const right = summarizeHand("right");
  return { left, right };
}

function summarizeHand(hand) {
  const metrics = state.metrics[hand];
  const usage = state.metrics.freeOpportunities
    ? (metrics.freeChoices / state.metrics.freeOpportunities) * 100
    : 0;
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
  const gap = physical - usage;
  return {
    usage,
    speed,
    accuracy,
    quality,
    physical,
    gap,
    hits: metrics.hits,
    misses: metrics.misses,
  };
}

function updateAnalytics() {
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

  const preference = inferPreference(summary);
  const learned = inferLearnedNonUse(summary);
  elements.preferenceValue.textContent = preference;
  elements.learnedValue.textContent = learned.label;
  elements.diagnosisCard.classList.toggle("warn", learned.hand !== null);
  elements.diagnosisCard.classList.toggle("ok", learned.hand === null && state.metrics.freeOpportunities > 0);
  elements.diagnosisTitle.textContent = learned.title;
  elements.diagnosisText.textContent = learned.text;
}

function inferPreference(summary) {
  const diff = summary.left.usage - summary.right.usage;
  if (state.metrics.freeOpportunities < 3) return "Need data";
  if (Math.abs(diff) < 12) return "Balanced";
  return diff > 0 ? "Left hand" : "Right hand";
}

function inferLearnedNonUse(summary) {
  const candidates = HANDS.map((hand) => ({ hand, ...summary[hand] })).filter(
    (item) => item.physical >= 55 && item.usage <= 42 && item.gap >= 22,
  );
  candidates.sort((a, b) => b.gap - a.gap);

  if (candidates.length) {
    const candidate = candidates[0];
    return {
      hand: candidate.hand,
      label: capitalize(candidate.hand),
      title: `Possible learned non-use tendency: ${capitalize(candidate.hand)}`,
      text: `${capitalize(candidate.hand)} shows usable physical capability (${round(
        candidate.physical,
      )}) but low voluntary use (${round(candidate.usage)}). This is a screening signal, not a diagnosis.`,
    };
  }

  if (state.metrics.freeOpportunities < 3) {
    return {
      hand: null,
      label: "Need data",
      title: "No session yet",
      text: "Run Free Choice and Forced Hand rounds to estimate hand preference and capability.",
    };
  }

  return {
    hand: null,
    label: "Not indicated",
    title: "No strong learned non-use signal",
    text: "Current usage and capability scores do not show a high capability plus low usage pattern.",
  };
}

function setMetricText(id, value) {
  elements[id].textContent = String(round(value));
}

function logEvent(message) {
  const item = document.createElement("li");
  item.textContent = message;
  elements.eventLog.prepend(item);
  while (elements.eventLog.children.length > 12) {
    elements.eventLog.lastElementChild.remove();
  }
}

function updatePointer(event) {
  const rect = canvas.getBoundingClientRect();
  const point = {
    x: clamp(event.clientX - rect.left, 0, rect.width),
    y: clamp(event.clientY - rect.top, 0, rect.height),
    time: performance.now(),
  };
  state.pointer = point;
  state.pointerTrail.push(point);
  if (state.pointerTrail.length > 40) state.pointerTrail.shift();
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

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

elements.leftHandButton.addEventListener("click", () => setActiveHand("left"));
elements.rightHandButton.addEventListener("click", () => setActiveHand("right"));
elements.startButton.addEventListener("click", startSession);
elements.resetButton.addEventListener("click", resetMetrics);
elements.demoButton.addEventListener("click", loadDemoPattern);
elements.cameraButton.addEventListener("click", enableCamera);
elements.modeSelect.addEventListener("change", (event) => {
  state.mode = event.target.value;
  updateInstruction();
  logEvent(`Switched to ${MODE_LABEL[state.mode]} mode.`);
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
updateInstruction();
updateAnalytics();
requestAnimationFrame(loop);
