// ============================================
// MOBILE-FIRST IMAGE COMPARISON APP
// Redesigned with Object-Based Arrows & Better UI
// ============================================

import './style.css'

// ============================================
// STATE MANAGEMENT
// ============================================
const state = {
  beforeImage: null,
  afterImage: null,
  activeSide: 'after', // 'before' or 'after'
  activeTool: null,    // 'arrow' or 'filter' or null
  layoutMode: 'horizontal', // 'horizontal' or 'vertical'

  // Arrow Interaction State
  interaction: {
    isDragging: false,
    dragMode: null, // 'start', 'end', 'body'
    dragStartPos: null, // {x, y} at mousedown
    initialArrow: null, // Copy of arrow before drag (for delta calcs)
    selectedArrowIndex: -1
  },

  arrowSettings: {
    color: '#dc2626',
    size: 18 // Default thicker for object look
  },

  edits: {
    before: {
      arrows: [], // { start: {x,y}, end: {x,y}, color, size }
      filters: { brightness: 100, contrast: 100, saturate: 100 },
      badge: { x: 0.5, y: 0.9 } // Normalized position (0-1)
    },
    after: {
      arrows: [],
      filters: { brightness: 100, contrast: 100, saturate: 100 },
      badge: { x: 0.5, y: 0.9 }
    }
  }
}

// ============================================
// DOM ELEMENTS
// ============================================
const elements = {
  app: document.querySelector('#app'),
  installBtn: null,
  beforeInput: null,
  afterInput: null,
  beforePreview: null,
  afterPreview: null,
  beforeUploadArea: null,
  afterUploadArea: null,
  comparisonSection: null,
  comparisonImageBefore: null,
  comparisonImageAfter: null,
  swapBtn: null,
  resetBtn: null,
  shareBtn: null,
  downloadBtn: null,

  // Tools
  toolArrow: null,
  toolFilter: null,
  arrowOptions: null,
  btnAddArrow: null,
  btnDeleteArrow: null,
  arrowSize: null,
  colorBtns: null,

  filterControls: null,
  sideBefore: null,
  sideAfter: null,
  canvasBefore: null,
  canvasAfter: null,

  brightnessSlider: null,
  contrastSlider: null,
  saturateSlider: null,
  brightnessVal: null,
  contrastVal: null,
  brightnessVal: null,
  contrastVal: null,
  saturateVal: null,

  // Badges
  badgeBefore: null,
  badgeAfter: null
}

// ============================================
// INITIALIZE APP
// ============================================
function initApp() {
  renderHTML()
  cacheElements()
  attachEventListeners()
  setupPWA()
  console.log('📱 App Initialized: Object-based Arrows Mode')
}

// ============================================
// PWA INSTALL LOGIC
// ============================================
let deferredPrompt;

function setupPWA() {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Update UI to notify the user they can add to home screen
    if (elements.installBtn) {
      elements.installBtn.style.display = 'block';

      elements.installBtn.addEventListener('click', () => {
        // Hide our user interface that shows our A2HS button
        elements.installBtn.style.display = 'none';
        // Show the prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            console.log('User accepted the A2HS prompt');
          } else {
            console.log('User dismissed the A2HS prompt');
          }
          deferredPrompt = null;
        });
      });
    }
  });
}

