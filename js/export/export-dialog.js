import { store } from '../core/state.js';
import { playback } from '../core/playback.js';
import { renderExport } from './renderer.js';

class ExportDialog {
  constructor() {
    this.dialog = null;
    this.btnExport = null;
    this.btnClose = null;
    this.btnStart = null;
    this.btnCancel = null;
    this.btnDownload = null;

    this.fmtSelect = null;
    this.resSelect = null;
    this.fpsSelect = null;
    this.qualSelect = null;
    this.rngSelect = null;

    this.resGroup = null;
    this.fpsGroup = null;
    this.qualGroup = null;
    this.rngGroup = null;

    this.controlsUi = null;
    this.progressUi = null;
    this.completeUi = null;

    this.statusText = null;
    this.progressBar = null;
    this.frameCounter = null;
    this.etaText = null;

    this.fileInfo = null;
    this.previewStrip = null;

    this.currentRenderCancel = null;
    this.currentDownloadUrl = null;
    this.currentDownloadFilename = null;
  }

  init() {
    this.dialog = document.getElementById('export-dialog');
    this.btnExport = document.getElementById('btn-export');
    this.btnClose = document.getElementById('btn-close-export');
    this.btnStart = document.getElementById('btn-start-export');
    this.btnCancel = document.getElementById('btn-cancel-export');
    this.btnDownload = document.getElementById('btn-download-export');

    this.fmtSelect = document.getElementById('export-format');
    this.resSelect = document.getElementById('export-resolution');
    this.fpsSelect = document.getElementById('export-fps');
    this.qualSelect = document.getElementById('export-quality');
    this.rngSelect = document.getElementById('export-range');

    this.resGroup = document.getElementById('export-res-group');
    this.fpsGroup = document.getElementById('export-fps-group');
    this.qualGroup = document.getElementById('export-quality-group');
    this.rngGroup = document.getElementById('export-range-group');

    this.controlsUi = document.getElementById('export-controls-ui');
    this.progressUi = document.getElementById('export-progress-ui');
    this.completeUi = document.getElementById('export-complete-ui');

    this.statusText = document.getElementById('export-status-text');
    this.progressBar = document.getElementById('export-progress');
    this.frameCounter = document.getElementById('export-frame-counter');
    this.etaText = document.getElementById('export-eta');

    this.fileInfo = document.getElementById('export-file-info');
    this.previewStrip = document.getElementById('export-preview-strip');

    this.bindEvents();
  }

  bindEvents() {
    this.btnExport.addEventListener('click', () => this.open());
    this.btnClose.addEventListener('click', () => this.close());

    this.fmtSelect.addEventListener('change', () => this.updateVisibility());

    this.btnStart.addEventListener('click', () => this.startExport());
    this.btnCancel.addEventListener('click', () => this.cancelExport());
    this.btnDownload.addEventListener('click', () => this.downloadExport());
  }

  open() {
    this.resetUi();
    this.dialog.showModal();
  }

  close() {
    if (this.currentRenderCancel) {
      this.cancelExport();
    }
    this.dialog.close();
  }

  resetUi() {
    this.controlsUi.style.display = 'block';
    this.progressUi.style.display = 'none';
    this.completeUi.style.display = 'none';

    this.fmtSelect.disabled = false;
    this.resSelect.disabled = false;
    this.fpsSelect.disabled = false;
    this.qualSelect.disabled = false;
    this.rngSelect.disabled = false;

    this.progressBar.value = 0;
    this.frameCounter.textContent = 'Frame 0 / 0';
    this.etaText.textContent = 'ETA: --:--';
    this.previewStrip.innerHTML = '';

    if (this.currentDownloadUrl) {
      URL.revokeObjectURL(this.currentDownloadUrl);
      this.currentDownloadUrl = null;
    }

    this.updateVisibility();
  }

  updateVisibility() {
    const format = this.fmtSelect.value;
    if (format === 'wav') {
      this.resGroup.style.display = 'none';
      this.fpsGroup.style.display = 'none';
      this.qualGroup.style.display = 'none';
      this.rngGroup.style.display = 'block';
    } else if (format === 'png') {
      this.resGroup.style.display = 'block';
      this.fpsGroup.style.display = 'none';
      this.qualGroup.style.display = 'none';
      this.rngGroup.style.display = 'none'; // Only current frame
    } else {
      this.resGroup.style.display = 'block';
      this.fpsGroup.style.display = 'block';
      this.qualGroup.style.display = 'block';
      this.rngGroup.style.display = 'block';
    }
  }

