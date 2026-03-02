const speekyImage = document.getElementById('speeky');
const speekyWrap = speekyImage.parentElement;

const pressAudio = new Audio('./assets/audio/리버스으아앙.mp3');
const releaseAudio = new Audio('./assets/audio/스피키네르지마세요.mp3');

let isPressed = false;
let isShaking = false;
let shakeStartTs = 0;
let shakeTimer = null;
let rafId = null;
let currentScaleY = 1;
let targetScaleY = 1;

const SHAKE_DELAY_MS = 1000;
const SHAKE_X_PX = 3;
const SHAKE_ROT_RAD = 0.02;
const SHAKE_CYCLE_MS = 140;
const PRESSED_SCALE_Y = 0.9;
const SCALE_SMOOTHING = 0.22;

function stopAudio(audio) {
  audio.pause();
  audio.currentTime = 0;
}

function applyTransform(shakeWave = 0) {
  const x = shakeWave * SHAKE_X_PX;
  const r = shakeWave * SHAKE_ROT_RAD;
  speekyWrap.style.transform = `scaleX(1) scaleY(${currentScaleY}) translateX(${x}px) rotate(${r}rad)`;
}

function startRenderLoop() {
  if (rafId) return;

  const tick = (ts) => {
    const delta = targetScaleY - currentScaleY;
    currentScaleY += delta * SCALE_SMOOTHING;

    if (Math.abs(delta) < 0.0008) {
      currentScaleY = targetScaleY;
    }

    const shakeWave = isShaking
      ? Math.sin(((ts - shakeStartTs) / SHAKE_CYCLE_MS) * Math.PI * 2)
      : 0;

    applyTransform(shakeWave);

    const shouldContinue = isShaking || Math.abs(targetScaleY - currentScaleY) > 0.0008;
    if (shouldContinue) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = null;
    }
  };

  rafId = requestAnimationFrame(tick);
}

function startShake() {
  if (isShaking) return;
  isShaking = true;
  shakeStartTs = performance.now();
  startRenderLoop();
}

function stopShake() {
  isShaking = false;
  if (shakeTimer) {
    clearTimeout(shakeTimer);
    shakeTimer = null;
  }
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  startRenderLoop();
}

function scheduleShakeAfterRelease() {
  if (shakeTimer) {
    clearTimeout(shakeTimer);
  }
  shakeTimer = setTimeout(() => {
    if (!releaseAudio.paused && !releaseAudio.ended) {
      startShake();
    }
  }, SHAKE_DELAY_MS);
}

function onPressDown(event) {
  event.preventDefault();
  if (isPressed) return;

  isPressed = true;
  targetScaleY = PRESSED_SCALE_Y;
  stopShake();
  stopAudio(releaseAudio);

  startRenderLoop();
  stopAudio(pressAudio);
  pressAudio.play().catch(() => {});
}

function onPressUp(event) {
  if (event) {
    event.preventDefault();
  }
  if (!isPressed) return;

  isPressed = false;
  targetScaleY = 1;
  startRenderLoop();

  stopAudio(pressAudio);
  stopAudio(releaseAudio);
  releaseAudio.play().catch(() => {});
  scheduleShakeAfterRelease();
}

releaseAudio.addEventListener('ended', () => {
  stopShake();
});

window.addEventListener('pointerup', onPressUp, { passive: false });
window.addEventListener('pointercancel', onPressUp, { passive: false });
window.addEventListener('blur', onPressUp);

speekyImage.addEventListener('pointerdown', onPressDown, { passive: false });

applyTransform(0);
