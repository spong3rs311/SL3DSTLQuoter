const CSS = `
#sl3d-widget * { box-sizing: border-box; margin: 0; padding: 0; }
#sl3d-widget { font-family: Arial, sans-serif; }

.sl3d-card {
  background: #1A1F2E;
  border-radius: 10px;
  padding: 28px 32px 32px;
  max-width: 480px;
  margin: 0 auto;
  color: #FFFFFF;
}

/* ── Header ── */
.sl3d-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid #2A3040;
}
.sl3d-logo { font-size: 20px; font-weight: 700; color: #00E5FF; letter-spacing: 1px; }
.sl3d-tagline { font-size: 13px; color: #8B95A5; }

/* ── Upload zone ── */
.sl3d-upload-zone {
  border: 2px dashed #2A3040;
  border-radius: 8px;
  padding: 40px 24px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  user-select: none;
}
.sl3d-upload-zone:hover,
.sl3d-upload-zone.sl3d-drag-over {
  border-color: #00E5FF;
  background: rgba(0, 229, 255, 0.04);
}
.sl3d-upload-icon { color: #00E5FF; margin-bottom: 14px; }
.sl3d-upload-title { font-size: 15px; font-weight: 700; color: #FFFFFF; margin-bottom: 6px; }
.sl3d-upload-sub { font-size: 13px; color: #8B95A5; }

/* ── Parsing spinner ── */
.sl3d-parsing { text-align: center; padding: 48px 0; }
.sl3d-spinner {
  width: 38px; height: 38px;
  border: 3px solid #2A3040;
  border-top-color: #00E5FF;
  border-radius: 50%;
  animation: sl3d-spin 0.75s linear infinite;
  margin: 0 auto 16px;
}
@keyframes sl3d-spin { to { transform: rotate(360deg); } }
.sl3d-parsing p { font-size: 14px; color: #8B95A5; }

/* ── Quote panel ── */
.sl3d-filename {
  font-size: 13px; color: #8B95A5;
  margin-bottom: 18px;
  word-break: break-all;
}
.sl3d-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 18px;
}

/* ── Price row ── */
.sl3d-price-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  background: #0D1117;
  border-radius: 6px;
  padding: 14px 16px;
  margin-bottom: 18px;
}
.sl3d-price-label { font-size: 12px; color: #8B95A5; text-transform: uppercase; letter-spacing: 0.5px; }
.sl3d-price-value { font-size: 28px; font-weight: 700; color: #FF6D00; }

/* ── Form fields ── */
.sl3d-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.sl3d-field:last-of-type { margin-bottom: 0; }
.sl3d-field label { font-size: 12px; color: #8B95A5; text-transform: uppercase; letter-spacing: 0.5px; }
.sl3d-field input,
.sl3d-field select,
.sl3d-field textarea {
  background: #0D1117;
  border: 1px solid #2A3040;
  border-radius: 6px;
  color: #FFFFFF;
  font-size: 14px;
  padding: 10px 12px;
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
  width: 100%;
}
.sl3d-field input:focus,
.sl3d-field select:focus,
.sl3d-field textarea:focus { border-color: #00E5FF; }
.sl3d-field input::placeholder,
.sl3d-field textarea::placeholder { color: #4A5568; }
.sl3d-field select { appearance: none; cursor: pointer; }
.sl3d-field textarea { resize: vertical; min-height: 80px; }

/* ── Buttons ── */
.sl3d-btn-primary {
  display: block; width: 100%;
  padding: 14px;
  border: none; border-radius: 6px;
  background: #FF6D00; color: #FFFFFF;
  font-size: 15px; font-weight: 700;
  cursor: pointer;
  transition: background 0.2s;
  margin-top: 18px;
  font-family: inherit;
}
.sl3d-btn-primary:hover:not(:disabled) { background: #E56200; }
.sl3d-btn-primary:disabled { background: #2A3040; color: #4A5568; cursor: not-allowed; }

.sl3d-btn-secondary {
  display: block; width: 100%;
  padding: 12px;
  border: 1px solid #2A3040; border-radius: 6px;
  background: transparent; color: #8B95A5;
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
  margin-top: 12px;
  font-family: inherit;
}
.sl3d-btn-secondary:hover { border-color: #00E5FF; color: #00E5FF; }

.sl3d-link-btn {
  background: none; border: none;
  color: #00E5FF; font-size: 13px;
  cursor: pointer; text-decoration: underline;
  padding: 0; font-family: inherit;
}
.sl3d-aux-row {
  text-align: center;
  margin-top: 14px;
  font-size: 13px;
  color: #8B95A5;
}

/* ── Manual quote panel ── */
.sl3d-panel-title { font-size: 16px; font-weight: 700; color: #FFFFFF; margin-bottom: 20px; }

/* ── Status panel ── */
.sl3d-status { text-align: center; padding: 16px 0 8px; }
.sl3d-status-icon { font-size: 44px; margin-bottom: 14px; }
.sl3d-status-title { font-size: 18px; font-weight: 700; color: #FFFFFF; margin-bottom: 10px; }
.sl3d-status-body { font-size: 14px; color: #8B95A5; line-height: 1.65; }

/* ── Inline error ── */
.sl3d-error { color: #FF6B6B; font-size: 13px; margin-top: 12px; text-align: center; }
`;