  async startExport() {
    const format = this.fmtSelect.value;
    let width = store.state.project.width;
    let height = store.state.project.height;

    if (this.resSelect.value !== 'native') {
      const h = parseInt(this.resSelect.value, 10);
      const ratio = width / height;
      height = h;
      width = Math.round(height * ratio);
    }

    const fps = this.fpsSelect.value === 'native' ? store.state.project.fps : parseInt(this.fpsSelect.value, 10);

    // Maps roughly to Mbps
    const qualMap = { high: 8000000, medium: 4000000, low: 1500000 };
    const bitrate = qualMap[this.qualSelect.value] || 4000000;

    let t0 = 0;
    let t1 = store.state.project.duration;
    // Loop not fully supported in UI but keeping logic isolated
    if (this.rngSelect.value === 'loop') {
      // Stub for loop region logic, just use whole for now
      t0 = 0;
      t1 = store.state.project.duration;
    }

    if (format === 'png') {
       t0 = playback.currentTime;
       t1 = playback.currentTime; // Single frame
    }

    // Switch UI
    this.fmtSelect.disabled = true;
    this.resSelect.disabled = true;
    this.fpsSelect.disabled = true;
    this.qualSelect.disabled = true;
    this.rngSelect.disabled = true;

    this.controlsUi.style.display = 'none';
    this.progressUi.style.display = 'block';
    this.statusText.textContent = 'Preparing render...';

    const config = {
      format,
      width,
      height,
      fps,
      bitrate,
      t0,
      t1,
      onProgress: (info) => this.onProgress(info),
      onComplete: (result) => this.onComplete(result),
      onError: (err) => this.onError(err)
    };

    try {
      this.currentRenderCancel = await renderExport(config);
    } catch (e) {
      this.onError(e);
    }
  }

  onProgress(info) {
    if (info.status) {
      this.statusText.textContent = info.status;
    }
    if (info.progress !== undefined) {
      this.progressBar.value = info.progress * 100;
    }
    if (info.frame !== undefined && info.totalFrames !== undefined) {
      this.frameCounter.textContent = `Frame ${info.frame} / ${info.totalFrames}`;
    }
    if (info.eta !== undefined) {
      this.etaText.textContent = `ETA: ${Math.round(info.eta)}s`;
    }
  }

  onComplete(result) {
    this.currentRenderCancel = null;
    this.progressUi.style.display = 'none';
    this.completeUi.style.display = 'block';

    this.currentDownloadUrl = result.url;

    // Safe project name
    const safeName = store.state.project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'project';
    this.currentDownloadFilename = `${safeName}.${result.extension}`;

    const mb = (result.size / (1024 * 1024)).toFixed(2);
    this.fileInfo.textContent = `Size: ${mb} MB`;

    this.previewStrip.innerHTML = '';
    if (result.previews && result.previews.length > 0) {
      for (const dataUrl of result.previews) {
        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.height = '48px';
        img.style.border = '1px solid var(--border-light)';
        this.previewStrip.appendChild(img);
      }
    }
  }

  onError(err) {
    this.currentRenderCancel = null;
    this.progressUi.style.display = 'none';
    this.controlsUi.style.display = 'block';

    this.fmtSelect.disabled = false;
    this.resSelect.disabled = false;
    this.fpsSelect.disabled = false;
    this.qualSelect.disabled = false;
    this.rngSelect.disabled = false;

    alert('Export failed: ' + err.message);
  }

  cancelExport() {
    if (this.currentRenderCancel) {
      this.currentRenderCancel();
      this.currentRenderCancel = null;
    }
    this.resetUi();
  }

  downloadExport() {
    if (!this.currentDownloadUrl) return;
    const a = document.createElement('a');
    a.href = this.currentDownloadUrl;
    a.download = this.currentDownloadFilename;
    a.click();
  }
}

export const exportDialog = new ExportDialog();
