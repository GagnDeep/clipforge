import { store } from '../../core/state.js';
import { bus } from '../../core/bus.js';
import { CmdUpdateClipTransform } from './commands.js';

export class CanvasEditor {
  constructor() {
    this.canvas = document.getElementById('compositor-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.isDragging = false;
    this.activeClipId = null;
    this.dragStartPos = { x: 0, y: 0 };
    this.clipStartTransform = null;

    // We bind to playback engine but read current time directly or via events
    // Ideally the app syncs time, we'll store a local copy of currentTime
    this.currentTime = 0;

    bus.on('playback:timeupdate', ({ time }) => {
      this.currentTime = time;
    });

    this.bindEvents();
  }

  bindEvents() {
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    document.addEventListener('mousemove', this.onMouseMove.bind(this));
    document.addEventListener('mouseup', this.onMouseUp.bind(this));
  }

  getCanvasMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX - (this.canvas.width / 2),
      y: (e.clientY - rect.top) * scaleY - (this.canvas.height / 2)
    };
  }

  findIntersectingClip(x, y) {
    const { tracks, clips } = store.state;
    const activeClips = [];

    for (const track of tracks) {
      if (track.kind === 'audio') continue;
      for (const clipId of track.clips) {
        const clip = clips[clipId];
        if (clip && this.currentTime >= clip.start && this.currentTime < clip.start + clip.duration) {
          activeClips.push(clip);
        }
      }
    }

    // Top-most wins, so iterate backwards
    for (let i = activeClips.length - 1; i >= 0; i--) {
      const clip = activeClips[i];
      if (clip.kind === 'text' || clip.kind === 'graphic') {
        const { x: cx, y: cy, scale } = clip.transform;

        let roughWidth = 100 * scale;
        let roughHeight = 100 * scale;

        if (clip.kind === 'text' && clip.text) {
          this.ctx.font = `${clip.text.size}px ${clip.text.font || 'sans-serif'}`;
          const content = clip.text.content || '';
          const lines = content.split('\n');
          let maxWidth = 0;
          for (const line of lines) {
            maxWidth = Math.max(maxWidth, this.ctx.measureText(line).width);
          }
          roughWidth = maxWidth * scale;
          roughHeight = lines.length * (clip.text.size * 1.2) * scale;

          if (clip.text.background) {
             roughWidth += (clip.text.paddingX || 0) * 2 * scale;
             roughHeight += (clip.text.paddingY || 0) * 2 * scale;
          }
        } else if (clip.kind === 'graphic' && clip.graphic) {
          if (clip.graphic.type === 'circle') {
             roughWidth = (clip.graphic.radius || 50) * 2 * scale;
             roughHeight = roughWidth;
          } else {
             roughWidth = (clip.graphic.width || 100) * scale;
             roughHeight = (clip.graphic.height || 100) * scale;
          }
        }

        // Approximate centered hit box
        if (
          x >= cx - roughWidth/2 && x <= cx + roughWidth/2 &&
          y >= cy - roughHeight/2 && y <= cy + roughHeight/2
        ) {
          return clip;
        }
      }
    }
    return null;
  }

  onMouseDown(e) {
    const pos = this.getCanvasMousePos(e);
    const hitClip = this.findIntersectingClip(pos.x, pos.y);

    if (hitClip) {
      this.isDragging = true;
      this.activeClipId = hitClip.id;
      this.dragStartPos = pos;
      this.clipStartTransform = { ...hitClip.transform };
    }
  }

  onMouseMove(e) {
    if (!this.isDragging || !this.activeClipId) return;

    const pos = this.getCanvasMousePos(e);
    const dx = pos.x - this.dragStartPos.x;
    const dy = pos.y - this.dragStartPos.y;

    const clip = store.state.clips[this.activeClipId];
    if (clip) {
      // Mutate state directly for live preview (safe since we dispatch command on mouseup)
      clip.transform.x = this.clipStartTransform.x + dx;
      clip.transform.y = this.clipStartTransform.y + dy;

      // Force render frame
      bus.emit('state:changed', store.state);
    }
  }

  onMouseUp(e) {
    if (this.isDragging && this.activeClipId) {
      const clip = store.state.clips[this.activeClipId];
      if (clip) {
        // Capture final transform
        const finalTransform = { ...clip.transform };

        // Revert to start state before dispatching so the Command captures the original state for Undo
        clip.transform = { ...this.clipStartTransform };

        // Dispatch full command for undo/redo
        store.dispatch(CmdUpdateClipTransform(this.activeClipId, finalTransform));
      }
    }
    this.isDragging = false;
    this.activeClipId = null;
  }
}