const HTML = `
<div class="sl3d-card">

  <div class="sl3d-header">
    <span class="sl3d-logo">SL|3D</span>
    <span class="sl3d-tagline">Instant 3D Print Quote</span>
  </div>

  <!-- Upload zone -->
  <div id="sl3d-upload-zone" class="sl3d-upload-zone">
    <div class="sl3d-upload-icon">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="16 16 12 12 8 16"></polyline>
        <line x1="12" y1="12" x2="12" y2="21"></line>
        <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"></path>
      </svg>
    </div>
    <p class="sl3d-upload-title">Drop your STL file here</p>
    <p class="sl3d-upload-sub">or click to browse &middot; max 50 MB</p>
    <input type="file" id="sl3d-file-input" accept=".stl" style="display:none">
  </div>

  <!-- Parsing spinner -->
  <div id="sl3d-parsing" class="sl3d-parsing" hidden>
    <div class="sl3d-spinner"></div>
    <p>Analyzing your file&hellip;</p>
  </div>

  <!-- Quote panel -->
  <div id="sl3d-quote" hidden>
    <p class="sl3d-filename" id="sl3d-filename"></p>

    <div class="sl3d-options">
      <div class="sl3d-field">
        <label for="sl3d-filament">Filament</label>
        <select id="sl3d-filament">
          <option value="pla">PLA &mdash; Standard</option>
          <option value="petg">PETG &mdash; Durable</option>
          <option value="abs">ABS &mdash; Heat-resistant</option>
          <option value="tpu">TPU &mdash; Flexible</option>
        </select>
      </div>
      <div class="sl3d-field">
        <label for="sl3d-strength">Strength</label>
        <select id="sl3d-strength">
          <option value="draft">Draft &mdash; Faster</option>
          <option value="standard" selected>Standard</option>
          <option value="strong">Strong &mdash; Maximum</option>
        </select>
      </div>
    </div>

    <div class="sl3d-price-row">
      <span class="sl3d-price-label">Estimated Price</span>
      <span class="sl3d-price-value" id="sl3d-price">—</span>
    </div>

    <div class="sl3d-field">
      <label for="sl3d-name">Your Name</label>
      <input type="text" id="sl3d-name" placeholder="Jane Doe" autocomplete="name">
    </div>
    <div class="sl3d-field">
      <label for="sl3d-email">Email Address</label>
      <input type="email" id="sl3d-email" placeholder="jane@example.com" autocomplete="email">
    </div>

    <button class="sl3d-btn-primary" id="sl3d-pay-btn" disabled>Accept &amp; Pay</button>

    <p class="sl3d-aux-row">
      Need a custom quote?
      <button class="sl3d-link-btn" id="sl3d-to-manual">Request one here</button>
    </p>
  </div>

  <!-- Manual quote panel -->
  <div id="sl3d-manual" hidden>
    <p class="sl3d-panel-title">Request a Manual Quote</p>

    <div class="sl3d-field">
      <label for="sl3d-mq-name">Your Name</label>
      <input type="text" id="sl3d-mq-name" placeholder="Jane Doe" autocomplete="name">
    </div>
    <div class="sl3d-field">
      <label for="sl3d-mq-email">Email Address</label>
      <input type="email" id="sl3d-mq-email" placeholder="jane@example.com" autocomplete="email">
    </div>
    <div class="sl3d-field">
      <label for="sl3d-mq-notes">Notes (optional)</label>
      <textarea id="sl3d-mq-notes" placeholder="Describe your project or any special requirements&hellip;"></textarea>
    </div>

    <button class="sl3d-btn-primary" id="sl3d-mq-submit">Send Quote Request</button>

    <p class="sl3d-aux-row">
      <button class="sl3d-link-btn" id="sl3d-to-auto">&larr; Back to instant quote</button>
    </p>
  </div>

  <!-- Status panel -->
  <div id="sl3d-status" hidden>
    <div class="sl3d-status">
      <div class="sl3d-status-icon" id="sl3d-status-icon"></div>
      <p class="sl3d-status-title" id="sl3d-status-title"></p>
      <p class="sl3d-status-body" id="sl3d-status-body"></p>
      <button class="sl3d-btn-secondary" id="sl3d-status-reset">Start a new quote</button>
    </div>
  </div>

  <!-- Inline error -->
  <p class="sl3d-error" id="sl3d-error" hidden></p>

</div>
`;

