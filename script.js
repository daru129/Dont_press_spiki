const speekyImage = document.getElementById('speeky');
const speekyWrap = speekyImage.parentElement;

const pressAudio = new Audio();
const releaseAudio = new Audio();
pressAudio.preload = 'auto';
releaseAudio.preload = 'auto';

let audioUnlocked = false;
let audioReady = false;
let audioSetupPromise = null;

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

const PRESS_AUDIO_CANDIDATES = [
  './assets/audio/reverse_press.mp3',
  './assets/audio/리버스으아앙.mp3',
  '../assets/audio/reverse_press.mp3',
  '../assets/audio/리버스으아앙.mp3',
];

const RELEASE_AUDIO_CANDIDATES = [
  './assets/audio/release.mp3',
  './assets/audio/스피키네르지마세요.mp3',
  '../assets/audio/release.mp3',
  '../assets/audio/스피키네르지마세요.mp3',
];

async function resolveAudioSource(candidates) {
  for (const src of candidates) {
    try {
      const response = await fetch(src, {
        method: 'HEAD',
        cache: 'no-store',
      });
      if (response.ok) {
        return src;
      }
    } catch (_) {
    }
  }
  return candidates[0];
}

async function ensureAudioSources() {
  if (audioReady) return;
  if (audioSetupPromise) {
    await audioSetupPromise;
    return;
  }

  audioSetupPromise = (async () => {
    const [pressSrc, releaseSrc] = await Promise.all([
      resolveAudioSource(PRESS_AUDIO_CANDIDATES),
      resolveAudioSource(RELEASE_AUDIO_CANDIDATES),
    ]);

    pressAudio.src = pressSrc;
    releaseAudio.src = releaseSrc;
    audioReady = true;
  })();

  try {
    await audioSetupPromise;
  } finally {
    audioSetupPromise = null;
  }
}

function stopAudio(audio) {
  audio.pause();
  audio.currentTime = 0;
}

async function unlockAudioIfNeeded() {
  if (audioUnlocked) return;

  try {
    await ensureAudioSources();

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      if (ctx.state !== 'running') {
        await ctx.resume();
      }
      await ctx.close();
    }

    const previousMutedPress = pressAudio.muted;
    const previousMutedRelease = releaseAudio.muted;

    pressAudio.muted = true;
    releaseAudio.muted = true;

    try {
      await pressAudio.play();
      pressAudio.pause();
      pressAudio.currentTime = 0;
    } catch (_) {
    }

    try {
      await releaseAudio.play();
      releaseAudio.pause();
      releaseAudio.currentTime = 0;
    } catch (_) {
    }

    pressAudio.muted = previousMutedPress;
    releaseAudio.muted = previousMutedRelease;
    audioUnlocked = true;
  } catch (error) {
    console.warn('[audio] unlock failed', error);
  }
}

async function playAudioSafe(audio) {
  try {
    await ensureAudioSources();
    await unlockAudioIfNeeded();
    audio.currentTime = 0;
    await audio.play();
  } catch (error) {
    console.warn('[audio] play failed, retrying once', error);
    try {
      await ensureAudioSources();
      await unlockAudioIfNeeded();
      audio.currentTime = 0;
      await audio.play();
    } catch (retryError) {
      console.error('[audio] play retry failed', retryError);
    }
  }
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
  playAudioSafe(pressAudio);
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
  playAudioSafe(releaseAudio);
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
ensureAudioSources();
