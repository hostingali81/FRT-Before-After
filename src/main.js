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
    size: 10 // Default thicker for object look
  },

  edits: {
    before: {
      arrows: [], // { start: {x,y}, end: {x,y}, color, size }
      filters: { brightness: 100, contrast: 100, saturate: 100 }
    },
    after: {
      arrows: [],
      filters: { brightness: 100, contrast: 100, saturate: 100 }
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
  saturateVal: null
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
              <input type="range" id="arrow-size" min="5" max="25" value="10">
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
    })
  })
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
    if (tool === 'arrow') document.body.classList.add('arrow-mode')
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

  // Calculate proportional size (e.g., 1.5% of width, constrained)
  // This ensures arrows aren't huge on small screens or tiny on large ones
  const defaultSize = Math.max(5, Math.min(25, Math.round(elements.canvasBefore.width * 0.015)))

  // Use state setting if user explicitly picked one, but if it's default 10, try to be smart?
  // Actually, better to just set the initial size based on canvas if it's the first time, 
  // or just override the default "10" with this calculated value.
  // Let's just use the calculated value as the new "default" for this arrow.
  const arrowSize = state.arrowSettings.size === 10 ? defaultSize : state.arrowSettings.size

  // Create arrow for Before side
  const wB = elements.canvasBefore.width
  const hB = elements.canvasBefore.height
  const arrowBefore = {
    start: { x: wB * 0.3, y: hB * 0.7 },
    end: { x: wB * 0.7, y: hB * 0.3 },
    color: state.arrowSettings.color,
    size: arrowSize
  }
  state.edits.before.arrows.push(arrowBefore)

  // Create arrow for After side
  const wA = elements.canvasAfter.width
  const hA = elements.canvasAfter.height
  const arrowAfter = {
    start: { x: wA * 0.3, y: hA * 0.7 },
    end: { x: wA * 0.7, y: hA * 0.3 },
    color: state.arrowSettings.color,
    size: arrowSize
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
    const HANDLE_R = 30 // Generous touch target (60px diameter)
    const ARROW_BODY_TOLERANCE = 30 // Easy to grab body

    // Check handles of SELECTED arrow first
    if (state.activeSide === side && state.interaction.selectedArrowIndex !== -1) {
      const idx = state.interaction.selectedArrowIndex
      const arrow = arrows[idx]
      if (!arrow) return null

      if (dist(pos, arrow.start) <= HANDLE_R) return { type: 'start', index: idx }
      if (dist(pos, arrow.end) <= HANDLE_R) return { type: 'end', index: idx }
    }

    // Check bodies of ALL arrows (reverse order for z-index)
    for (let i = arrows.length - 1; i >= 0; i--) {
      const arrow = arrows[i]
      // Much larger hit tolerance for body dragging
      if (distToSegment(pos, arrow.start, arrow.end) <= Math.max(ARROW_BODY_TOLERANCE, arrow.size)) {
        return { type: 'body', index: i }
      }
    }
    return null
  }

  function handleDown(e) {
    if (state.activeTool !== 'arrow') return
    e.preventDefault() // prevent scroll
    selectSide(side) // Make this side active

    const pos = getMousePos(e)
    const hit = hitTest(pos)

    if (hit) {
      state.interaction.selectedArrowIndex = hit.index
      state.interaction.isDragging = true
      state.interaction.dragMode = hit.type
      state.interaction.dragStartPos = pos
      // clone arrow for delta calcs
      state.interaction.initialArrow = JSON.parse(JSON.stringify(state.edits[side].arrows[hit.index]))

      // Set Cursor
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
    if (!state.interaction.isDragging || state.activeTool !== 'arrow') return
    e.preventDefault()

    const pos = getMousePos(e)
    const idx = state.interaction.selectedArrowIndex
    const arr = state.edits[side].arrows[idx]
    const mode = state.interaction.dragMode

    if (mode === 'start') {
      arr.start = pos
    } else if (mode === 'end') {
      arr.end = pos
    } else if (mode === 'body') {
      const dx = pos.x - state.interaction.dragStartPos.x
      const dy = pos.y - state.interaction.dragStartPos.y
      arr.start = { x: state.interaction.initialArrow.start.x + dx, y: state.interaction.initialArrow.start.y + dy }
      arr.end = { x: state.interaction.initialArrow.end.x + dx, y: state.interaction.initialArrow.end.y + dy }
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
function redrawAll() {
  redrawCanvas(elements.canvasBefore, state.edits.before.arrows, state.activeSide === 'before' ? state.interaction.selectedArrowIndex : -1)
  redrawCanvas(elements.canvasAfter, state.edits.after.arrows, state.activeSide === 'after' ? state.interaction.selectedArrowIndex : -1)
}

function redrawCanvas(canvas, arrows, selectedIdx) {
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  arrows.forEach((arrow, i) => {
    const isSelected = i === selectedIdx
    drawArrow(ctx, arrow, isSelected)
  })
}

function drawArrow(ctx, arrow, isSelected) {
  const { start, end, color, size } = arrow

  // Draw Arrow logic
  // Calculate Arrowhead dimensions first to determine where the line should stop
  // 'Ek dam sharp' means narrower angle and longer head
  const headAngle = Math.PI / 18  // e.g. 10 degrees
  const headSize = Math.max(30, size * 6) // Longer head
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
      elements.comparisonSection.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 200)
  }
}

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

  const h = Math.max(beforeImg.height, afterImg.height)
  const scaleB = h / beforeImg.height
  const scaleA = h / afterImg.height
  const wB = beforeImg.width * scaleB
  const wA = afterImg.width * scaleA
  const gap = h * 0.01
  const border = gap * 2

  canvas.width = wB + wA + gap + border * 2
  canvas.height = h + border * 2

  ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Draw Images
  ctx.save()
  ctx.filter = elements.comparisonImageBefore.style.filter
  ctx.drawImage(beforeImg, border, border, wB, h)
  ctx.restore()

  ctx.save()
  ctx.filter = elements.comparisonImageAfter.style.filter
  ctx.drawImage(afterImg, border + wB + gap, border, wA, h)
  ctx.restore()

  // Draw Arrows (using shared logic if possible, or copied fixed logic)
  function renderArr(sideArgs, outputX) {
    const arrowList = state.edits[sideArgs].arrows
    if (!arrowList || arrowList.length === 0) return

    const imgEl = sideArgs === 'before' ? elements.comparisonImageBefore : elements.comparisonImageAfter
    const canvasEl = sideArgs === 'before' ? elements.canvasBefore : elements.canvasAfter

    // Correct Aspect Ratio Mapping
    const imgAspect = imgEl.naturalWidth / imgEl.naturalHeight
    const canvasAspect = canvasEl.width / canvasEl.height

    let renderW, renderH, offsetX, offsetY

    if (canvasAspect > imgAspect) {
      // Canvas is wider than image (Pillarbox - empty sides)
      renderH = canvasEl.height
      renderW = renderH * imgAspect
      offsetX = (canvasEl.width - renderW) / 2
      offsetY = 0
    } else {
      // Canvas is taller than image (Letterbox - empty top/bottom)
      renderW = canvasEl.width
      renderH = renderW / imgAspect
      offsetX = 0
      offsetY = (canvasEl.height - renderH) / 2
    }

    const targetW = sideArgs === 'before' ? wB : wA
    const targetH = h

    arrowList.forEach(arrow => {
      // Normalize coordinates relative to the ACTUAL IMAGE, not just the canvas

      function mapCoord(c) {
        const normX = (c.x - offsetX) / renderW
        const normY = (c.y - offsetY) / renderH

        return {
          x: normX * targetW + outputX,
          y: normY * targetH + border
        }
      }

      const p1 = mapCoord(arrow.start)
      const p2 = mapCoord(arrow.end)

      const scaledSize = arrow.size * (targetH / renderH) // Scale thickness
      const tempArrow = { start: p1, end: p2, color: arrow.color, size: scaledSize }
      drawArrow(ctx, tempArrow, false) // False = no handles
    })
  }

  renderArr('before', border)
  renderArr('after', border + wB + gap)

  // Badges
  const fontSize = h * 0.05
  ctx.font = `bold ${fontSize}px sans-serif`
  ctx.textAlign = 'center'

  const badgeY = canvas.height - border - fontSize

  // Badge BG
  function drawBadge(text, x, y) {
    const tw = ctx.measureText(text).width + 40
    const th = fontSize + 20
    ctx.fillStyle = '#dc2626'
    ctx.beginPath(); ctx.roundRect(x - tw / 2, y - th / 2, tw, th, 15); ctx.fill()
    ctx.fillStyle = 'white'
    ctx.fillText(text, x, y + fontSize * 0.3)
  }

  drawBadge('BEFORE', border + wB / 2, badgeY)
  drawBadge('AFTER', border + wB + gap + wA / 2, badgeY)

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