// ============================================
// RENDER HTML STRUCTURE
// ============================================
function renderHTML() {
  elements.app.innerHTML = `
    <!-- Header -->
    <header class="header">
      <h1 class="header__title">Before & After</h1>
      <button id="install-btn" class="btn btn--sm btn--primary" style="display: none; margin-left: auto;">⬇️ Install App</button>
    </header>

    <!-- Upload Section -->
    <section class="upload-section" id="upload-section">
      <!-- Before Upload -->
      <div class="card upload-card">
        <label class="upload-label"><span class="badge badge--before">Before</span></label>
        <div class="upload-area" id="before-upload-area">
          <div class="upload-icon">📷</div>
          <p class="upload-text">Upload Before</p>
          <input type="file" id="before-input" class="upload-input" accept="image/*" />
          <img id="before-preview" class="upload-preview" />
        </div>
      </div>

      <!-- After Upload -->
      <div class="card upload-card">
        <label class="upload-label"><span class="badge badge--after">After</span></label>
        <div class="upload-area" id="after-upload-area">
          <div class="upload-icon">📸</div>
          <p class="upload-text">Upload After</p>
          <input type="file" id="after-input" class="upload-input" accept="image/*" />
          <img id="after-preview" class="upload-preview" />
        </div>
      </div>
    </section>

    <!-- Comparison Viewer -->
    <section class="comparison-section" id="comparison-section">
      
      <!-- Toolbar -->
      <div class="editing-toolbar">
        <button class="tool-btn" id="tool-arrow">
          <span class="tool-icon">↖️</span>
          <span class="tool-label">Arrows</span>
        </button>
        <button class="tool-btn" id="tool-filter">
          <span class="tool-icon">🎨</span>
          <span class="tool-label">Filters</span>
        </button>
      </div>

      <!-- Arrow Options Panel -->
      <div class="tool-options" id="arrow-options">
         <div class="options-row">
            <button class="btn btn--sm btn--primary" id="btn-add-arrow">➕ Add Arrow</button>
            <button class="btn btn--sm btn--danger" id="btn-delete-arrow" disabled>🗑️ Delete</button>
         </div>
         <div class="options-row">
            <div class="color-picker" id="color-picker">
              <div class="color-btn active" style="background: #dc2626" data-color="#dc2626"></div>
              <div class="color-btn" style="background: #2563eb" data-color="#2563eb"></div>
              <div class="color-btn" style="background: #16a34a" data-color="#16a34a"></div>
              <div class="color-btn" style="background: #eab308" data-color="#eab308"></div>
              <div class="color-btn" style="background: #ffffff" data-color="#ffffff"></div>
              <div class="color-btn" style="background: #000000" data-color="#000000"></div>
           </div>
           <div class="size-control">
              <span class="size-label">Size</span>
              <button class="btn-size" id="btn-size-minus">-</button>
              <input type="range" id="arrow-size" min="5" max="35" value="20">
              <button class="btn-size" id="btn-size-plus">+</button>
           </div>
         </div>
         <div class="tool-hint">Select a side (Before/After) then click Add Arrow. Drag blue handles to adjust.</div>
      </div>

      <!-- Filter Controls -->
      <div class="filter-controls" id="filter-controls">
        <div class="tool-hint">Adjust filters for selected image</div>
        <div class="filter-group">
          <label>Brightness <span id="brightness-val">100%</span></label>
          <input type="range" class="filter-slider" id="brightness-slider" min="50" max="150" value="100">
        </div>
        <div class="filter-group">
          <label>Contrast <span id="contrast-val">100%</span></label>
          <input type="range" class="filter-slider" id="contrast-slider" min="50" max="150" value="100">
        </div>
        <div class="filter-group">
          <label>Saturation <span id="saturate-val">100%</span></label>
          <input type="range" class="filter-slider" id="saturate-slider" min="0" max="200" value="100">
        </div>
        <button class="btn btn--sm btn--secondary reset-filter-btn" id="btn-reset-filters">↺ Reset Filters</button>
      </div>

      <!-- Main Canvas Area -->
      <div class="card">
        <div class="collage-container" id="collage-container">
          <!-- Before Side -->
          <div class="collage-side" id="side-before" data-side="before">
            <img id="comparison-before" class="collage-image" />
            <canvas id="canvas-before" class="drawing-canvas"></canvas>
            <span class="collage-badge">before</span>
          </div>
          
          <!-- After Side -->
          <div class="collage-side" id="side-after" data-side="after">
            <img id="comparison-after" class="collage-image" />
            <canvas id="canvas-after" class="drawing-canvas"></canvas>
            <span class="collage-badge">after</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="controls">
          <button class="btn btn--secondary" id="swap-btn">🔄 Swap</button>
          <button class="btn btn--secondary" id="layout-btn">↕️ Layout</button>
          <button class="btn btn--primary" id="share-btn">🔗 Share</button>
          <button class="btn btn--primary" id="download-btn">💾 Download</button>
          <button class="btn btn--accent" id="reset-btn">♻️ Reset</button>
        </div>
      </div>
    </section>
  `
}

