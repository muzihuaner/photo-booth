import { Camera } from './camera.js';
import { TemplateRenderer } from './template.js';
import { Exporter } from './export.js';

const FILTERS = {
  none: 'none',
  bw: 'grayscale(100%) contrast(120%) brightness(102%)',
  warm: 'sepia(45%) saturate(150%) brightness(108%) contrast(105%)',
  cool: 'brightness(108%) contrast(105%) saturate(80%)',
  retro: 'sepia(65%) contrast(80%) brightness(112%) saturate(65%)',
  fuji: 'sepia(25%) saturate(82%) contrast(96%) brightness(103%)',
};

class PhotoBoothApp {
  constructor() {
    this.photos = [];
    this.selectedTemplateId = null;
    this.composedCanvas = null;
    this.currentTimer = 3;
    this.currentFilter = 'none';
    this.isBursting = false;
    this.audioCtx = null;


    this.camera = new Camera(document.getElementById('video'));
    this.renderer = new TemplateRenderer();
    this.exporter = new Exporter();

    this._cacheElements();
    this._setupEventListeners();
    this._initOptionButtons();
    this._initTemplates();
    this._updateStep(1);
  }

  _cacheElements() {
    this.video = document.getElementById('video');
    this.cameraPlaceholder = document.getElementById('camera-placeholder');
    this.flashOverlay = document.getElementById('flash-overlay');
    this.countdownOverlay = document.getElementById('countdown-overlay');
    this.countdownNumber = document.getElementById('countdown-number');
    this.photoSlotsContainer = document.getElementById('photo-slots');
    this.photoCountEl = document.getElementById('photo-count');
    this.previewCanvas = document.getElementById('preview-canvas');
    this.exportCanvas = document.getElementById('export-canvas');
    this.printImage = document.getElementById('print-image');
    this.templateList = document.getElementById('template-list');
    this.customTextInput = document.getElementById('input-custom-text');
    this.chkTimestamp = document.getElementById('chk-timestamp');

    this.btnStartCamera = document.getElementById('btn-start-camera');
    this.btnCapture = document.getElementById('btn-capture');
    this.btnBurst = document.getElementById('btn-burst');
    this.btnRetake = document.getElementById('btn-retake');
    this.btnSwitchCamera = document.getElementById('btn-switch-camera');
    this.btnNextTemplate = document.getElementById('btn-next-template');
    this.btnBackCamera = document.getElementById('btn-back-camera');
    this.btnNextExport = document.getElementById('btn-next-export');
    this.btnBackTemplate = document.getElementById('btn-back-template');
    this.btnPrint = document.getElementById('btn-print');
    this.btnPdf = document.getElementById('btn-pdf');
    this.btnDownloadPng = document.getElementById('btn-download-png');
    this.btnAbout = document.getElementById('btn-about');
    this.aboutModal = document.getElementById('about-modal');
    this.btnModalClose = document.getElementById('btn-modal-close');

    this.timerButtons = document.querySelectorAll('[data-timer]');
    this.filterButtons = document.querySelectorAll('[data-filter]');


    this.steps = document.querySelectorAll('.step');
    this.sections = {
      1: document.getElementById('step-camera'),
      2: document.getElementById('step-template'),
      3: document.getElementById('step-export'),
    };
  }

