import { store } from '../core/state.js';
import { mediaManager } from '../core/media.js';
import { bus } from '../core/bus.js';
import { CmdAddClip } from '../core/state.js';
import { playback } from '../core/playback.js';

export class LibraryPanel {
  constructor() {
    this.root = document.getElementById('library-root');
    this.grid = document.getElementById('library-grid');
    this.importInput = document.getElementById('import-file');

    this.bindEvents();
    this.render();

    bus.on('media:imported', () => this.render());
    bus.on('state:changed', () => this.render()); // Re-render if assets changed via undo/redo
  }

  bindEvents() {
    this.importInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      for (const file of files) {
        await mediaManager.importFile(file);
      }
      // Reset input
      e.target.value = '';
    });

    // Drag and drop anywhere
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', async (e) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files);
        for (const file of files) {
          await mediaManager.importFile(file);
        }
      }
    });
  }

  formatDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  render() {
    this.grid.innerHTML = '';
    const assets = Object.values(store.state.assets);

    for (const asset of assets) {
      const card = document.createElement('div');
      card.className = 'asset-card';
      card.draggable = true;

      // Setup drag data for adding to timeline
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/json', JSON.stringify({
          type: 'asset',
          id: asset.id,
          kind: asset.kind,
          duration: asset.duration
        }));
      });

      // Double click to add at playhead to first matching track
      card.addEventListener('dblclick', () => {
        const trackId = asset.kind === 'audio' ? 'a1' : 'v1';
        store.dispatch(CmdAddClip(trackId, asset.id, playback.currentTime, 0, asset.duration || 5, asset.kind));
      });

      // Sanitize asset name
      const safeName = document.createElement('div');
      safeName.textContent = asset.name;
      const escapedName = safeName.innerHTML;

      let thumbContent = '';
      if (asset.thumbnailUrl) {
        thumbContent = `<img src="${asset.thumbnailUrl}" alt="${escapedName}">`;
      } else {
        thumbContent = `<span>${asset.kind}</span>`;
      }

      const durBadge = asset.kind !== 'image' && asset.duration > 0
        ? `<div class="asset-duration">${this.formatDuration(asset.duration)}</div>`
        : '';

      card.innerHTML = `
        <div class="asset-card-thumb">
          ${thumbContent}
          ${durBadge}
        </div>
        <div class="asset-card-info" title="${escapedName}">
          ${escapedName}
        </div>
      `;

      // Hover scrub mini player
      if (asset.kind === 'video') {
        const thumbContainer = card.querySelector('.asset-card-thumb');
        let hoverVideo = null;

        thumbContainer.addEventListener('mouseenter', () => {
          if (!hoverVideo) {
            hoverVideo = document.createElement('video');
            hoverVideo.src = mediaManager.getUrl(asset.id);
            hoverVideo.muted = true;
            hoverVideo.style.position = 'absolute';
            hoverVideo.style.top = '0';
            hoverVideo.style.left = '0';
            hoverVideo.style.width = '100%';
            hoverVideo.style.height = '100%';
            hoverVideo.style.objectFit = 'cover';
            hoverVideo.style.pointerEvents = 'none';
            thumbContainer.appendChild(hoverVideo);
          }
        });

        thumbContainer.addEventListener('mousemove', (e) => {
          if (hoverVideo && asset.duration > 0) {
             const rect = thumbContainer.getBoundingClientRect();
             const percent = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1));
             hoverVideo.currentTime = percent * asset.duration;
          }
        });

        thumbContainer.addEventListener('mouseleave', () => {
          if (hoverVideo) {
             hoverVideo.remove();
             hoverVideo = null;
          }
        });
      }

      this.grid.appendChild(card);
    }
  }
}
