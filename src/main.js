// ============================================
// MOBILE-FIRST IMAGE COMPARISON APP
// Redesigned with Object-Based Arrows & Better UI
// ============================================

import './style.css'

const MAX_IMAGE_BYTES = 20 * 1024 * 1024
const MAX_EXPORT_PIXELS = 16_000_000
const MAX_EXPORT_SIDE = 8_192

// Collage framing, expressed as a fraction of the "matched" dimension (the shared
// height in side-by-side, the shared width when stacked). Ratios instead of fixed
// pixels keep a 400px and a 4000px export looking identical, and let the live
// preview reproduce the exported frame exactly.
const FRAME_RATIO = 0.025
const GAP_RATIO = 0.025
const BADGE_RATIO = 0.055

// Arrow sizes are stored against this reference so they scale identically in the
// on-screen canvas and in the full-resolution export.
const ARROW_REFERENCE_BASE = 1000

// The shape the smart layout aims for. Square reads well everywhere images get
// shared (WhatsApp, Instagram, docs) and neither crops nor letterboxes badly.
const TARGET_ASPECT = 1

function createEdits() {
  return {
    arrows: [],
    filters: { brightness: 100, contrast: 100, saturate: 100 },
    badge: { x: 0.5, y: 0.9 }
  }
}

// ============================================
// STATE MANAGEMENT
// ============================================
const state = {
  beforeImage: null,
  afterImage: null,
  activeSide: 'after', // 'before' or 'after'
  activeTool: null,    // 'arrow' or 'filter' or null

  // What the user asked for, and what that currently resolves to.
  layoutMode: 'auto',          // 'auto' | 'horizontal' | 'vertical'
  resolvedLayout: 'horizontal',

  // Natural pixel size of each source image - the input to the layout engine.
  beforeMeta: null,            // { w, h }
  afterMeta: null,

  // Arrow Interaction State
  interaction: {
    isDragging: false,
    dragMode: null, // 'start', 'end', 'body'
    dragStartPos: null, // {x, y} at mousedown
    initialArrow: null, // Copy of arrow before drag (for delta calcs)
    isPinching: false,
    selectedArrowIndex: -1
  },

  arrowSettings: {
    color: '#dc2626',
    size: 20 // Keep in sync with the #arrow-size slider default
  },

  edits: {
    before: createEdits(),
    after: createEdits()
  }
}

// ============================================
// DOM ELEMENTS
// ============================================
// Populated by cacheElements() once renderHTML() has run.
const elements = {
  app: document.querySelector("#app")
}

// ============================================
// VIEWPORT HEIGHT
// ============================================
// Android hands out a dvh that includes the strip behind the system navigation
// bar, so a 100dvh shell pushes its own footer out of sight. visualViewport
// reports what the user can actually see; fall back to innerHeight, and leave
// the CSS unit in place if neither is available.
function updateAppHeight() {
  const height = (window.visualViewport && window.visualViewport.height) || window.innerHeight
  if (height > 0) {
    document.documentElement.style.setProperty('--app-height', `${Math.round(height)}px`)
  }
}

function watchViewportHeight() {
  updateAppHeight()
  window.addEventListener('resize', updateAppHeight)
  window.addEventListener('orientationchange', updateAppHeight)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateAppHeight)
  }
}

// ============================================
// INITIALIZE APP
// ============================================
function initApp() {
  watchViewportHeight()
  renderHTML()
  cacheElements()
  attachEventListeners()
  applyLayout()
  updateActionAvailability()
  setupPWA()
  setupConnectionStatus()
}

// ============================================
// PWA INSTALL LOGIC
// ============================================
let deferredPrompt;

function setupPWA() {
  if (elements.installBtn) {
    elements.installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      elements.installBtn.hidden = true;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Update UI to notify the user they can add to home screen
    if (elements.installBtn) {
      elements.installBtn.hidden = false;
    }
  });
}