// ============================================
// CACHE ELEMENTS
// ============================================
function cacheElements() {
  elements.app = document.querySelector('#app')
  elements.installBtn = document.querySelector('#install-btn')
  elements.beforeInput = document.getElementById('before-input')
  elements.afterInput = document.getElementById('after-input')
  elements.beforePreview = document.getElementById('before-preview')
  elements.afterPreview = document.getElementById('after-preview')
  elements.beforeUploadArea = document.getElementById('before-upload-area')
  elements.afterUploadArea = document.getElementById('after-upload-area')
  elements.comparisonSection = document.getElementById('comparison-section')
  elements.comparisonImageBefore = document.getElementById('comparison-before')
  elements.comparisonImageAfter = document.getElementById('comparison-after')
  elements.swapBtn = document.getElementById('swap-btn')
  elements.layoutBtn = document.getElementById('layout-btn')
  elements.resetBtn = document.getElementById('reset-btn')
  elements.shareBtn = document.getElementById('share-btn')
  elements.downloadBtn = document.getElementById('download-btn')
  elements.editingToolbar = document.querySelector('.editing-toolbar')
  elements.controls = document.querySelector('.controls')
  elements.app = document.getElementById('app') // Ensure app is cached too if not already (it serves as container for class)

  // Tools
  elements.toolArrow = document.getElementById('tool-arrow')
  elements.toolFilter = document.getElementById('tool-filter')
  elements.arrowOptions = document.getElementById('arrow-options')
  elements.btnAddArrow = document.getElementById('btn-add-arrow')
  elements.btnDeleteArrow = document.getElementById('btn-delete-arrow')
  elements.arrowSize = document.getElementById('arrow-size')
  elements.btnSizeMinus = document.getElementById('btn-size-minus')
  elements.btnSizePlus = document.getElementById('btn-size-plus')
  elements.colorBtns = document.querySelectorAll('.color-btn')

  elements.filterControls = document.getElementById('filter-controls')
  elements.sideBefore = document.getElementById('side-before')
  elements.sideAfter = document.getElementById('side-after')
  elements.canvasBefore = document.getElementById('canvas-before')
  elements.canvasAfter = document.getElementById('canvas-after')

  elements.brightnessSlider = document.getElementById('brightness-slider')
  elements.contrastSlider = document.getElementById('contrast-slider')
  elements.saturateSlider = document.getElementById('saturate-slider')
  elements.brightnessVal = document.getElementById('brightness-val')
  elements.contrastVal = document.getElementById('contrast-val')
  elements.saturateVal = document.getElementById('saturate-val')
  elements.btnResetFilters = document.getElementById('btn-reset-filters')

  elements.badgeBefore = elements.sideBefore.querySelector('.collage-badge')
  elements.badgeAfter = elements.sideAfter.querySelector('.collage-badge')
}

