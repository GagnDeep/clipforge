import { titlePresets } from './presets.js';
import { shapes } from './shapes.js';
import { CanvasEditor } from './canvas-editor.js';
import { store } from '../../core/state.js';
import { CmdAddTextGraphicClip } from './commands.js';
import { playback } from '../../core/playback.js';
import { injectStyles } from './styles.js';

export class TitlesPanel {
  constructor() {
    injectStyles();
    this.titlesRoot = document.getElementById('titles-root');
    this.shapesRoot = document.getElementById('shapes-root');
    this.titlesGrid = document.getElementById('titles-grid');
    this.shapesGrid = document.getElementById('shapes-grid');
    this.tabs = document.querySelectorAll('.tab-btn');
    this.tabContents = document.querySelectorAll('.tab-content');

    this.canvasEditor = new CanvasEditor();

    this.bindEvents();
    this.renderPresets();
    this.renderShapes();
  }

  bindEvents() {
    this.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.tabs.forEach(t => t.classList.remove('active'));
        this.tabContents.forEach(c => c.classList.remove('active'));

        tab.classList.add('active');
        const targetId = tab.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');
      });
    });
  }

  renderPresets() {
    this.titlesGrid.innerHTML = '';

    for (const preset of titlePresets) {
      const card = document.createElement('div');
      card.className = 'preset-card';

      card.addEventListener('click', () => {
        // Add text clip at playhead on first video track
        const trackId = store.state.tracks.find(t => t.kind === 'video')?.id || 'v1';
        store.dispatch(CmdAddTextGraphicClip(trackId, playback.currentTime, 5, 'text', preset));
      });

      card.innerHTML = `
        <div class="preset-preview-wrapper" style="background: ${preset.background || 'transparent'}; border-radius: ${preset.bgRadius || 0}px;">
           <span style="color: ${preset.color}; font-family: ${preset.font}; font-size: ${Math.min(preset.size, 24)}px;">Abc</span>
        </div>
        <div class="preset-name">${preset.name}</div>
      `;
      this.titlesGrid.appendChild(card);
    }
  }

  renderShapes() {
    this.shapesGrid.innerHTML = '';

    for (const shape of shapes) {
      const card = document.createElement('div');
      card.className = 'preset-card';

      card.addEventListener('click', () => {
        const trackId = store.state.tracks.find(t => t.kind === 'video')?.id || 'v1';
        store.dispatch(CmdAddTextGraphicClip(trackId, playback.currentTime, 5, 'graphic', shape));
      });

      let previewHtml = '';
      if (shape.type === 'svg') {
         previewHtml = shape.content;
      } else if (shape.type === 'rect' || shape.type === 'roundrect') {
         previewHtml = `<div style="width: 40px; height: 30px; background: ${shape.fill}; border-radius: ${shape.radius || 0}px; border: ${shape.strokeWidth || 0}px solid ${shape.stroke || 'transparent'}"></div>`;
      } else if (shape.type === 'circle') {
         previewHtml = `<div style="width: 40px; height: 40px; background: ${shape.fill}; border-radius: 50%; border: ${shape.strokeWidth || 0}px solid ${shape.stroke || 'transparent'}"></div>`;
      }

      card.innerHTML = `
        <div class="preset-preview-wrapper" style="width: 40px; height: 40px;">
           ${previewHtml}
        </div>
        <div class="preset-name">${shape.name}</div>
      `;
      this.shapesGrid.appendChild(card);
    }
  }
}