var parseSTL  = require('./stl-parser').parseSTL;
var calcPrice = require('./pricing').calcPrice;

// Runtime state — reset on each new file
var state = {
  file:           null,
  volume_cm3:     0,
  supports_likely: false,
  priceResult:    null,
};

function showPanel(name) {
  ['upload-zone', 'parsing', 'quote', 'manual', 'status'].forEach(function (id) {
    var el = document.getElementById('sl3d-' + id);
    if (el) el.hidden = (id !== name);
  });
  var errEl = document.getElementById('sl3d-error');
  if (errEl) errEl.hidden = true;
}

function showError(msg) {
  var el = document.getElementById('sl3d-error');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
}

// ── Price display ────────────────────────────────────────────────────────────

function updatePrice() {
  var filament = document.getElementById('sl3d-filament').value;
  var preset   = document.getElementById('sl3d-strength').value;
  var result   = calcPrice(state.volume_cm3, state.supports_likely, filament, preset);
  var priceEl  = document.getElementById('sl3d-price');

  if (result) {
    priceEl.textContent = '$' + result.priceUsd;
    state.priceResult = result;
  } else {
    priceEl.textContent = '—';
    state.priceResult = null;
  }
  updatePayBtn();
}

function updatePayBtn() {
  var btn   = document.getElementById('sl3d-pay-btn');
  var name  = (document.getElementById('sl3d-name').value || '').trim();
  var email = (document.getElementById('sl3d-email').value || '').trim();
  var ready = !!(state.priceResult && name && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  btn.disabled = !ready;
}

// ── STL file handling ────────────────────────────────────────────────────────

function handleFile(file) {
  if (!file.name.toLowerCase().endsWith('.stl')) {
    showError('Only .stl files are supported. Use the form below for other file types.');
    return;
  }

  showPanel('parsing');

  var reader = new FileReader();

  reader.onload = function (e) {
    var result = parseSTL(e.target.result);

    if (!result.is_valid) {
      showPanel('manual');
      showError(result.error || 'Could not parse this STL — please request a manual quote.');
      return;
    }

    state.file            = file;
    state.volume_cm3      = result.volume_cm3;
    state.supports_likely = result.supports_likely;
    state.priceResult     = null;

    document.getElementById('sl3d-filename').textContent = file.name;
    updatePrice();
    showPanel('quote');
  };

  reader.onerror = function () {
    showPanel('upload-zone');
    showError('Failed to read the file — please try again.');
  };

  reader.readAsArrayBuffer(file);
}

// ── Event wiring ─────────────────────────────────────────────────────────────

function wireUploadZone() {
  var zone  = document.getElementById('sl3d-upload-zone');
  var input = document.getElementById('sl3d-file-input');

  zone.addEventListener('click', function () { input.click(); });

  input.addEventListener('change', function () {
    if (input.files && input.files[0]) handleFile(input.files[0]);
  });

  zone.addEventListener('dragover', function (e) {
    e.preventDefault();
    zone.classList.add('sl3d-drag-over');
  });
  zone.addEventListener('dragleave', function () {
    zone.classList.remove('sl3d-drag-over');
  });
  zone.addEventListener('drop', function (e) {
    e.preventDefault();
    zone.classList.remove('sl3d-drag-over');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
}

function wireQuotePanel() {
  document.getElementById('sl3d-filament').addEventListener('change', updatePrice);
  document.getElementById('sl3d-strength').addEventListener('change', updatePrice);
  document.getElementById('sl3d-name').addEventListener('input', updatePayBtn);
  document.getElementById('sl3d-email').addEventListener('input', updatePayBtn);

  document.getElementById('sl3d-to-manual').addEventListener('click', function () {
    showPanel('manual');
  });
  document.getElementById('sl3d-to-auto').addEventListener('click', function () {
    showPanel('quote');
  });
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

function init() {
  if (!document.getElementById('sl3d-styles')) {
    var style = document.createElement('style');
    style.id = 'sl3d-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  var container = document.getElementById('sl3d-widget');
  if (!container) return;

  container.innerHTML = HTML;
  showPanel('upload-zone');
  wireUploadZone();
  wireQuotePanel();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

module.exports = { showPanel, showError, updatePrice, updatePayBtn, handleFile };