// ============================================
// EVENTS & LOGIC
// ============================================
function attachEventListeners() {
  // Uploads
  elements.beforeUploadArea.addEventListener('click', () => elements.beforeInput.click())
  elements.afterUploadArea.addEventListener('click', () => elements.afterInput.click())
  elements.beforeInput.addEventListener('change', (e) => handleImageUpload(e, 'before'))
  elements.afterInput.addEventListener('change', (e) => handleImageUpload(e, 'after'))

  // Controls
  elements.swapBtn.addEventListener('click', swapImages)
  elements.layoutBtn.addEventListener('click', toggleLayout)
  elements.resetBtn.addEventListener('click', resetApp)
  if (elements.shareBtn) elements.shareBtn.addEventListener('click', shareComparison)
  elements.downloadBtn.addEventListener('click', downloadComparison)

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.activeTool === 'arrow') {
      deleteArrow()
    }
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
    state.arrowSettings.size = parseInt(e.target.value)
    updateSelectedArrow()
  })

  elements.btnSizeMinus.addEventListener('click', () => {
    let val = parseInt(elements.arrowSize.value)
    val = Math.max(5, val - 1)
    elements.arrowSize.value = val
    state.arrowSettings.size = val
    updateSelectedArrow()
  })

  let val = parseInt(elements.arrowSize.value)
  val = Math.min(35, val + 1)
  elements.arrowSize.value = val
  state.arrowSettings.size = val
  updateSelectedArrow()

  elements.colorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.colorBtns.forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
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

  window.addEventListener('resize', () => {
    requestAnimationFrame(() => {
      resizeCanvas(elements.canvasBefore)
      resizeCanvas(elements.canvasAfter)
      redrawAll()
      updateBadgePositions()
    })
  })

  // Badge Interaction
  setupBadgeDrag(elements.badgeBefore, 'before')
  setupBadgeDrag(elements.badgeAfter, 'after')
}
function updateBadgePositions() {
  // Sync UI Badges with State (useful on resize)
  const setPos = (el, pos, container) => {
    const w = container.clientWidth
    const h = container.clientHeight
    el.style.left = (pos.x * w) + 'px'
    el.style.top = (pos.y * h) + 'px'
    el.style.bottom = 'auto' // Override default CSS
    el.style.transform = 'translate(-50%, -50%)' // Center anchor
  }

  // Only update if state is set (initially might rely on CSS)
  // But better to initialize state to CSS default or force one.
  // Let's force initialized position on first drag or load?
  // Actually, let's keep CSS default until dragged.
  // Check if we have touched logic yet
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

    // Calculate normalized position relative to CONTAINER (not image content, for UI simplicity)
    // Or should it be image content? If image content, it stays with image features.
    // User asked "adjust position". Image content is safer for responsive layout.

    // Let's use CONTAINER coordinates for simpler UI feeling first?
    // No, normalized is best.

    let x = (clientX - rect.left) / rect.width
    let y = (clientY - rect.top) / rect.height

    x = Math.max(0.05, Math.min(0.95, x))
    y = Math.max(0.05, Math.min(0.95, y))

    // Update State
    state.edits[side].badge = { x, y }

    // Update UI
    el.style.left = (x * 100) + '%'
    el.style.top = (y * 100) + '%'
    el.style.bottom = 'auto'
    el.style.transform = 'translate(-50%, -50%)'
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
    elements.arrowOptions.classList.remove('active')
    elements.filterControls.classList.remove('active')
    document.body.classList.remove('arrow-mode', 'filter-mode')
  } else {
    state.activeTool = tool
    elements.toolArrow.classList.toggle('active', tool === 'arrow')
    elements.toolFilter.classList.toggle('active', tool === 'filter')
    elements.arrowOptions.classList.toggle('active', tool === 'arrow')
    elements.filterControls.classList.toggle('active', tool === 'filter')

    document.body.classList.remove('arrow-mode', 'filter-mode')
    if (tool === 'arrow') {
      document.body.classList.add('arrow-mode')
      // Auto-add arrow if none exist on active side? Or just always add one?
      // User request: "Arrows button par click karte hi ek ek arrow add ho jaye"
      // Let's add one. 
      addArrow()
    }
    if (tool === 'filter') document.body.classList.add('filter-mode')

    // Refresh selections/ui
    selectSide(state.activeSide)
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

  // Update UI for filters
  if (state.activeTool === 'filter') updateFilterUI()

  // Only reset arrow selection if we actually CHANGED sides
  if (previousSide !== side) {
    state.interaction.selectedArrowIndex = -1
  }
}