// ============================================
// CONNECTION STATUS INDICATOR
// ============================================
function setupConnectionStatus() {
  let statusIndicator = null;

  function showStatus(isOnline) {
    // Remove existing indicator
    if (statusIndicator) {
      statusIndicator.remove();
    }

    // Create new indicator
    statusIndicator = document.createElement('div');
    statusIndicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${isOnline ? '#10b981' : '#ef4444'};
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideIn 0.3s ease;
    `;

    statusIndicator.innerHTML = `
      <span>${isOnline ? '✅' : '⚠️'}</span>
      <span>${isOnline ? 'Online' : 'Offline Mode'}</span>
    `;

    document.body.appendChild(statusIndicator);

    // Auto-hide after 3 seconds if online
    if (isOnline) {
      setTimeout(() => {
        if (statusIndicator && statusIndicator.parentElement) {
          statusIndicator.style.animation = 'slideOut 0.3s ease';
          setTimeout(() => statusIndicator.remove(), 300);
        }
      }, 3000);
    }
  }

  // Add animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100px); opacity: 0; }
    }
  `;
  document.head.appendChild(style);

  // Listen for connection changes
  window.addEventListener('online', () => {
    console.log('[PWA] ✅ Back online!');
    showStatus(true);
  });

  window.addEventListener('offline', () => {
    console.log('[PWA] ⚠️ Offline mode activated');
    showStatus(false);
  });

  // Show initial status if offline
  if (!navigator.onLine) {
    showStatus(false);
  }
}

// ============================================
// ICONS
// ============================================
const svg = (paths, size = 18) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`

const ICON = {
  photo: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>'),
  sparkles: svg('<path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1"/><circle cx="12" cy="12" r="3"/>'),
  arrow: svg('<path d="M7 17 17 7"/><path d="M9 7h8v8"/>'),
  sliders: svg('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h10M18 18h2"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>'),
  swap: svg('<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>'),
  reset: svg('<path d="M3 2v6h6"/><path d="M3.5 12a8.5 8.5 0 1 1 2.5 6"/>'),
  share: svg('<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="m16 6-4-4-4 4"/><path d="M12 2v14"/>'),
  download: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 16),
  minus: svg('<path d="M5 12h14"/>', 16),
  trash: svg('<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>', 16),
  install: svg('<path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><path d="M4 19h16"/>', 16),
  wand: svg('<path d="m4 20 9-9"/><path d="M15 5.5 18.5 9"/><path d="M17 3v4M19 5h-4"/><path d="M6 14v3M7.5 15.5h-3"/>', 16)
}

// ============================================
// RENDER HTML STRUCTURE
// ============================================
function uploadSlot(side, label) {
  return `
    <div class="slot slot--${side}" id="${side}-upload-area" role="button" tabindex="0"
         aria-label="Choose the ${label.toLowerCase()} photo">
      <span class="slot__thumb">
        ${ICON.photo}
        <img id="${side}-preview" alt="" />
      </span>
      <span class="slot__meta">
        <span class="slot__tag">${label}</span>
        <span class="slot__action"></span>
      </span>
      <input type="file" id="${side}-input" class="upload-input" accept="image/*" />
    </div>`
}

function collagePane(side, label) {
  return `
    <div class="collage-side" id="side-${side}" data-side="${side}">
      <img id="comparison-${side}" class="collage-image" alt="${label} photo" />
      <canvas id="canvas-${side}" class="drawing-canvas" aria-label="${label} photo annotations"></canvas>
      <span class="collage-badge${side === 'after' ? ' collage-badge--after' : ''}">${side}</span>
    </div>`
}

function renderHTML() {
  elements.app.innerHTML = `
    <div class="app-shell">
      <header class="appbar">
        <div class="appbar__brand">
          <img class="appbar__logo" src="${import.meta.env.BASE_URL}logo.png" alt="" width="32" height="32" />
          <span class="appbar__name">Before &amp; After</span>
          <span class="appbar__tag">Comparison studio</span>
        </div>
        <button type="button" class="btn btn--ghost btn--sm" id="install-btn" hidden>
          ${ICON.install}<span>Install</span>
        </button>
      </header>

      <main class="workspace">
        <!-- ---------------------------------------------------------- stage -->
        <section class="stage">
          <div class="stage__surface">
            <div class="placeholder" id="placeholder">
              <div class="placeholder__frames">
                <button type="button" class="placeholder__frame" data-pick="before">
                  <img id="placeholder-before" alt="" />
                  ${ICON.photo}<span>Before</span>
                </button>
                <button type="button" class="placeholder__frame" data-pick="after">
                  <img id="placeholder-after" alt="" />
                  ${ICON.photo}<span>After</span>
                </button>
              </div>
              <p class="placeholder__title" id="placeholder-title">Add two photos to begin</p>
              <p class="placeholder__text" id="placeholder-text">
                Pick a before and an after shot. The best layout gets chosen for you,
                and what you see here is exactly what downloads.
              </p>
            </div>

            <div class="collage-container layout-horizontal" id="collage-container">
              ${collagePane('before', 'Before')}
              ${collagePane('after', 'After')}
            </div>
          </div>
          <p class="stage__caption" id="layout-status" aria-live="polite"></p>
        </section>

        <!-- ------------------------------------------------------ inspector -->
        <aside class="inspector">
          <section class="panel" data-requires-images hidden>
            <div class="panel__head"><h2 class="panel__title">Layout</h2></div>
            <div class="panel__body">
              <div class="segmented" id="layout-switch" role="group" aria-label="Collage layout">
                <button type="button" class="segmented__item" data-mode="auto" aria-pressed="true">
                  <span>Auto</span>
                </button>
                <button type="button" class="segmented__item" data-mode="horizontal" aria-pressed="false">
                  <span>Side by side</span>
                </button>
                <button type="button" class="segmented__item" data-mode="vertical" aria-pressed="false">
                  <span>Top &amp; bottom</span>
                </button>
              </div>
              <p class="panel__hint" id="layout-hint"></p>
            </div>
          </section>

          <section class="panel" id="edit-panel" data-requires-images hidden>
            <div class="panel__head"><h2 class="panel__title">Edit</h2></div>
            <div class="panel__body">
              <div class="field field--inline">
                <span class="field__label">Apply edits to</span>
                <div class="segmented" id="side-switch" role="group" aria-label="Photo to edit">
                  <button type="button" class="segmented__item" data-side="before" aria-pressed="false">Before</button>
                  <button type="button" class="segmented__item" data-side="after" aria-pressed="true">After</button>
                </div>
              </div>

              <div class="segmented" role="group" aria-label="Tool">
                <button type="button" class="segmented__item" id="tool-arrow" aria-pressed="false">
                  ${ICON.arrow}<span>Arrows</span>
                </button>
                <button type="button" class="segmented__item" id="tool-filter" aria-pressed="false">
                  ${ICON.sliders}<span>Filters</span>
                </button>
              </div>

              <!-- Arrows -->
              <div class="tool-options" id="arrow-options">
                <div class="row row--split">
                  <button type="button" class="btn btn--secondary btn--sm" id="btn-add-arrow">
                    ${ICON.plus}Add arrow
                  </button>
                  <button type="button" class="btn btn--quiet-danger btn--sm" id="btn-delete-arrow" disabled>
                    ${ICON.trash}Delete
                  </button>
                </div>

                <div class="field field--inline">
                  <span class="field__label">Colour</span>
                  <div class="color-picker" id="color-picker">
                    <button type="button" class="color-btn active" style="background:#dc2626" data-color="#dc2626" aria-label="Red" aria-pressed="true"></button>
                    <button type="button" class="color-btn" style="background:#2563eb" data-color="#2563eb" aria-label="Blue" aria-pressed="false"></button>
                    <button type="button" class="color-btn" style="background:#16a34a" data-color="#16a34a" aria-label="Green" aria-pressed="false"></button>
                    <button type="button" class="color-btn" style="background:#eab308" data-color="#eab308" aria-label="Yellow" aria-pressed="false"></button>
                    <button type="button" class="color-btn" style="background:#ffffff" data-color="#ffffff" aria-label="White" aria-pressed="false"></button>
                    <button type="button" class="color-btn" style="background:#0f172a" data-color="#0f172a" aria-label="Black" aria-pressed="false"></button>
                  </div>
                </div>

                <div class="field">
                  <span class="field__label">Thickness <span class="field__value" id="arrow-size-val">20</span></span>
                  <div class="row">
                    <button type="button" class="stepper" id="btn-size-minus" aria-label="Thinner">${ICON.minus}</button>
                    <input type="range" class="slider" id="arrow-size" min="5" max="35" value="20" aria-label="Arrow thickness" />
                    <button type="button" class="stepper" id="btn-size-plus" aria-label="Thicker">${ICON.plus}</button>
                  </div>
                </div>

                <p class="panel__hint">Drag the body to move it, the round handles to re-aim.</p>
              </div>

              <!-- Adjust -->
              <div class="filter-controls" id="filter-controls">
                <div class="field">
                  <span class="field__label">Brightness <span class="field__value" id="brightness-val">100%</span></span>
                  <input type="range" class="slider" id="brightness-slider" min="50" max="150" value="100" />
                </div>
                <div class="field">
                  <span class="field__label">Contrast <span class="field__value" id="contrast-val">100%</span></span>
                  <input type="range" class="slider" id="contrast-slider" min="50" max="150" value="100" />
                </div>
                <div class="field">
                  <span class="field__label">Saturation <span class="field__value" id="saturate-val">100%</span></span>
                  <input type="range" class="slider" id="saturate-slider" min="0" max="200" value="100" />
                </div>
                <button type="button" class="btn btn--ghost btn--sm btn--block" id="btn-reset-filters">
                  ${ICON.reset}Reset filters
                </button>
              </div>
            </div>
          </section>

          <section class="panel" data-requires-images hidden>
            <div class="panel__head"><h2 class="panel__title">Photos</h2></div>
            <div class="panel__body">
              <div class="slots">
                ${uploadSlot('before', 'Before')}
                ${uploadSlot('after', 'After')}
              </div>
            </div>
          </section>
        </aside>
      </main>

      <!-- ------------------------------------------------------- actionbar -->
      <div class="actionbar">
        <div class="actionbar__inner">
          <button type="button" class="btn btn--secondary btn--utility" id="swap-btn"
                  title="Swap before and after" aria-label="Swap before and after">
            ${ICON.swap}<span class="btn__label">Swap</span>
          </button>
          <button type="button" class="btn btn--quiet-danger btn--utility" id="reset-btn"
                  title="Start over with new photos" aria-label="Start over with new photos">
            ${ICON.reset}<span class="btn__label">Start over</span>
          </button>
          <span class="actionbar__spacer"></span>
          <button type="button" class="btn btn--secondary btn--export" id="share-btn">
            ${ICON.share}<span class="btn__label">Share</span>
          </button>
          <button type="button" class="btn btn--primary btn--export" id="download-btn">
            ${ICON.download}<span class="btn__label">Download</span>
          </button>
        </div>
      </div>
    </div>
  `
}

// ============================================
// CACHE ELEMENTS
// ============================================
function cacheElements() {
  const byId = (id) => document.getElementById(id)

  elements.app = document.querySelector('#app')
  elements.installBtn = byId('install-btn')

  elements.beforeInput = byId('before-input')
  elements.afterInput = byId('after-input')
  elements.beforePreview = byId('before-preview')
  elements.afterPreview = byId('after-preview')
  elements.beforeUploadArea = byId('before-upload-area')
  elements.afterUploadArea = byId('after-upload-area')

  elements.collageContainer = byId('collage-container')
  elements.stageSurface = document.querySelector('.stage__surface')
  elements.inspector = document.querySelector('.inspector')
  elements.workspace = document.querySelector('.workspace')
  elements.editPanel = byId('edit-panel')
  elements.comparisonImageBefore = byId('comparison-before')
  elements.comparisonImageAfter = byId('comparison-after')
  elements.sideBefore = byId('side-before')
  elements.sideAfter = byId('side-after')
  elements.canvasBefore = byId('canvas-before')
  elements.canvasAfter = byId('canvas-after')
  elements.badgeBefore = elements.sideBefore.querySelector('.collage-badge')
  elements.badgeAfter = elements.sideAfter.querySelector('.collage-badge')

  elements.layoutSwitch = byId('layout-switch')
  elements.layoutButtons = elements.layoutSwitch.querySelectorAll('[data-mode]')
  elements.layoutStatus = byId('layout-status')
  elements.layoutHint = byId('layout-hint')

  elements.sideSwitch = byId('side-switch')
  elements.sideButtons = elements.sideSwitch.querySelectorAll('[data-side]')

  elements.toolArrow = byId('tool-arrow')
  elements.toolFilter = byId('tool-filter')
  elements.arrowOptions = byId('arrow-options')
  elements.btnAddArrow = byId('btn-add-arrow')
  elements.btnDeleteArrow = byId('btn-delete-arrow')
  elements.arrowSize = byId('arrow-size')
  elements.arrowSizeVal = byId('arrow-size-val')
  elements.btnSizeMinus = byId('btn-size-minus')
  elements.btnSizePlus = byId('btn-size-plus')
  elements.colorBtns = document.querySelectorAll('.color-btn')

  elements.filterControls = byId('filter-controls')
  elements.brightnessSlider = byId('brightness-slider')
  elements.contrastSlider = byId('contrast-slider')
  elements.saturateSlider = byId('saturate-slider')
  elements.brightnessVal = byId('brightness-val')
  elements.contrastVal = byId('contrast-val')
  elements.saturateVal = byId('saturate-val')
  elements.btnResetFilters = byId('btn-reset-filters')

  elements.swapBtn = byId('swap-btn')
  elements.resetBtn = byId('reset-btn')
  elements.shareBtn = byId('share-btn')
  elements.downloadBtn = byId('download-btn')

  elements.imageOnlyPanels = document.querySelectorAll('[data-requires-images]')
  elements.placeholderPicks = document.querySelectorAll('[data-pick]')
  elements.placeholderThumbs = {
    before: byId('placeholder-before'),
    after: byId('placeholder-after')
  }
  elements.placeholderTitle = byId('placeholder-title')
  elements.placeholderText = byId('placeholder-text')
  elements.actionButtons = [elements.swapBtn, elements.shareBtn, elements.downloadBtn]
}

// ============================================
// EVENTS & LOGIC
// ============================================
function attachEventListeners() {
  // Uploads
  elements.beforeInput.addEventListener('change', (e) => handleImageUpload(e, 'before'))
  elements.afterInput.addEventListener('change', (e) => handleImageUpload(e, 'after'))
  setupUploadArea(elements.beforeUploadArea, 'before')
  setupUploadArea(elements.afterUploadArea, 'after')

  elements.placeholderPicks.forEach(btn => {
    btn.addEventListener('click', () => {
      (btn.dataset.pick === 'before' ? elements.beforeInput : elements.afterInput).click()
    })
  })

  // Layout: a direct three-way choice, so no state is ever a guess.
  elements.layoutButtons.forEach(btn => {
    btn.addEventListener('click', () => setLayoutMode(btn.dataset.mode))
  })

  // Which photo the tools apply to
  elements.sideButtons.forEach(btn => {
    btn.addEventListener('click', () => selectSide(btn.dataset.side))
  })

  // Controls
  elements.swapBtn.addEventListener('click', swapImages)
  elements.resetBtn.addEventListener('click', resetApp)
  if (elements.shareBtn) elements.shareBtn.addEventListener('click', shareComparison)
  elements.downloadBtn.addEventListener('click', downloadComparison)

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return
    if (state.activeTool !== 'arrow') return

    // Don't eat the key while a slider or any other control has focus.
    const target = e.target
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return

    e.preventDefault()
    deleteArrow()
  })

  // Tool Toggling
  elements.toolArrow.addEventListener('click', () => toggleTool('arrow'))
  elements.toolFilter.addEventListener('click', () => toggleTool('filter'))

  // Side Selection
  elements.sideBefore.addEventListener('click', (e) => handleSideClick(e, 'before'))
  elements.sideAfter.addEventListener('click', (e) => handleSideClick(e, 'after'))

  // Arrow Operations
  elements.btnAddArrow.addEventListener('click', addArrow)
  elements.btnDeleteArrow.addEventListener('click', deleteArrow)

  elements.arrowSize.addEventListener('input', (e) => {
    setArrowSize(parseInt(e.target.value, 10))
  })

  elements.btnSizeMinus.addEventListener('click', () => {
    setArrowSize(parseInt(elements.arrowSize.value, 10) - 1)
  })

  elements.btnSizePlus.addEventListener('click', () => {
    setArrowSize(parseInt(elements.arrowSize.value, 10) + 1)
  })

  elements.colorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.colorBtns.forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      elements.colorBtns.forEach(b => b.setAttribute('aria-pressed', String(b === btn)))
      state.arrowSettings.color = btn.dataset.color
      updateSelectedArrow()
    })
  })

  // Filter Operations
  elements.brightnessSlider.addEventListener('input', updateFilters)
  elements.contrastSlider.addEventListener('input', updateFilters)
  elements.saturateSlider.addEventListener('input', updateFilters)
  elements.btnResetFilters.addEventListener('click', resetCurrentFilters)

  // Canvas Interaction (The Core Logic)
  setupCanvasInteraction(elements.canvasBefore, 'before')
  setupCanvasInteraction(elements.canvasAfter, 'after')

  // One debounced handler for every reflow trigger. Mobile browsers fire resize
  // on every address-bar show/hide, and re-measuring the canvases on each of
  // those is what used to make dragging stutter mid-scroll.
  let resizeTimer = 0
  const onViewportChange = () => {
    updateAppHeight()
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => requestAnimationFrame(refreshCollageGeometry), 120)
  }
  window.addEventListener('resize', onViewportChange)
  window.addEventListener('orientationchange', onViewportChange)

  // Badge Interaction
  setupBadgeDrag(elements.badgeBefore, 'before')
  setupBadgeDrag(elements.badgeAfter, 'after')
}

function setupUploadArea(area, side) {
  const input = side === 'before' ? elements.beforeInput : elements.afterInput

  area.addEventListener('click', (event) => {
    // input.click() re-dispatches a bubbling click; without this it recurses.
    if (event.target === input) return
    input.click()
  })

  area.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      input.click()
    }
  })

  ;['dragenter', 'dragover'].forEach(eventName => {
    area.addEventListener(eventName, (event) => {
      event.preventDefault()
      area.classList.add('is-dragging')
    })
  })

  ;['dragleave', 'drop'].forEach(eventName => {
    area.addEventListener(eventName, (event) => {
      event.preventDefault()
      area.classList.remove('is-dragging')
    })
  })

  area.addEventListener('drop', (event) => {
    const file = event.dataTransfer?.files?.[0]
    if (file) processImageFile(file, side)
  })
}
function updateBadgePositions() {
  const setPos = (el, pos, container) => {
    const cw = container.clientWidth
    const ch = container.clientHeight
    if (!cw || !ch) return

    // Mirror drawPaneBadge(): the pill stays fully inside its own pane, so the
    // preview shows exactly what the exported file will.
    const halfW = el.offsetWidth / 2 / cw
    const halfH = el.offsetHeight / 2 / ch
    const x = clamp(pos.x, halfW, 1 - halfW)
    const y = clamp(pos.y, halfH, 1 - halfH)

    el.style.left = (x * 100) + "%"
    el.style.top = (y * 100) + "%"
    el.style.bottom = "auto"
    el.style.transform = "translate(-50%, -50%)"
  }

  setPos(elements.badgeBefore, state.edits.before.badge, elements.sideBefore)
  setPos(elements.badgeAfter, state.edits.after.badge, elements.sideAfter)
}

function setupBadgeDrag(el, side) {
  let isDragging = false

  const onStart = (e) => {
    isDragging = true
    e.preventDefault()
    e.stopPropagation()
    el.style.cursor = 'grabbing'
  }

  const onMove = (e) => {
    if (!isDragging) return
    e.preventDefault()

    const container = side === 'before' ? elements.sideBefore : elements.sideAfter
    const rect = container.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY

    // Normalised against the pane, so the badge keeps its spot on the photo at
    // any preview size and lands in the same place in the export.
    const x = clamp((clientX - rect.left) / rect.width, 0, 1)
    const y = clamp((clientY - rect.top) / rect.height, 0, 1)

    state.edits[side].badge = { x, y }
    updateBadgePositions()
  }

  const onEnd = () => {
    if (isDragging) {
      isDragging = false
      el.style.cursor = 'grab'
    }
  }

  el.addEventListener('mousedown', onStart)
  el.addEventListener('touchstart', onStart, { passive: false })

  window.addEventListener('mousemove', onMove)
  window.addEventListener('touchmove', onMove, { passive: false })

  window.addEventListener('mouseup', onEnd)
  window.addEventListener('touchend', onEnd)
}

// ============================================
// TOOL LOGIC
// ============================================
function toggleTool(tool) {
  // Toggle Logic
  if (state.activeTool === tool) {
    state.activeTool = null
    elements.toolArrow.classList.remove('active')
    elements.toolFilter.classList.remove('active')
    elements.toolArrow.setAttribute('aria-pressed', 'false')
    elements.toolFilter.setAttribute('aria-pressed', 'false')
    elements.arrowOptions.classList.remove('active')
    elements.filterControls.classList.remove('active')
    document.body.classList.remove('arrow-mode', 'filter-mode')
  } else {
    state.activeTool = tool
    elements.toolArrow.classList.toggle('active', tool === 'arrow')
    elements.toolFilter.classList.toggle('active', tool === 'filter')
    elements.toolArrow.setAttribute('aria-pressed', String(tool === 'arrow'))
    elements.toolFilter.setAttribute('aria-pressed', String(tool === 'filter'))
    elements.arrowOptions.classList.toggle('active', tool === 'arrow')
    elements.filterControls.classList.toggle('active', tool === 'filter')

    document.body.classList.remove('arrow-mode', 'filter-mode')
    if (tool === 'arrow') {
      document.body.classList.add('arrow-mode')
      // Start the user off with one arrow, but only when the selected image has
      // none yet - otherwise toggling the tool piles up duplicates.
      if (state.edits[state.activeSide].arrows.length === 0) {
        addArrow()
      } else {
        state.interaction.selectedArrowIndex = state.edits[state.activeSide].arrows.length - 1
      }
      updateDeleteBtn()
    }
    if (tool === 'filter') document.body.classList.add('filter-mode')

    // The controls live in the scrolling column, so bring them up to meet the
    // user rather than making them hunt below the fold.
    requestAnimationFrame(() => revealEditPanel())

    // Refresh selections/ui
    selectSide(state.activeSide)
  }
  redrawAll()
}

// Scroll the control column (not the page) so the open tool is fully visible.
function revealEditPanel() {
  const panel = elements.editPanel
  const scroller = elements.inspector
  if (!panel || !scroller) return

  const panelRect = panel.getBoundingClientRect()
  const viewRect = scroller.getBoundingClientRect()
  const overflowBelow = panelRect.bottom - viewRect.bottom
  const overflowAbove = viewRect.top - panelRect.top

  let delta = 0
  if (overflowAbove > 0) delta = -overflowAbove
  else if (overflowBelow > 0) delta = Math.min(overflowBelow, panelRect.top - viewRect.top)

  if (Math.abs(delta) > 1) {
    scroller.scrollBy({ top: delta, behavior: 'smooth' })
  }
}

function handleSideClick(e, side) {
  // If clicking canvas, this might be handled by canvas logic first, 
  // but we ensure side selection updates
  selectSide(side)
}

function selectSide(side) {
  const previousSide = state.activeSide
  state.activeSide = side

  elements.sideBefore.classList.toggle('is-selected', side === 'before')
  elements.sideAfter.classList.toggle('is-selected', side === 'after')
  elements.sideButtons.forEach(btn => {
    btn.setAttribute('aria-pressed', String(btn.dataset.side === side))
  })

  if (state.activeTool === 'filter') updateFilterUI()

  // Only drop the arrow selection when the target image actually changed.
  if (previousSide !== side) {
    state.interaction.selectedArrowIndex = -1
    updateDeleteBtn()
    redrawAll()
  }
}

// ============================================
// ARROW LOGIC (OBJECT BASED)
// ============================================
function addArrow() {
  if (!state.beforeImage || !state.afterImage) return

  // Default positions (approx 30% to 70%)
  const arrow = {
    start: { x: 0.3, y: 0.7 },
    end: { x: 0.7, y: 0.3 },
    color: state.arrowSettings.color,
    size: state.arrowSettings.size // Size remains "abstract" or pixel based? Let's keep size as simple unit, but scale drawing
  }
  const side = state.activeSide
  state.edits[side].arrows.push(arrow)
  state.interaction.selectedArrowIndex = state.edits[side].arrows.length - 1

  redrawAll()
  updateDeleteBtn()
}

function deleteArrow() {
  const side = state.activeSide
  const idx = state.interaction.selectedArrowIndex
  if (idx !== -1) {
    state.edits[side].arrows.splice(idx, 1)
    state.interaction.selectedArrowIndex = -1
    redrawAll()
    updateDeleteBtn()
  }
}

// Single entry point for the thickness slider, the steppers and pinch, so the
// slider, the readout and the selected arrow never disagree.
function setArrowSize(value, { syncSlider = true } = {}) {
  const size = Math.max(5, Math.min(35, Math.round(value)))
  state.arrowSettings.size = size
  if (syncSlider) elements.arrowSize.value = String(size)
  elements.arrowSizeVal.textContent = String(size)
  updateSelectedArrow()
}

function updateSelectedArrow() {
  const side = state.activeSide
  const idx = state.interaction.selectedArrowIndex
  if (idx !== -1) {
    state.edits[side].arrows[idx].color = state.arrowSettings.color
    state.edits[side].arrows[idx].size = state.arrowSettings.size
    redrawAll()
  }
}

// The stage placeholder is the whole onboarding flow: it shows which photo is
// still missing and fills in as they arrive.
function updatePlaceholder() {
  const have = [state.beforeImage, state.afterImage].filter(Boolean).length

  elements.placeholderPicks.forEach(btn => {
    const url = btn.dataset.pick === 'before' ? state.beforeImage : state.afterImage
    const thumb = elements.placeholderThumbs[btn.dataset.pick]
    btn.classList.toggle('has-image', Boolean(url))
    if (url && thumb.src !== url) thumb.src = url
  })

  if (have === 0) {
    elements.placeholderTitle.textContent = 'Add two photos to begin'
    elements.placeholderText.textContent =
      'Pick a before and an after shot. The best layout gets chosen for you, and what you see here is exactly what downloads.'
  } else if (have === 1) {
    const missing = state.beforeImage ? 'after' : 'before'
    elements.placeholderTitle.textContent = 'One more to go'
    elements.placeholderText.textContent = `Add the ${missing} photo to build the comparison.`
  }
}

// Swap / Share / Download only mean something once both photos are in.
function updateActionAvailability() {
  const ready = Boolean(state.beforeImage && state.afterImage)
  elements.actionButtons.forEach(btn => {
    if (btn) btn.disabled = !ready
  })
  if (elements.resetBtn) elements.resetBtn.disabled = !(state.beforeImage || state.afterImage)
}

function updateDeleteBtn() {
  elements.btnDeleteArrow.disabled = state.interaction.selectedArrowIndex === -1
}

// ============================================
// CANVAS INTERACTION (HIT TESTING)
// ============================================
function setupCanvasInteraction(canvas, side) {
  // Helpers
  function getMousePos(evt) {
    const rect = canvas.getBoundingClientRect()
    const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX
    const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    }
  }

  function hitTest(pos) {
    const arrows = state.edits[side].arrows
    const imgEl = side === 'before' ? elements.comparisonImageBefore : elements.comparisonImageAfter
    const rect = getRenderedRect(canvas, imgEl)

    // Map function: Normalized -> Pixel
    const toPx = (norm) => ({
      x: rect.x + norm.x * rect.w,
      y: rect.y + norm.y * rect.h
    })

    // Tolerances are authored in CSS pixels but the canvas is a device-pixel
    // backing store, so on a 3x phone a flat "30" was really a 10px target.
    const cssRect = canvas.getBoundingClientRect()
    const pxPerCss = cssRect.width ? canvas.width / cssRect.width : 1
    const HANDLE_R = 24 * pxPerCss
    const ARROW_BODY_TOLERANCE = 16 * pxPerCss

    // Check handles of SELECTED arrow first
    const selected = state.activeSide === side ? arrows[state.interaction.selectedArrowIndex] : null
    if (selected) {
      const idx = state.interaction.selectedArrowIndex
      const pStart = toPx(selected.start)
      const pEnd = toPx(selected.end)

      if (dist(pos, pStart) <= HANDLE_R) return { type: 'start', index: idx }
      if (dist(pos, pEnd) <= HANDLE_R) return { type: 'end', index: idx }
    }

    // Check bodies of ALL arrows
    for (let i = arrows.length - 1; i >= 0; i--) {
      const arrow = arrows[i]
      const pStart = toPx(arrow.start)
      const pEnd = toPx(arrow.end)

      // Fat arrows should stay grabbable along their whole painted width.
      const paintedHalfWidth = arrow.size * Math.max(rect.w, rect.h) / ARROW_REFERENCE_BASE
      if (distToSegment(pos, pStart, pEnd) <= Math.max(ARROW_BODY_TOLERANCE, paintedHalfWidth)) {
        return { type: 'body', index: i }
      }
    }
    return null
  }

  // Pinch State
  let initialPinchDist = 0
  let initialArrowSize = 18

  function handleDown(e) {
    if (state.activeTool !== 'arrow') return

    // Pinch Start
    if (e.touches && e.touches.length === 2) {
      e.preventDefault()
      state.interaction.isPinching = true
      initialPinchDist = touchDistance(e.touches[0], e.touches[1])
      if (state.interaction.selectedArrowIndex !== -1) {
        initialArrowSize = state.edits[side].arrows[state.interaction.selectedArrowIndex].size
      }
      return
    }

    selectSide(side)

    const pos = getMousePos(e)
    const hit = hitTest(pos)

    // Only claim the gesture when it actually lands on an arrow, so a swipe over
    // an empty part of the image still scrolls the page on touch devices.
    if (hit || !e.touches) e.preventDefault()

    if (hit) {
      state.interaction.selectedArrowIndex = hit.index
      state.interaction.isDragging = true
      state.interaction.dragMode = hit.type
      state.interaction.dragStartPos = pos // Store raw mouse pos for diff
      // clone arrow
      state.interaction.initialArrow = JSON.parse(JSON.stringify(state.edits[side].arrows[hit.index]))

      if (hit.type === 'start' || hit.type === 'end') {
        canvas.style.cursor = 'grabbing'
      } else {
        canvas.style.cursor = 'move'
      }

    } else {
      state.interaction.selectedArrowIndex = -1
    }

    redrawAll()
    updateDeleteBtn()
  }

  function handleMove(e) {
    if (state.activeTool !== 'arrow') return
    if (!state.interaction.isDragging && !state.interaction.isPinching) return
    e.preventDefault()

    // Pinch Move
    if (state.interaction.isPinching && e.touches && e.touches.length === 2) {
      const spread = touchDistance(e.touches[0], e.touches[1])
      if (initialPinchDist > 0 && state.interaction.selectedArrowIndex !== -1) {
        const ratio = spread / initialPinchDist
        let newSize = initialArrowSize * ratio
        newSize = Math.max(2, Math.min(100, newSize))
        state.edits[side].arrows[state.interaction.selectedArrowIndex].size = newSize
        state.arrowSettings.size = newSize
        elements.arrowSize.value = String(Math.round(newSize))
        elements.arrowSizeVal.textContent = String(Math.round(newSize))
        redrawAll()
      }
      return
    }

    if (!state.interaction.isDragging) return

    const pos = getMousePos(e)
    const idx = state.interaction.selectedArrowIndex
    const arr = state.edits[side].arrows[idx]
    const mode = state.interaction.dragMode

    const imgEl = side === 'before' ? elements.comparisonImageBefore : elements.comparisonImageAfter
    const rect = getRenderedRect(canvas, imgEl)

    // Convert current mouse pos to normalized
    const toNorm = (px) => ({
      x: Math.max(0, Math.min(1, (px.x - rect.x) / rect.w)),
      y: Math.max(0, Math.min(1, (px.y - rect.y) / rect.h))
    })

    if (mode === 'start') {
      arr.start = toNorm(pos)
    } else if (mode === 'end') {
      arr.end = toNorm(pos)
    } else if (mode === 'body') {
      // Calculate delta in PIXELS
      const dxPx = pos.x - state.interaction.dragStartPos.x
      const dyPx = pos.y - state.interaction.dragStartPos.y

      // Convert initial positions to pixels, add delta, then convert back to norm
      const initStartPx = {
        x: rect.x + state.interaction.initialArrow.start.x * rect.w,
        y: rect.y + state.interaction.initialArrow.start.y * rect.h
      }
      const initEndPx = {
        x: rect.x + state.interaction.initialArrow.end.x * rect.w,
        y: rect.y + state.interaction.initialArrow.end.y * rect.h
      }

      const dx = Math.max(
        -Math.min(state.interaction.initialArrow.start.x, state.interaction.initialArrow.end.x),
        Math.min(1 - Math.max(state.interaction.initialArrow.start.x, state.interaction.initialArrow.end.x), dxPx / rect.w)
      )
      const dy = Math.max(
        -Math.min(state.interaction.initialArrow.start.y, state.interaction.initialArrow.end.y),
        Math.min(1 - Math.max(state.interaction.initialArrow.start.y, state.interaction.initialArrow.end.y), dyPx / rect.h)
      )
      arr.start = {
        x: state.interaction.initialArrow.start.x + dx,
        y: state.interaction.initialArrow.start.y + dy
      }
      arr.end = {
        x: state.interaction.initialArrow.end.x + dx,
        y: state.interaction.initialArrow.end.y + dy
      }
    }

    redrawAll()
  }

  // Hover Effect for Cursor
  function handleHover(e) {
    if (state.interaction.isDragging || state.activeTool !== 'arrow') return

    const pos = getMousePos(e)
    const hit = hitTest(pos)

    if (hit) {
      if (hit.type === 'start' || hit.type === 'end') {
        canvas.style.cursor = 'grab'
      } else if (hit.type === 'body') {
        canvas.style.cursor = 'move'
      }
    } else {
      canvas.style.cursor = 'crosshair'
    }
  }

  function handleUp(e) {
    state.interaction.isDragging = false
    state.interaction.isPinching = false
    state.interaction.dragMode = null
    state.interaction.initialArrow = null
    canvas.style.cursor = 'default'
    redrawAll() // Re-draw to show handles again
  }

  canvas.addEventListener('mousedown', handleDown)
  canvas.addEventListener('mousemove', handleMove)
  canvas.addEventListener('mousemove', handleHover) // Separate listener for cursor updates
  canvas.addEventListener('mouseup', handleUp)
  canvas.addEventListener('mouseleave', handleUp)

  canvas.addEventListener('touchstart', handleDown, { passive: false })
  canvas.addEventListener('touchmove', handleMove, { passive: false })
  canvas.addEventListener('touchend', handleUp)
}

// Math Helpers
function touchDistance(p1, p2) {
  const dx = p1.clientX - p2.clientX
  const dy = p1.clientY - p2.clientY
  return Math.sqrt(dx * dx + dy * dy)
}

function dist(p1, p2) {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
}
function distToSegment(p, v, w) {
  const l2 = Math.pow(dist(v, w), 2);
  if (l2 === 0) return dist(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projection = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
  return dist(p, projection);
}

// ============================================
// DRAWING
// ============================================
function getRenderedRect(canvas, img) {
  // Calculates where the image is actually drawn on the canvas (object-fit: contain)
  const cw = canvas.width
  const ch = canvas.height
  if (!cw || !ch) return { x: 0, y: 0, w: 0, h: 0 }
  // Handle if img not loaded yet?
  const iw = img.naturalWidth || 1000
  const ih = img.naturalHeight || 1000
  const imgAspect = iw / ih
  const canvasAspect = cw / ch

  let rw, rh, rx, ry

  if (canvasAspect > imgAspect) {
    // Canvas wider: Filler on sides (Pillarbox)
    rh = ch
    rw = rh * imgAspect
    rx = (cw - rw) / 2
    ry = 0
  } else {
    // Canvas taller: Filler on top/bottom (Letterbox)
    rw = cw
    rh = rw / imgAspect
    rx = 0
    ry = (ch - rh) / 2
  }
  return { x: rx, y: ry, w: rw, h: rh }
}

function redrawAll() {
  const rectB = getRenderedRect(elements.canvasBefore, elements.comparisonImageBefore)
  redrawCanvas(elements.canvasBefore, state.edits.before.arrows, state.activeSide === 'before' ? state.interaction.selectedArrowIndex : -1, rectB)

  const rectA = getRenderedRect(elements.canvasAfter, elements.comparisonImageAfter)
  redrawCanvas(elements.canvasAfter, state.edits.after.arrows, state.activeSide === 'after' ? state.interaction.selectedArrowIndex : -1, rectA)
}

function redrawCanvas(canvas, arrows, selectedIdx, rect) {
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Use min dimension for scaling to handle aspect ratio differences between Mobile (Vertical) and Desktop
  // Mobile: 350x400 (min 350). Desktop: 600x400 (min 400).
  // This keeps the scale factor much closer (0.35 vs 0.4) compared to width-only (0.58 vs 1.0).
  const visualScale = Math.max(0.1, Math.min(rect.w, rect.h) / ARROW_REFERENCE_BASE)

  arrows.forEach((arrow, i) => {
    const isSelected = i === selectedIdx
    // Convert Normalized to Pixel for drawing
    const pxArrow = {
      start: { x: rect.x + arrow.start.x * rect.w, y: rect.y + arrow.start.y * rect.h },
      end: { x: rect.x + arrow.end.x * rect.w, y: rect.y + arrow.end.y * rect.h },
      color: arrow.color,
      size: arrow.size * visualScale
    }
    drawArrow(ctx, pxArrow, isSelected)
  })
}

function drawArrow(ctx, arrow, isSelected) {
  const { start, end, color, size } = arrow

  // Draw Arrow logic
  // Calculate Arrowhead dimensions first to determine where the line should stop
  // 'Ek dam sharp' means narrower angle and longer head
  const headAngle = Math.PI / 16  // Slightly wider angle for better visibility
  const headSize = size * 7 // Increased length for "proper arrow" look
  const backDepth = headSize * 0.2 // Depth of the concavity

  // We need to stop the line (body) before it reaches the tip, otherwise the thick line
  // renders *under* the sharp tip and ruins the pointiness (makes it look blunt/rounded).
  // We stop it at the "concave" point or slightly further back.
  // The concave point is at distance (headSize - backDepth) from the tip.
  const lineStopDist = headSize - backDepth

  const dx = end.x - start.x
  const dy = end.y - start.y
  const angle = Math.atan2(dy, dx)
  const length = Math.sqrt(dx * dx + dy * dy)

  // Calculate new end point for the line shaft
  // Ensure line doesn't go negative if arrow is shorter than head (clamp)
  const safeLength = Math.max(0, length - lineStopDist)
  const lineEnd = {
    x: start.x + (Math.cos(angle) * safeLength),
    y: start.y + (Math.sin(angle) * safeLength)
  }

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Glow if selected
  if (isSelected) {
    ctx.shadowColor = 'rgba(0, 100, 255, 0.5)'
    ctx.shadowBlur = 15
  } else {
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
  }

  ctx.lineWidth = size
  ctx.strokeStyle = color
  ctx.fillStyle = color

  // Draw Line (Shaft) - Stops at base of head
  ctx.beginPath()
  ctx.moveTo(start.x, start.y)
  ctx.lineTo(lineEnd.x, lineEnd.y) // Use shortened end
  ctx.stroke()

  // Draw Dashed Spine if selected (To help see the path)
  if (isSelected) {
    ctx.save()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y) // Spine goes all the way for visual continuity? Or match shaft? 
    // Let's Keep spine all the way so user knows where the actual endpoint is (the tip)
    ctx.stroke()
    ctx.restore()
  }

  // Arrowhead (Sharper, more professional)
  // Already defined constants above


  ctx.beginPath()
  ctx.moveTo(end.x, end.y)
  // Left point
  ctx.lineTo(end.x - headSize * Math.cos(angle - headAngle), end.y - headSize * Math.sin(angle - headAngle))
  // Slightly concave back to make it look like a spike/thorn
  // backDepth is already calculated above
  ctx.lineTo(end.x - (headSize - backDepth) * Math.cos(angle), end.y - (headSize - backDepth) * Math.sin(angle))
  // Right point
  ctx.lineTo(end.x - headSize * Math.cos(angle + headAngle), end.y - headSize * Math.sin(angle + headAngle))

  ctx.closePath() // Close path to tip
  ctx.fill()

  // Reset Shadow for handles
  ctx.shadowBlur = 0

  // Draw Handles if selected AND NOT DRAGGING AND arrow tool is active
  if (isSelected && !state.interaction.isDragging && state.activeTool === 'arrow') {
    drawHandle(ctx, start) // Tail
    drawHandle(ctx, end)   // Head
  }
}

function drawHandle(ctx, pos) {
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#2563eb'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
}

function resizeCanvas(canvas) {
  const rect = canvas.parentElement.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.max(1, Math.round(rect.width * dpr))
  canvas.height = Math.max(1, Math.round(rect.height * dpr))
}


// ============================================
// FILTERS (Improved)
// ============================================
function updateFilterUI() {
  const filters = state.edits[state.activeSide].filters
  elements.brightnessSlider.value = filters.brightness
  elements.contrastSlider.value = filters.contrast
  elements.saturateSlider.value = filters.saturate

  elements.brightnessVal.innerText = filters.brightness + '%'
  elements.contrastVal.innerText = filters.contrast + '%'
  elements.saturateVal.innerText = filters.saturate + '%'
}

function updateFilters() {
  const filters = state.edits[state.activeSide].filters
  filters.brightness = Number(elements.brightnessSlider.value)
  filters.contrast = Number(elements.contrastSlider.value)
  filters.saturate = Number(elements.saturateSlider.value)

  updateFilterUI()
  applyCSSFilters()
}

// Returns the CSS filter for a side, or 'none' when it is untouched - handing
// the browser 'none' avoids promoting the image to its own compositing layer.
function filterStringFor(side) {
  const f = state.edits[side].filters
  const b = Number(f.brightness)
  const c = Number(f.contrast)
  const sat = Number(f.saturate)
  if (b === 100 && c === 100 && sat === 100) return 'none'
  return `brightness(${b}%) contrast(${c}%) saturate(${sat}%)`
}

function applyCSSFilters() {
  elements.comparisonImageBefore.style.filter = filterStringFor('before')
  elements.comparisonImageAfter.style.filter = filterStringFor('after')
}

function resetCurrentFilters() {
  const side = state.activeSide
  state.edits[side].filters = { brightness: 100, contrast: 100, saturate: 100 }
  updateFilterUI()
  applyCSSFilters()
}


// ============================================
// UTILS & BOILERPLATE
// ============================================
function handleImageUpload(event, type) {
  const file = event.target.files[0]
  event.target.value = ''
  if (file) processImageFile(file, type)
}

async function processImageFile(file, type) {
  if (!file.type.startsWith('image/')) {
    alert('Please choose an image file.')
    return
  }

  if (file.size > MAX_IMAGE_BYTES) {
    alert('Please choose an image smaller than 20 MB.')
    return
  }

  // Blob URLs instead of base64 data URLs: a 20 MB photo would otherwise become
  // a ~27 MB string held in memory twice over, which is what pushed phones into
  // reloading the tab mid-edit.
  const imageUrl = URL.createObjectURL(file)
  const previousUrl = type === 'before' ? state.beforeImage : state.afterImage

  let image
  try {
    image = await loadImage(imageUrl)
  } catch (error) {
    releaseObjectURL(imageUrl)
    console.error('Image upload failed:', error)
    alert('This image could not be loaded. Please choose a valid image file.')
    return
  }

  state.edits[type] = createEdits()
  state.interaction.selectedArrowIndex = -1
  applyCSSFilters()

  const meta = { w: image.naturalWidth, h: image.naturalHeight }

  if (type === 'before') {
    state.beforeImage = imageUrl
    state.beforeMeta = meta
    elements.beforePreview.src = imageUrl
    elements.beforeUploadArea.classList.add('has-image')
  } else {
    state.afterImage = imageUrl
    state.afterMeta = meta
    elements.afterPreview.src = imageUrl
    elements.afterUploadArea.classList.add('has-image')
  }

  updateActionAvailability()
  updatePlaceholder()
  await checkAndShowComparison()
  releaseObjectURL(previousUrl)
}

function releaseObjectURL(url) {
  if (url && url.startsWith('blob:')) URL.revokeObjectURL(url)
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not decode image'))
    image.src = src
  })
}

async function waitForImageElement(image) {
  if (image.complete && image.naturalWidth) {
    if (image.decode) await image.decode().catch(() => {})
    return
  }
  await new Promise((resolve, reject) => {
    image.addEventListener('load', resolve, { once: true })
    image.addEventListener('error', () => reject(new Error('Could not display image')), { once: true })
  })
}

async function checkAndShowComparison() {
  if (!state.beforeImage || !state.afterImage) return

  const firstReveal = !elements.app.classList.contains('images-ready')

  elements.comparisonImageBefore.src = state.beforeImage
  elements.comparisonImageAfter.src = state.afterImage

  elements.app.classList.add('images-ready')
  elements.imageOnlyPanels.forEach(panel => { panel.hidden = false })
  updateActionAvailability()

  // Lay out before the first paint. The engine only needs the natural sizes,
  // which are already known, so the collage never flashes at the wrong shape
  // while the browser decodes the images.
  applyLayout()
  selectSide(state.activeSide)

  await Promise.all([
    waitForImageElement(elements.comparisonImageBefore),
    waitForImageElement(elements.comparisonImageAfter)
  ]).catch(() => {})

  // Re-measure once the panes have their final size on screen.
  refreshCollageGeometry()

  if (firstReveal) {
    elements.collageContainer.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

// ============================================
// SMART LAYOUT ENGINE
// ============================================
// There are two ways to place a pair of images, and both are fully determined
// by the two aspect ratios:
//
//   Side by side matches the HEIGHTS, so the widths add up -> aspect a1 + a2
//   Top & bottom matches the WIDTHS, so the heights add up -> aspect 1/(1/a1 + 1/a2)
//
// Portrait photos (a < 1) therefore land close to square side by side and get
// very tall when stacked; landscape photos do the exact opposite. Scoring both
// candidates against a square target reproduces that rule of thumb, and keeps
// working for mixed or extreme pairs where the rule of thumb runs out.

function aspectOf(meta) {
  if (!meta || !meta.w || !meta.h) return 1
  return meta.w / meta.h
}

// Geometry of the finished collage in "base units", where the matched dimension
// (shared height side by side, shared width when stacked) is exactly 1. The
// exporter runs the same function, so preview and download can never drift.
function collageGeometry(mode, a1, a2) {
  const gap = GAP_RATIO
  const frame = FRAME_RATIO

  if (mode === 'vertical') {
    const h1 = 1 / a1
    const h2 = 1 / a2
    return {
      sizes: [{ w: 1, h: h1 }, { w: 1, h: h2 }],
      totalW: 1 + frame * 2,
      totalH: h1 + h2 + gap + frame * 2,
      gap,
      frame
    }
  }

  return {
    sizes: [{ w: a1, h: 1 }, { w: a2, h: 1 }],
    totalW: a1 + a2 + gap + frame * 2,
    totalH: 1 + frame * 2,
    gap,
    frame
  }
}

function collageAspect(mode, a1, a2) {
  const geo = collageGeometry(mode, a1, a2)
  return geo.totalW / geo.totalH
}

// Distance from the target shape, measured in log space so that "twice as wide"
// and "twice as tall" are penalised equally.
function layoutCost(aspect) {
  return Math.abs(Math.log(aspect / TARGET_ASPECT))
}

function computeSmartLayout() {
  const a1 = aspectOf(state.beforeMeta)
  const a2 = aspectOf(state.afterMeta)

  const horizontal = layoutCost(collageAspect('horizontal', a1, a2))
  const vertical = layoutCost(collageAspect('vertical', a1, a2))

  // Ties (square images, or a portrait/landscape pair that mirror each other)
  // fall back to side by side: that is the conventional left-to-right read.
  return vertical < horizontal - 1e-6 ? 'vertical' : 'horizontal'
}

const LAYOUT_ICONS = {
  // Split down the middle = two images beside each other
  horizontal: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="3" x2="12" y2="21"></line></svg>',
  // Split across the middle = one image above the other
  vertical: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="12" x2="21" y2="12"></line></svg>'
}

const LAYOUT_NAMES = {
  horizontal: 'Side by side',
  vertical: 'Top & bottom'
}

function orientationName(meta) {
  const a = aspectOf(meta)
  if (a > 1.05) return 'landscape'
  if (a < 0.95) return 'portrait'
  return 'square'
}

// The cycle is derived from what is currently on screen rather than being a
// fixed order, so the very first tap always produces a visible change. From
// auto we jump straight to the opposite layout; from there the only remaining
// stop is auto again.
// The layout control is a three-way switch rather than a cycling button, so the
// current mode is always readable and any option is one tap away.
function setLayoutMode(mode) {
  if (state.layoutMode === mode) return
  state.layoutMode = mode
  applyLayout()
  showToast(mode === 'auto'
    ? `Auto layout: ${LAYOUT_NAMES[state.resolvedLayout]}`
    : LAYOUT_NAMES[state.resolvedLayout])
}

function applyLayout() {
  const container = elements.collageContainer
  if (!container) return

  state.resolvedLayout = state.layoutMode === 'auto' ? computeSmartLayout() : state.layoutMode
  const isVertical = state.resolvedLayout === 'vertical'

  const a1 = aspectOf(state.beforeMeta)
  const a2 = aspectOf(state.afterMeta)
  const geo = collageGeometry(state.resolvedLayout, a1, a2)

  container.classList.toggle('layout-vertical', isVertical)
  container.classList.toggle('layout-horizontal', !isVertical)
  container.style.setProperty('--collage-aspect', (geo.totalW / geo.totalH).toFixed(5))

  // Flex weights that give each pane exactly the size the exporter will use:
  // widths in proportion to aspect side by side, heights in proportion to the
  // inverse aspect when stacked.
  elements.sideBefore.style.setProperty('--grow', (isVertical ? 1 / a1 : a1).toFixed(5))
  elements.sideAfter.style.setProperty('--grow', (isVertical ? 1 / a2 : a2).toFixed(5))

  updateLayoutUI()
  refreshCollageGeometry()
}

function updateLayoutUI() {
  const resolved = state.resolvedLayout
  const isAuto = state.layoutMode === 'auto'
  const name = LAYOUT_NAMES[resolved]

  elements.layoutButtons.forEach(btn => {
    btn.setAttribute('aria-pressed', String(btn.dataset.mode === state.layoutMode))
  })

  const ready = Boolean(state.beforeMeta && state.afterMeta)

  if (elements.layoutHint) {
    if (!ready) {
      elements.layoutHint.textContent = 'Auto picks the shape that frames both photos best.'
    } else if (isAuto) {
      const before = orientationName(state.beforeMeta)
      const after = orientationName(state.afterMeta)
      const shape = before === after ? `${before} photos` : 'photos of different shapes'
      elements.layoutHint.innerHTML = `<strong>${name}</strong> suits ${shape}.`
    } else {
      elements.layoutHint.innerHTML = `<strong>${name}</strong>, chosen by you.`
    }
  }

  if (elements.layoutStatus) {
    elements.layoutStatus.innerHTML = ready
      ? `<strong>${name}</strong> <em>&middot; ${isAuto ? 'auto' : 'manual'}</em>`
      : ''
  }
}

// The single place that re-measures everything after the box model changes: the
// white frame, the canvas backing stores, the badges and the arrows.
// Cap the preview to the share of the workspace the stage is allowed, so the
// controls below always keep a usable amount of room. --stage-share is 0 on
// short viewports, where the page scrolls normally and the CSS fallback applies.
function updatePreviewCap() {
  const workspace = elements.workspace
  const surface = elements.stageSurface
  const container = elements.collageContainer
  if (!workspace || !surface || !container) return

  const share = parseFloat(getComputedStyle(workspace).getPropertyValue('--stage-share'))
  if (!share) {
    container.style.removeProperty('--preview-max-height')
    return
  }

  const styles = getComputedStyle(surface)
  const frame = parseFloat(styles.paddingTop || 0) + parseFloat(styles.paddingBottom || 0)
  const caption = elements.layoutStatus ? elements.layoutStatus.offsetHeight : 0
  const gap = parseFloat(getComputedStyle(elements.stageSurface.parentElement).gap || 0) || 0

  const cap = workspace.clientHeight * share - frame - caption - gap
  if (cap > 80) {
    container.style.setProperty('--preview-max-height', `${Math.floor(cap)}px`)
  }
}

function refreshCollageGeometry() {
  const container = elements.collageContainer
  if (!container) return

  updatePreviewCap()

  const a1 = aspectOf(state.beforeMeta)
  const a2 = aspectOf(state.afterMeta)
  const geo = collageGeometry(state.resolvedLayout, a1, a2)

  // Convert one "base unit" into pixels from the box the browser gave us, then
  // express the frame and gutter in the same units the exporter uses.
  const outerW = container.getBoundingClientRect().width
  if (outerW > 0) {
    const basePx = outerW / geo.totalW
    container.style.setProperty('--collage-frame', (geo.frame * basePx).toFixed(2) + 'px')
    container.style.setProperty('--collage-gap', (geo.gap * basePx).toFixed(2) + 'px')
  }

  resizeCanvas(elements.canvasBefore)
  resizeCanvas(elements.canvasAfter)
  updateBadgePositions()
  updateBadgeSize()
  redrawAll()
}

function updateBadgeSize() {
  // Mirror the exporter exactly: BADGE_RATIO of the pane's shorter side.
  const apply = (el, sideEl) => {
    if (!el || !sideEl) return
    const w = sideEl.clientWidth
    const h = sideEl.clientHeight
    if (!w || !h) return
    el.style.fontSize = Math.max(9, Math.min(w, h) * BADGE_RATIO) + 'px'
  }

  apply(elements.badgeBefore, elements.sideBefore)
  apply(elements.badgeAfter, elements.sideAfter)
}

// ============================================
// TOAST
// ============================================
let toastEl = null
let toastTimer = 0

function showToast(message) {
  if (!toastEl) {
    toastEl = document.createElement('div')
    toastEl.className = 'toast'
    toastEl.setAttribute('role', 'status')
    document.body.appendChild(toastEl)
  }

  toastEl.textContent = message
  toastEl.classList.remove('is-visible')
  // Restart the entry animation even when a toast is already on screen.
  void toastEl.offsetWidth
  toastEl.classList.add('is-visible')

  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 1800)
}

async function swapImages() {
  const tempImg = state.beforeImage
  state.beforeImage = state.afterImage
  state.afterImage = tempImg

  const tempMeta = state.beforeMeta
  state.beforeMeta = state.afterMeta
  state.afterMeta = tempMeta

  // Edits travel with their image - that is what people expect from a swap.
  const tempEdits = state.edits.before
  state.edits.before = state.edits.after
  state.edits.after = tempEdits

  elements.comparisonImageBefore.src = state.beforeImage
  elements.comparisonImageAfter.src = state.afterImage
  elements.beforePreview.src = state.beforeImage
  elements.afterPreview.src = state.afterImage

  state.interaction.selectedArrowIndex = -1
  applyCSSFilters()
  updateDeleteBtn()
  if (state.activeTool === "filter") updateFilterUI()

  // The two images can have different aspect ratios, so the panes are re-laid
  // out straight away and re-measured once the new pixels are on screen.
  applyLayout()
  await Promise.all([
    waitForImageElement(elements.comparisonImageBefore),
    waitForImageElement(elements.comparisonImageAfter)
  ]).catch(() => {})
  refreshCollageGeometry()
}

function resetApp() {
  if (confirm('Start over and clear both photos?')) location.reload()
}

// Generate Blob Helper
// ============================================
// EXPORT
// ============================================

// Safari only gained ctx.filter in v18 - without this check the brightness /
// contrast / saturation edits silently vanished from downloads on iPhones.
const supportsCanvasFilter = (() => {
  try {
    const probe = document.createElement('canvas').getContext('2d')
    if (!probe || !('filter' in probe)) return false
    probe.filter = 'brightness(150%)'
    return probe.filter !== 'none' && probe.filter !== ''
  } catch {
    return false
  }
})()

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value
}

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radius)
    return
  }
  // Fallback for Safari < 16.4, which throws on roundRect.
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

// Hand-rolled equivalent of `filter: brightness() contrast() saturate()`, run in
// the same order the CSS pipeline uses.
function applyPixelFilters(ctx, width, height, brightness, contrast, saturate) {
  const image = ctx.getImageData(0, 0, width, height)
  const px = image.data

  for (let i = 0; i < px.length; i += 4) {
    let r = px[i] * brightness
    let g = px[i + 1] * brightness
    let b = px[i + 2] * brightness

    // CSS contrast() pivots around mid grey.
    r = (r - 127.5) * contrast + 127.5
    g = (g - 127.5) * contrast + 127.5
    b = (b - 127.5) * contrast + 127.5

    // CSS saturate() interpolates against Rec.709 luma.
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    px[i] = clamp(lum + (r - lum) * saturate, 0, 255)
    px[i + 1] = clamp(lum + (g - lum) * saturate, 0, 255)
    px[i + 2] = clamp(lum + (b - lum) * saturate, 0, 255)
  }

  ctx.putImageData(image, 0, 0)
}

function drawFilteredImage(ctx, img, side, x, y, w, h) {
  const filter = filterStringFor(side)

  if (filter === 'none') {
    ctx.drawImage(img, x, y, w, h)
    return
  }

  if (supportsCanvasFilter) {
    ctx.save()
    ctx.filter = filter
    ctx.drawImage(img, x, y, w, h)
    ctx.restore()
    return
  }

  const f = state.edits[side].filters
  const scratch = document.createElement('canvas')
  scratch.width = Math.max(1, Math.round(w))
  scratch.height = Math.max(1, Math.round(h))
  const sctx = scratch.getContext('2d', { willReadFrequently: true })
  sctx.drawImage(img, 0, 0, scratch.width, scratch.height)
  applyPixelFilters(
    sctx, scratch.width, scratch.height,
    Number(f.brightness) / 100, Number(f.contrast) / 100, Number(f.saturate) / 100
  )
  ctx.drawImage(scratch, x, y, w, h)
}

async function generateComparisonBlob() {
  if (!state.beforeImage || !state.afterImage) {
    throw new Error('Upload both images before exporting.')
  }

  const [beforeImg, afterImg] = await Promise.all([
    loadImage(state.beforeImage),
    loadImage(state.afterImage)
  ])

  // Make sure Inter is available so the badges match the on-screen preview.
  if (document.fonts && document.fonts.ready) await document.fonts.ready.catch(() => {})

  const a1 = beforeImg.naturalWidth / beforeImg.naturalHeight
  const a2 = afterImg.naturalWidth / afterImg.naturalHeight
  const mode = state.resolvedLayout
  const geo = collageGeometry(mode, a1, a2)

  // One "base unit" in output pixels. Side by side that is the shared height,
  // stacked it is the shared width - taking the larger of the two sources keeps
  // full detail without ever upscaling past the original.
  const basePx = mode === 'vertical'
    ? Math.max(beforeImg.naturalWidth, afterImg.naturalWidth)
    : Math.max(beforeImg.naturalHeight, afterImg.naturalHeight)

  const rawW = geo.totalW * basePx
  const rawH = geo.totalH * basePx

  const exportScale = Math.min(
    1,
    Math.sqrt(MAX_EXPORT_PIXELS / (rawW * rawH)),
    MAX_EXPORT_SIDE / Math.max(rawW, rawH)
  )

  const unit = basePx * exportScale
  const frame = geo.frame * unit
  const gap = geo.gap * unit

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(rawW * exportScale)
  canvas.height = Math.round(rawH * exportScale)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Pane rectangles, straight out of the same geometry the preview uses.
  const isVertical = mode === 'vertical'
  const panes = [
    {
      side: 'before',
      img: beforeImg,
      label: 'BEFORE',
      color: '#dc2626',
      x: frame,
      y: frame,
      w: geo.sizes[0].w * unit,
      h: geo.sizes[0].h * unit
    },
    {
      side: 'after',
      img: afterImg,
      label: 'AFTER',
      color: '#16a34a',
      x: isVertical ? frame : frame + geo.sizes[0].w * unit + gap,
      y: isVertical ? frame + geo.sizes[0].h * unit + gap : frame,
      w: geo.sizes[1].w * unit,
      h: geo.sizes[1].h * unit
    }
  ]

  panes.forEach(pane => {
    drawFilteredImage(ctx, pane.img, pane.side, pane.x, pane.y, pane.w, pane.h)

    // Everything on top of the photo is clipped to its own pane, exactly like
    // the `overflow: hidden` on each pane in the preview.
    ctx.save()
    ctx.beginPath()
    ctx.rect(pane.x, pane.y, pane.w, pane.h)
    ctx.clip()

    drawPaneArrows(ctx, pane)
    drawPaneBadge(ctx, pane)

    ctx.restore()
  })

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('Could not create the image file.'))
    }, 'image/jpeg', 0.95)
  })
}

function drawPaneArrows(ctx, pane) {
  const arrows = state.edits[pane.side].arrows
  if (!arrows || arrows.length === 0) return

  // Same reference base as the live canvas, so an arrow keeps its proportions.
  const scaleFactor = Math.min(pane.w, pane.h) / ARROW_REFERENCE_BASE

  arrows.forEach(arrow => {
    drawArrow(ctx, {
      start: { x: pane.x + arrow.start.x * pane.w, y: pane.y + arrow.start.y * pane.h },
      end: { x: pane.x + arrow.end.x * pane.w, y: pane.y + arrow.end.y * pane.h },
      color: arrow.color,
      size: Math.max(2, arrow.size * scaleFactor)
    }, false)
  })
}

function drawPaneBadge(ctx, pane) {
  const pos = state.edits[pane.side].badge
  const fontSize = Math.min(pane.w, pane.h) * BADGE_RATIO

  ctx.font = `700 ${fontSize}px Inter, system-ui, -apple-system, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const padX = fontSize * 0.75
  const padY = fontSize * 0.42
  const boxW = ctx.measureText(pane.label).width + padX * 2
  const boxH = fontSize + padY * 2

  // Keep the pill fully inside its pane even when dragged right to the edge.
  const x = clamp(pane.x + pos.x * pane.w - boxW / 2, pane.x, pane.x + pane.w - boxW)
  const y = clamp(pane.y + pos.y * pane.h - boxH / 2, pane.y, pane.y + pane.h - boxH)

  ctx.fillStyle = pane.color
  roundRectPath(ctx, x, y, boxW, boxH, fontSize * 0.25)
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  ctx.fillText(pane.label, x + boxW / 2, y + boxH / 2)
}

