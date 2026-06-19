/** Порог ширины для мобильного UI. */
export const MOBILE_MAX_WIDTH = 900;

export function isMobileDevice() {
  if (typeof window === 'undefined') return false;
  const narrow = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches;
  const touch = navigator.maxTouchPoints > 0;
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile|webOS/i.test(navigator.userAgent);
  return narrow || (touch && mobileUa);
}

export function isMobileUI() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches
    || (isMobileDevice() && window.innerWidth <= MOBILE_MAX_WIDTH);
}

export function getRendererPixelRatio(lowQuality) {
  if (lowQuality) return 1;
  const cap = isMobileUI() ? 1.5 : 2;
  return Math.min(window.devicePixelRatio || 1, cap);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function bindHoldButton(btn, onDown, onUp) {
  if (!btn) return;
  const down = (e) => {
    e.preventDefault();
    onDown();
  };
  const up = (e) => {
    e.preventDefault();
    onUp();
  };
  btn.addEventListener('touchstart', down, { passive: false });
  btn.addEventListener('touchend', up);
  btn.addEventListener('touchcancel', up);
  btn.addEventListener('mousedown', down);
  btn.addEventListener('mouseup', up);
  btn.addEventListener('mouseleave', up);
}

function bindTapButton(btn, handler) {
  if (!btn) return;
  let touched = false;
  btn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touched = true;
    handler();
  }, { passive: false });
  btn.addEventListener('click', (e) => {
    if (touched) {
      touched = false;
      e.preventDefault();
      return;
    }
    handler();
  });
}

function bindMovementPad(state) {
  document.querySelectorAll('[data-touch-key]').forEach((btn) => {
    const code = btn.dataset.touchKey;
    bindHoldButton(
      btn,
      () => { state.keys[code] = true; },
      () => { state.keys[code] = false; },
    );
  });
}

function bindCameraTouch(state, canvas) {
  let camTouchId = null;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener('touchstart', (e) => {
    if (!state.running || state.paused) return;
    if (e.target.closest('#ui, #touch-controls, .mobile-fab, .mobile-drawer')) return;

    for (const t of e.changedTouches) {
      if (t.clientX >= window.innerWidth * 0.45) {
        camTouchId = t.identifier;
        lastX = t.clientX;
        lastY = t.clientY;
        break;
      }
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    if (camTouchId === null || !state.running || state.paused) return;

    for (const t of e.changedTouches) {
      if (t.identifier !== camTouchId) continue;
      e.preventDefault();
      const dx = t.clientX - lastX;
      const dy = t.clientY - lastY;
      state.camYaw -= dx * 0.004;
      state.camPitch = clamp(state.camPitch + dy * 0.004, -0.3, 1.0);
      lastX = t.clientX;
      lastY = t.clientY;
    }
  }, { passive: false });

  const endCam = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === camTouchId) camTouchId = null;
    }
  };
  canvas.addEventListener('touchend', endCam);
  canvas.addEventListener('touchcancel', endCam);
}

function initDrawers() {
  const backdrop = document.getElementById('mobile-drawer-backdrop');
  const panels = [
    { btn: '#btn-mobile-missions', panel: '#mission-panel' },
    { btn: '#btn-mobile-status', panel: '#influence-panel' },
  ];

  const closeAll = () => {
    panels.forEach(({ panel }) => document.querySelector(panel)?.classList.remove('drawer-open'));
    backdrop?.classList.add('hidden');
  };

  panels.forEach(({ btn, panel }) => {
    const btnEl = document.querySelector(btn);
    const panelEl = document.querySelector(panel);
    if (!btnEl || !panelEl) return;

    btnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = panelEl.classList.contains('drawer-open');
      closeAll();
      if (!isOpen) {
        panelEl.classList.add('drawer-open');
        backdrop?.classList.remove('hidden');
      }
    });
  });

  backdrop?.addEventListener('click', closeAll);
}

export function applyMobileUIMode() {
  if (!isMobileUI()) return false;
  document.body.classList.add('mobile-ui');
  document.getElementById('touch-controls')?.classList.remove('hidden');
  return true;
}

/**
 * @param {{
 *   state: object,
 *   canvas: HTMLCanvasElement,
 *   onJump: () => void,
 *   onPolice: () => void,
 *   onFire: () => void,
 *   onTaxi: () => void,
 *   onMilitary: () => void,
 *   onCamera: () => void,
 * }} deps
 */
export function initMobileControls(deps) {
  if (!applyMobileUIMode()) return;

  const { state, canvas, onJump, onPolice, onFire, onTaxi, onMilitary, onCamera } = deps;

  document.addEventListener('contextmenu', (e) => e.preventDefault());

  bindMovementPad(state);

  bindHoldButton(
    document.getElementById('touch-sprint'),
    () => { state.sprint = true; },
    () => { state.sprint = false; },
  );

  bindTapButton(document.getElementById('touch-jump'), onJump);
  bindTapButton(document.getElementById('touch-camera'), onCamera);

  bindTapButton(document.getElementById('touch-police'), onPolice);
  bindTapButton(document.getElementById('touch-fire'), onFire);
  bindTapButton(document.getElementById('touch-taxi'), onTaxi);
  bindTapButton(document.getElementById('touch-military'), onMilitary);

  bindCameraTouch(state, canvas);
  initDrawers();

  window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).addEventListener('change', () => {
    if (isMobileUI()) applyMobileUIMode();
    else {
      document.body.classList.remove('mobile-ui');
      document.getElementById('touch-controls')?.classList.add('hidden');
    }
  });
}
