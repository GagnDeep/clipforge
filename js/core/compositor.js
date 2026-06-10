import { store } from './state.js';
import { mediaManager } from './media.js';
import { bus } from './bus.js';

class Compositor {
  constructor() {
    this.canvas = document.getElementById('compositor-canvas');
    if (!this.canvas) {
      // In tests/headless, it might not exist yet
      this.canvas = document.createElement('canvas');
    }
    this.ctx = this.canvas.getContext('2d');

    // Cache for DOM elements used in rendering
    this.mediaElements = {}; // clipId -> HTMLVideoElement | HTMLImageElement

    bus.on('playback:timeupdate', ({ time }) => this.render(time));
    bus.on('state:changed', () => {
       // Only re-render if paused, playback engine drives updates when playing
       // For now, we'll force a render at 0 if no time is provided,
       // but actual time needs to come from playback.
       // We'll let playback handle emitting timeupdate on state change if paused.
    });
  }

  setCanvas(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
  }

  /**
   * Prepares or retrieves a media element for a given clip
   */
  getMediaElement(clip, time) {
    if (clip.kind === 'text') return null;

    let el = this.mediaElements[clip.id];
    const asset = store.state.assets[clip.assetId];
    if (!asset) return null;

    const url = mediaManager.getUrl(clip.assetId);
    if (!url) return null;

    if (!el) {
      if (clip.kind === 'video') {
        el = document.createElement('video');
        el.src = url;
        el.muted = true; // Audio is handled by playback engine
        el.playsInline = true;
      } else if (clip.kind === 'image') {
        el = new Image();
        el.src = url;
      }
      this.mediaElements[clip.id] = el;
    }

    // Sync video playhead
    if (clip.kind === 'video' && el instanceof HTMLVideoElement) {
      const clipLocalTime = (time - clip.start) + clip.offset;
      // Only seek if we are far off to avoid thrashing (0.1s threshold)
      if (Math.abs(el.currentTime - clipLocalTime) > 0.1) {
        el.currentTime = clipLocalTime;
      }
    }

    return el;
  }

  /**
   * Render the frame for a given project time
   * @param {number} time Project time in seconds
   */
  render(time) {
    const { project, tracks, clips } = store.state;

    // Update canvas size if needed
    if (this.canvas.width !== project.width || this.canvas.height !== project.height) {
      this.canvas.width = project.width;
      this.canvas.height = project.height;
    }

    // Clear background (black)
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Collect active clips at this time
    const activeClips = [];
    // Render bottom-up (first track is bottom)
    // Tracks are usually top-down in UI, so let's say tracks[0] is top layer.
    // So we iterate backwards to render bottom layers first.
    for (let i = tracks.length - 1; i >= 0; i--) {
      const track = tracks[i];
      if (track.kind === 'audio') continue; // Skip audio tracks in compositor

      for (const clipId of track.clips) {
        const clip = clips[clipId];
        if (clip && time >= clip.start && time < clip.start + clip.duration) {
          activeClips.push(clip);
        }
      }
    }

    // Draw clips
    for (const clip of activeClips) {
      this.ctx.save();

      // Apply transform
      const { x, y, scale, rotation, opacity } = clip.transform;

      // Center of project is origin for transforms usually, but let's just do top-left relative for simplicity here
      // To center-origin:
      this.ctx.translate(project.width / 2 + x, project.height / 2 + y);
      this.ctx.rotate(rotation * Math.PI / 180);
      this.ctx.scale(scale, scale);

      this.ctx.globalAlpha = opacity;

      // Apply effects (CSS filters)
      if (clip.effects && clip.effects.length > 0) {
        this.ctx.filter = clip.effects.join(' ');
      }

      if (clip.kind === 'text') {
        const textDef = clip.text;
        this.ctx.font = `${textDef.size}px ${textDef.font || 'sans-serif'}`;
        this.ctx.fillStyle = textDef.color;
        this.ctx.textAlign = textDef.align;
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(textDef.content, 0, 0);
      } else {
        const el = this.getMediaElement(clip, time);
        if (el) {
          // If it's a video and not ready, it might draw blank, that's fine
          // We need original dimensions to center it
          let nWidth = 0;
          let nHeight = 0;
          if (clip.kind === 'video') {
            nWidth = el.videoWidth;
            nHeight = el.videoHeight;
          } else if (clip.kind === 'image') {
            nWidth = el.width;
            nHeight = el.height;
          }

          if (nWidth && nHeight) {
            // Draw centered
            this.ctx.drawImage(el, -nWidth / 2, -nHeight / 2, nWidth, nHeight);
          }
        }
      }

      this.ctx.restore();
    }
  }

  /**
   * Export API
   */
  renderRange(t0, t1, fps, onFrameCallback) {
    const frameDuration = 1 / fps;
    for (let t = t0; t <= t1; t += frameDuration) {
      this.render(t);
      onFrameCallback(this.canvas, t);
    }
  }
}

export const compositor = new Compositor();