// Download Handler
async function downloadComparison() {
  const originalContent = elements.downloadBtn.innerHTML
  elements.downloadBtn.disabled = true
  elements.downloadBtn.textContent = 'Processing…'

  try {
    const blob = await generateComparisonBlob()
    if (!blob) throw new Error('Could not create the image file.')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `before-after-${Date.now()}.jpg`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  } catch (e) {
    console.error(e)
    alert('Error generating image: ' + e.message)
  } finally {
    elements.downloadBtn.innerHTML = originalContent
    elements.downloadBtn.disabled = false
  }
}

// Share Handler
async function shareComparison() {
  if (!navigator.share) {
    alert('Web Share API is not supported in this browser.')
    return
  }

  const originalContent = elements.shareBtn.innerHTML
  elements.shareBtn.disabled = true
  elements.shareBtn.textContent = 'Sharing…'

  try {
    const blob = await generateComparisonBlob()
    if (!blob) throw new Error('Could not create the image file.')
    const file = new File([blob], 'before-after.jpg', { type: 'image/jpeg' })

    if (navigator.canShare && !navigator.canShare({ files: [file] })) {
      throw new Error('This browser cannot share image files.')
    }

    await navigator.share({
      files: [file]
    })
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Share failed:', err)
      alert('Share failed: ' + err.message)
    }
  } finally {
    elements.shareBtn.innerHTML = originalContent
    elements.shareBtn.disabled = false
  }
}