  _setupEventListeners() {
    this.btnStartCamera.addEventListener('click', () => this._handleStartCamera());
    this.btnCapture.addEventListener('click', () => this._handleCapture());
    this.btnBurst.addEventListener('click', () => this._handleBurst());
    this.btnRetake.addEventListener('click', () => this._handleRetake());
    this.btnSwitchCamera.addEventListener('click', () => this._handleSwitchCamera());
    this.btnNextTemplate.addEventListener('click', () => this._goToStep(2));
    this.btnBackCamera.addEventListener('click', () => this._goToStep(1));
    this.btnNextExport.addEventListener('click', () => this._goToStep(3));
    this.btnBackTemplate.addEventListener('click', () => this._goToStep(2));
    this.btnPrint.addEventListener('click', () => this._handlePrint());
    this.btnPdf.addEventListener('click', () => this._handlePdf());
    this.btnDownloadPng.addEventListener('click', () => this._handleDownloadPng());
    this.customTextInput.addEventListener('input', () => this._onRenderOptionChange());
    this.chkTimestamp.addEventListener('change', () => this._onRenderOptionChange());

    this.btnAbout.addEventListener('click', () => this._toggleAbout(true));
    this.btnModalClose.addEventListener('click', () => this._toggleAbout(false));
    this.aboutModal.addEventListener('click', (e) => {
      if (e.target === this.aboutModal) this._toggleAbout(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this._toggleAbout(false);
    });
  }

  _initOptionButtons() {
    this.timerButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.timerButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentTimer = parseInt(btn.dataset.timer);
      });
    });

    this.filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this.video.style.filter = FILTERS[this.currentFilter] || 'none';
      });
    });
  }

  _toggleAbout(show) {
    this.aboutModal.classList.toggle('hidden', !show);
  }

  _applyVideoTransform() {
    const sx = this.camera.currentFacingMode === 'user' ? -1 : 1;
    this.video.style.transform = `scaleX(${sx})`;
  }

  /* ==================== CAMERA ==================== */

  async _handleStartCamera() {
    try {
      this.btnStartCamera.disabled = true;
      this.btnStartCamera.textContent = '启动中...';
      await this.camera.start();
      this.cameraPlaceholder.classList.add('hidden');
      this._applyVideoTransform();
      this.video.style.filter = FILTERS[this.currentFilter] || 'none';
      this.btnCapture.disabled = false;
      this.btnBurst.disabled = false;
      this.btnRetake.disabled = false;
      this.btnSwitchCamera.disabled = false;
      this.btnStartCamera.textContent = '✓ 已就绪';
    } catch (err) {
      this.btnStartCamera.disabled = false;
      this.btnStartCamera.textContent = '⚠ 重试';
    }
  }

  async _handleCapture() {
    if (this.isBursting) return;
    this._disableCaptureButtons();
    await this._runCountdown(this.currentTimer);
    this._shoot();
    this._syncUiState();
  }

  async _handleBurst() {
    if (this.isBursting) return;
    this.isBursting = true;
    this.btnBurst.classList.add('burst-active');
    this.btnBurst.textContent = '⏳ 连拍中...';

    const remaining = 4 - this.photos.length;
    for (let i = 0; i < remaining; i++) {
      if (this.photos.length >= 4) break;
      this._disableCaptureButtons();
      await this._runCountdown(this.currentTimer);
      this._shoot();
      this._syncUiState();
      if (i < remaining - 1 && this.photos.length < 4) {
        await this._delay(800);
      }
    }

    this.isBursting = false;
    this.btnBurst.classList.remove('burst-active');
    this.btnBurst.textContent = '⚡ 连拍';
    this.btnCapture.disabled = this.photos.length >= 4 || !this.camera.isActive;
    this.btnBurst.disabled = this.photos.length >= 4 || !this.camera.isActive;
  }

  _shoot() {
    const canvas = this.camera.capture(FILTERS[this.currentFilter]);
    if (!canvas) return;
    this.photos.push(canvas);
    this._showFlash();
    this._playShutter();
    this._updatePhotoSlots();
  }

  _showFlash() {
    this.flashOverlay.classList.remove('active');
    void this.flashOverlay.offsetWidth;
    this.flashOverlay.classList.add('active');
    setTimeout(() => this.flashOverlay.classList.remove('active'), 300);
  }

  _playShutter() {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const t = this.audioCtx.currentTime;

      const noise = this.audioCtx.createBufferSource();
      const bufSize = this.audioCtx.sampleRate * 0.08;
      const buf = this.audioCtx.createBuffer(1, bufSize, this.audioCtx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 3);
      }
      noise.buffer = buf;

      const gain = this.audioCtx.createGain();
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2000;

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.audioCtx.destination);
      noise.start(t);
      noise.stop(t + 0.08);
    } catch (e) {
      /* audio not supported, silently ignore */
    }
  }

  _disableCaptureButtons() {
    this.btnCapture.disabled = true;
    this.btnBurst.disabled = true;
  }

  async _runCountdown(seconds) {
    this.countdownOverlay.classList.remove('hidden');
    for (let i = seconds; i > 0; i--) {
      this.countdownNumber.textContent = i;
      await this._delay(1000);
    }
    this.countdownNumber.textContent = '📸';
    await this._delay(300);
    this.countdownOverlay.classList.add('hidden');
  }

  async _handleSwitchCamera() {
    this.btnSwitchCamera.disabled = true;
    this.btnSwitchCamera.textContent = '切换中...';
    const success = await this.camera.switchCamera();
    if (success) {
      this._applyVideoTransform();
      this.video.style.filter = FILTERS[this.currentFilter] || 'none';
    } else if (!this.camera.isActive) {
      this.btnStartCamera.disabled = false;
      this.btnStartCamera.textContent = '▶ 启动';
      this.cameraPlaceholder.classList.remove('hidden');
    }
    this.btnSwitchCamera.disabled = !this.camera.isActive;
    this.btnSwitchCamera.textContent = '⇄ 翻转';
  }

  _handleRetake() {
    this.photos = [];
    this._updatePhotoSlots();
    this._syncUiState();
  }

  _handleDeletePhoto(index) {
    if (index < 0 || index >= this.photos.length) return;
    this.photos.splice(index, 1);
    this._updatePhotoSlots();
    this._syncUiState();
  }

  /* ==================== PHOTO SLOTS ==================== */

  _updatePhotoSlots() {
    this.photoSlotsContainer.innerHTML = '';

    for (let i = 0; i < 4; i++) {
      const slot = document.createElement('div');
      slot.className = `photo-slot ${i < this.photos.length ? 'filled' : 'empty'}`;
      slot.dataset.index = i;

      if (i < this.photos.length) {
        const img = document.createElement('img');
        img.src = this.photos[i].toDataURL();
        img.alt = `Photo ${i + 1}`;
        slot.appendChild(img);

        const num = document.createElement('span');
        num.className = 'slot-number';
        num.textContent = `#${i + 1}`;
        slot.appendChild(num);

        const delBtn = document.createElement('button');
        delBtn.className = 'btn-delete-slot';
        delBtn.innerHTML = '✕';
        delBtn.title = `删除照片 #${i + 1}`;
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._handleDeletePhoto(i);
        });
        slot.appendChild(delBtn);
      } else {
        slot.textContent = i < 4 ? '□' : '';
      }

      this.photoSlotsContainer.appendChild(slot);
    }
  }

  _syncUiState() {
    const count = this.photos.length;
    this.photoCountEl.textContent = `${count} / 4`;
    this.btnCapture.disabled = count >= 4 || !this.camera.isActive || this.isBursting;
    this.btnBurst.disabled = count >= 4 || !this.camera.isActive || this.isBursting;
    this.btnNextTemplate.disabled = count === 0;

    if (count === 0) {
      this.selectedTemplateId = null;
      document.querySelectorAll('.template-card').forEach(c => c.classList.remove('active'));
    }

    if (this.selectedTemplateId && count > 0) {
      this._renderPreview();
    }
  }

  /* ==================== TEMPLATES ==================== */

  _initTemplates() {
    this.templates = this.renderer.getTemplates();
    this.templateList.innerHTML = '';

    this.templates.forEach(tpl => {
      const card = document.createElement('div');
      card.className = 'template-card';
      card.dataset.templateId = tpl.id;

      const previewDiv = document.createElement('div');
      previewDiv.className = 'template-preview';
      card.appendChild(previewDiv);

      const nameEl = document.createElement('div');
      nameEl.className = 'name';
      nameEl.textContent = tpl.name;
      card.appendChild(nameEl);

      const descEl = document.createElement('div');
      descEl.className = 'desc';
      descEl.textContent = tpl.description;
      card.appendChild(descEl);

      card.addEventListener('click', () => this._selectTemplate(tpl.id));
      this.templateList.appendChild(card);

      this._drawTemplateThumbnail(previewDiv, tpl);
    });
  }

  _drawTemplateThumbnail(container, template) {
    const canvas = document.createElement('canvas');
    const pw = 140;
    const ph = (pw / template.canvasWidth) * template.canvasHeight;
    canvas.width = pw;
    canvas.height = ph;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = template.bgColor || '#fff';
    ctx.fillRect(0, 0, pw, ph);

    for (const slot of template.photoSlots) {
      const dx = slot.x * pw;
      const dy = slot.y * ph;
      const dw = slot.w * pw;
      const dh = slot.h * ph;
      ctx.fillStyle = '#d4c9b3';
      ctx.fillRect(dx, dy, dw, dh);
      ctx.strokeStyle = '#a6987e';
      ctx.lineWidth = 1;
      ctx.strokeRect(dx, dy, dw, dh);
      ctx.fillStyle = '#8a7c64';
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('📷', dx + dw / 2, dy + dh / 2);
    }

    if (template.id === 'grid-2x2') {
      ctx.fillStyle = 'rgba(233,69,96,0.25)';
      ctx.font = '36px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♥', pw / 2, ph / 2);
    }

    container.appendChild(canvas);
  }

  _selectTemplate(templateId) {
    this.selectedTemplateId = templateId;
    document.querySelectorAll('.template-card').forEach(card => {
      card.classList.toggle('active', card.dataset.templateId === templateId);
    });
    this._renderPreview();
  }

  _onRenderOptionChange() {
    if (this.selectedTemplateId && this.photos.length > 0) {
      this._renderPreview();
    }
  }

  _renderPreview() {
    if (!this.selectedTemplateId || this.photos.length === 0) return;

    const now = new Date();
    const ts = now.getFullYear() + '.' +
      String(now.getMonth() + 1).padStart(2, '0') + '.' +
      String(now.getDate()).padStart(2, '0') + '  ' +
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0');

    const customText = this.customTextInput.value.trim();
    this.composedCanvas = this.renderer.render(this.selectedTemplateId, this.photos, customText, {
      showTimestamp: this.chkTimestamp.checked,
      timestampText: ts,
    });

    this.previewCanvas.width = this.composedCanvas.width;
    this.previewCanvas.height = this.composedCanvas.height;
    const ctx = this.previewCanvas.getContext('2d');
    ctx.drawImage(this.composedCanvas, 0, 0);

    this.exportCanvas.width = this.composedCanvas.width;
    this.exportCanvas.height = this.composedCanvas.height;
    const ectx = this.exportCanvas.getContext('2d');
    ectx.drawImage(this.composedCanvas, 0, 0);

    this.btnNextExport.disabled = false;
  }

  _goToStep(step) {
    this._updateStep(step);
    if (step === 2 && this.selectedTemplateId && this.photos.length > 0) {
      this._renderPreview();
    }
    if (step === 3 && this.photos.length > 0) {
      this._renderPreview();
    }
  }

  _updateStep(activeStep) {
    this.steps.forEach(s => {
      const num = parseInt(s.dataset.step);
      s.classList.remove('active', 'completed');
      if (num === activeStep) s.classList.add('active');
      else if (num < activeStep) s.classList.add('completed');
    });

    Object.entries(this.sections).forEach(([num, el]) => {
      el.classList.toggle('active', parseInt(num) === activeStep);
    });
  }

  /* ==================== EXPORT ==================== */

  _handlePrint() {
    if (this.composedCanvas) {
      this.exporter.print(this.composedCanvas, this.printImage);
    }
  }

  async _handlePdf() {
    if (!this.composedCanvas) return;
    this.btnPdf.disabled = true;
    this.btnPdf.textContent = '生成中...';
    try {
      await this.exporter.savePdf(this.composedCanvas);
    } catch (err) {
      console.error('PDF generation failed:', err);
    }
    this.btnPdf.disabled = false;
    this.btnPdf.textContent = '📄 保存 PDF';
  }

  _handleDownloadPng() {
    if (this.composedCanvas) {
      this.exporter.downloadPng(this.composedCanvas);
    }
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PhotoBoothApp();
});