// ============================================
// ARROW LOGIC (OBJECT BASED)
// ============================================
function addArrow() {
  if (!elements.comparisonSection.classList.contains('active')) return

  // Calculate proportional size (relative to Image, not canvas)
  // Store normalized coordinates (0-1) relative to the IMAGE CONTENT rect
  const rectB = getRenderedRect(elements.canvasBefore, elements.comparisonImageBefore)
  const rectA = getRenderedRect(elements.canvasAfter, elements.comparisonImageAfter)

  // Default positions (approx 30% to 70%)
  const arrowBefore = {
    start: { x: 0.3, y: 0.7 },
    end: { x: 0.7, y: 0.3 },
    color: state.arrowSettings.color,
    size: state.arrowSettings.size // Size remains "abstract" or pixel based? Let's keep size as simple unit, but scale drawing
  }
  state.edits.before.arrows.push(arrowBefore)

  const arrowAfter = {
    start: { x: 0.3, y: 0.7 },
    end: { x: 0.7, y: 0.3 },
    color: state.arrowSettings.color,
    size: state.arrowSettings.size
  }
  state.edits.after.arrows.push(arrowAfter)

  // Select the arrow on the ACTIVE side so user can see handles immediately
  const side = state.activeSide
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

function updateSelectedArrow() {
  const side = state.activeSide
  const idx = state.interaction.selectedArrowIndex
  if (idx !== -1) {
    state.edits[side].arrows[idx].color = state.arrowSettings.color
    state.edits[side].arrows[idx].size = state.arrowSettings.size
    redrawAll()
  }
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

    const HANDLE_R = 30
    const ARROW_BODY_TOLERANCE = 30

    // Pinch helpers
    function getDist(p1, p2) {
      const dx = p1.clientX - p2.clientX
      const dy = p1.clientY - p2.clientY
      return Math.sqrt(dx * dx + dy * dy)
    }

    // Check handles of SELECTED arrow first
    if (state.activeSide === side && state.interaction.selectedArrowIndex !== -1) {
      const idx = state.interaction.selectedArrowIndex
      const arrow = arrows[idx]
      if (!arrow) return null

      const pStart = toPx(arrow.start)
      const pEnd = toPx(arrow.end)

      if (dist(pos, pStart) <= HANDLE_R) return { type: 'start', index: idx }
      if (dist(pos, pEnd) <= HANDLE_R) return { type: 'end', index: idx }
    }

    // Check bodies of ALL arrows
    for (let i = arrows.length - 1; i >= 0; i--) {
      const arrow = arrows[i]
      const pStart = toPx(arrow.start)
      const pEnd = toPx(arrow.end)

      if (distToSegment(pos, pStart, pEnd) <= Math.max(ARROW_BODY_TOLERANCE, arrow.size)) {
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
      state.interaction.isPinching = true
      initialPinchDist = getDist(e.touches[0], e.touches[1])
      if (state.interaction.selectedArrowIndex !== -1) {
        initialArrowSize = state.edits[side].arrows[state.interaction.selectedArrowIndex].size
      }
      return
    }

    e.preventDefault()
    selectSide(side)

    const pos = getMousePos(e)
    const hit = hitTest(pos)

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
    e.preventDefault()

    // Pinch Move
    if (state.interaction.isPinching && e.touches && e.touches.length === 2) {
      const dist = getDist(e.touches[0], e.touches[1])
      if (initialPinchDist > 0 && state.interaction.selectedArrowIndex !== -1) {
        const ratio = dist / initialPinchDist
        let newSize = initialArrowSize * ratio
        newSize = Math.max(2, Math.min(100, newSize))
        state.edits[side].arrows[state.interaction.selectedArrowIndex].size = newSize
        state.arrowSettings.size = newSize
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
      x: (px.x - rect.x) / rect.w,
      y: (px.y - rect.y) / rect.h
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

      arr.start = toNorm({ x: initStartPx.x + dxPx, y: initStartPx.y + dyPx })
      arr.end = toNorm({ x: initEndPx.x + dxPx, y: initEndPx.y + dyPx })
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
  const REFERENCE_BASE = 1000
  const visualScale = Math.max(0.1, Math.min(rect.w, rect.h) / REFERENCE_BASE)

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

  // Draw Handles if selected AND NOT DRAGGING
  if (isSelected && !state.interaction.isDragging) {
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
  canvas.width = rect.width
  canvas.height = rect.height
  // Does NOT clear logical arrows, just display buffer
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
  filters.brightness = elements.brightnessSlider.value
  filters.contrast = elements.contrastSlider.value
  filters.saturate = elements.saturateSlider.value

  updateFilterUI()
  applyCSSFilters()
}

function applyCSSFilters() {
  const b = state.edits.before.filters
  elements.comparisonImageBefore.style.filter =
    `brightness(${b.brightness}%) contrast(${b.contrast}%) saturate(${b.saturate}%)`

  const a = state.edits.after.filters
  elements.comparisonImageAfter.style.filter =
    `brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturate}%)`
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
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const imageUrl = e.target.result
    if (type === 'before') {
      state.beforeImage = imageUrl
      elements.beforePreview.src = imageUrl
      elements.beforePreview.style.display = 'block' // Force show
      elements.beforeUploadArea.classList.add('has-image') // Trigger CSS state
    } else {
      state.afterImage = imageUrl
      elements.afterPreview.src = imageUrl
      elements.afterPreview.style.display = 'block' // Force show
      elements.afterUploadArea.classList.add('has-image') // Trigger CSS state
    }

    // We check for comparison mode, but we don't hide the upload preview anymore until then?
    // Actually the upload preview sits in the upload box. The comparison mode is separate.
    checkAndShowComparison()
  }
  reader.readAsDataURL(file)
}

function checkAndShowComparison() {
  if (state.beforeImage && state.afterImage) {
    elements.comparisonImageBefore.src = state.beforeImage
    elements.comparisonImageAfter.src = state.afterImage
    elements.comparisonImageAfter.src = state.afterImage
    elements.comparisonSection.classList.add('active')

    // Reveal all UI
    elements.app.classList.add('reveal-ui')

    setTimeout(() => {
      resizeCanvas(elements.canvasBefore)
      resizeCanvas(elements.canvasAfter)
      selectSide('after')
      updateBadgeSize() // Initial scale
      elements.comparisonSection.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 200)
  }
}

function toggleLayout() {
  state.layoutMode = state.layoutMode === 'horizontal' ? 'vertical' : 'horizontal'
  const isVertical = state.layoutMode === 'vertical'

  document.getElementById('collage-container').classList.toggle('layout-vertical', isVertical)
  elements.layoutBtn.innerText = isVertical ? '↔️ Layout' : '↕️ Layout'

  // Re-measure canvas after layout change
  // Re-measure canvas after layout change
  requestAnimationFrame(() => {
    resizeCanvas(elements.canvasBefore)
    resizeCanvas(elements.canvasAfter)
    redrawAll()
    updateBadgeSize() // Scaling update
  })
}

function updateBadgeSize() {
  // Sync live badge size with download logic: min(W,H) * 0.04
  const container = document.querySelector('.collage-side')
  if (!container) return

  const w = container.clientWidth
  const h = container.clientHeight
  // Logic from download: const fontSize = Math.min(canvasW, canvasH) * 0.04
  // Live canvas is usually half of download in side-by-side, or full in vertical.
  // We need to visually approximate. 

  // Use slightly smaller multiplier for CSS pixel values vs Canvas pixels
  const fontSize = Math.max(12, Math.min(w, h) * 0.05) + 'px'

  document.querySelectorAll('.collage-badge').forEach(el => {
    el.style.fontSize = fontSize
    // Scale padding slightly with font?
    // padding: 0.25em 0.75em
    el.style.padding = '0.3em 0.9em'
  })
}

// Add to window resize
window.addEventListener('resize', () => {
  resizeCanvas(elements.canvasBefore)
  resizeCanvas(elements.canvasAfter)
  updateBadgeSize()
})

function swapImages() {
  // Swap Logic
  const tempImg = state.beforeImage
  state.beforeImage = state.afterImage
  state.afterImage = tempImg

  // Swap Edits? Usually users expect edits to stick to the image, ie. if I swap, the edits should swap too.
  // But complex to track if I don't use unique IDs for images. 
  // For now, simpler: Reset edits or keep them? 
  // Let's Keep edits on their respective SIDES (before area keeps before arrows). 
  // Or swap edits? Swapping edits is better UX.

  const tempEdits = JSON.parse(JSON.stringify(state.edits.before))
  state.edits.before = JSON.parse(JSON.stringify(state.edits.after))
  state.edits.after = tempEdits

  // Apply
  elements.comparisonImageBefore.src = state.beforeImage
  elements.comparisonImageAfter.src = state.afterImage
  applyCSSFilters()
  redrawAll()
}

function resetApp() {
  if (confirm("Start over?")) location.reload()
}

// Generate Blob Helper
async function generateComparisonBlob() {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const beforeImg = new Image(); beforeImg.src = state.beforeImage
  const afterImg = new Image(); afterImg.src = state.afterImage

  await Promise.all([
    new Promise(r => beforeImg.onload = r),
    new Promise(r => afterImg.onload = r)
  ])

  const isVertical = state.layoutMode === 'vertical'
  const gap = 40
  const border = 40

  let wB, hB, wA, hA, canvasW, canvasH, xB, yB, xA, yA

  if (isVertical) {
    // Vertical: Align by Width
    const w = Math.max(beforeImg.width, afterImg.width)
    const scaleB = w / beforeImg.width
    const scaleA = w / afterImg.width
    wB = w
    hB = beforeImg.height * scaleB
    wA = w
    hA = afterImg.height * scaleA

    canvasW = w + border * 2
    canvasH = hB + hA + gap + border * 2

    xB = border
    yB = border
    xA = border
    yA = border + hB + gap
  } else {
    // Horizontal: Align by Height
    const h = Math.max(beforeImg.height, afterImg.height)
    const scaleB = h / beforeImg.height
    const scaleA = h / afterImg.height
    wB = beforeImg.width * scaleB
    hB = h
    wA = afterImg.width * scaleA
    hA = h

    canvasW = wB + wA + gap + border * 2
    canvasH = h + border * 2

    xB = border
    yB = border
    xA = border + wB + gap
    yA = border
  }

  canvas.width = canvasW
  canvas.height = canvasH

  ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Draw Images
  ctx.save()
  ctx.filter = elements.comparisonImageBefore.style.filter
  ctx.drawImage(beforeImg, xB, yB, wB, hB)
  ctx.restore()

  ctx.save()
  ctx.filter = elements.comparisonImageAfter.style.filter
  ctx.drawImage(afterImg, xA, yA, wA, hA)
  ctx.restore()

  // Draw Arrows
  function renderArr(sideArgs, outputX, outputY, targetW, targetH) {
    const arrowList = state.edits[sideArgs].arrows
    if (!arrowList || arrowList.length === 0) return

    const imgEl = sideArgs === 'before' ? elements.comparisonImageBefore : elements.comparisonImageAfter
    const canvasEl = sideArgs === 'before' ? elements.canvasBefore : elements.canvasAfter

    // Correct Aspect Ratio Mapping
    const imgAspect = imgEl.naturalWidth / imgEl.naturalHeight
    const canvasAspect = canvasEl.width / canvasEl.height

    let renderW, renderH, offsetX, offsetY

    if (canvasAspect > imgAspect) {
      // Canvas is wider than image (Pillarbox)
      renderH = canvasEl.height
      renderW = renderH * imgAspect
      offsetX = (canvasEl.width - renderW) / 2
      offsetY = 0
    } else {
      // Canvas is taller than image (Letterbox)
      renderW = canvasEl.width
      renderH = renderW / imgAspect
      offsetX = 0
      offsetY = (canvasEl.height - renderH) / 2
    }

    arrowList.forEach(arrow => {
      // Logic is already normalized now! 
      // Arrow contains 0-1 coords. 
      // We just need to map them to the download output rect (outputX, outputY, targetW, targetH)

      const p1 = {
        x: outputX + arrow.start.x * targetW,
        y: outputY + arrow.start.y * targetH
      }
      const p2 = {
        x: outputX + arrow.end.x * targetW,
        y: outputY + arrow.end.y * targetH
      }

      // ACCURATE SCALING:
      // We scale based on REFERENCE_BASE (1000) using min dimension
      const REFERENCE_BASE = 1000
      const scaleFactor = Math.min(targetW, targetH) / REFERENCE_BASE
      const scaledSize = Math.max(2, arrow.size * scaleFactor)

      const tempArrow = { start: p1, end: p2, color: arrow.color, size: scaledSize }
      drawArrow(ctx, tempArrow, false) // False = no handles
    })
  }

  renderArr('before', xB, yB, wB, hB)
  renderArr('after', xA, yA, wA, hA)

  // Badges
  const fontSize = Math.min(canvasW, canvasH) * 0.04
  ctx.font = `bold ${fontSize}px sans-serif`
  ctx.textAlign = 'center'

  function drawBadge(text, cx, cy) {
    const tw = ctx.measureText(text).width + 40
    const th = fontSize + 20
    const radius = Math.max(4, fontSize * 0.15) // Sharp but polished (approx 4px-8px visuals)
    ctx.fillStyle = '#dc2626'
    ctx.beginPath(); ctx.roundRect(cx - tw / 2, cy - th / 2, tw, th, radius); ctx.fill()
    ctx.fillStyle = 'white'
    ctx.fillText(text, cx, cy + fontSize * 0.3)
  }

  // Draw Before Badge
  const badgePosB = state.edits.before.badge
  const bX = xB + badgePosB.x * wB
  const bY = yB + badgePosB.y * hB

  drawBadge('BEFORE', bX, bY)

  // Draw After Badge
  const badgePosA = state.edits.after.badge
  const aX = xA + badgePosA.x * wA
  const aY = yA + badgePosA.y * hA
  drawBadge('AFTER', aX, aY)

  return new Promise((resolve) => {
    canvas.toBlob(blob => {
      resolve(blob)
    }, 'image/jpeg', 0.95)
  })
}

// Download Handler
async function downloadComparison() {
  const originalText = elements.downloadBtn.innerText
  elements.downloadBtn.innerText = '⏳ Processing...'

  try {
    const blob = await generateComparisonBlob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `before-after-${Date.now()}.jpg`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error(e)
    alert('Error generating image: ' + e.message)
  } finally {
    elements.downloadBtn.innerText = originalText
  }
}

// Share Handler
async function shareComparison() {
  if (!navigator.share) {
    alert('Web Share API is not supported in this browser.')
    return
  }

  const originalText = elements.shareBtn.innerText
  elements.shareBtn.innerText = '⏳...'

  try {
    const blob = await generateComparisonBlob()
    const file = new File([blob], 'before-after.jpg', { type: 'image/jpeg' })

    await navigator.share({
      title: 'Before & After Comparison',
      text: 'Check out this professional before & after comparison!',
      files: [file]
    })
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Share failed:', err)
      alert('Share failed: ' + err.message)
    }
  } finally {
    elements.shareBtn.innerText = originalText
  }
}


initApp()

// PWA Logic
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(console.error)
}