initApp()

// ============================================
// PWA SERVICE WORKER REGISTRATION
// With Auto-Update Support
// ============================================
if ('serviceWorker' in navigator) {
  let refreshing = false;

  // Detect controller change and reload
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    console.log('[PWA] New version activated, reloading...');
    window.location.reload();
  });

  // Register service worker
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
    .then(registration => {
      console.log('[PWA] Service Worker registered successfully');
      console.log('[PWA] ✅ App is now available OFFLINE!');

      // Check for updates every 60 seconds
      setInterval(() => {
        registration.update();
      }, 60000);

      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        console.log('[PWA] New version found, installing...');

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
            console.log('[PWA] New version installed!');
            showUpdateNotification(newWorker);
          }
        });
      });
    })
    .catch(err => {
      console.error('[PWA] Service Worker registration failed:', err);
    });
}

// Show update notification
function showUpdateNotification(worker) {
  // Create notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 16px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    animation: slideUp 0.3s ease;
    max-width: 90%;
  `;

  notification.innerHTML = `
    <span style="font-size: 24px;">🎉</span>
    <div style="flex: 1;">
      <div style="font-weight: 600; margin-bottom: 4px;">New Version Available!</div>
      <div style="font-size: 14px; opacity: 0.9;">Click to update and get new features</div>
    </div>
    <button style="
      background: white;
      color: #667eea;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      font-size: 14px;
    ">Update Now</button>
  `;

  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideUp {
      from { transform: translateX(-50%) translateY(100px); opacity: 0; }
      to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  // Add click handler
  notification.querySelector('button').addEventListener('click', () => {
    worker.postMessage('SKIP_WAITING');
    notification.remove();
  });

  document.body.appendChild(notification);

  // Auto-remove after 30 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.style.animation = 'slideUp 0.3s ease reverse';
      setTimeout(() => notification.remove(), 300);
    }
  }, 30000);
}
