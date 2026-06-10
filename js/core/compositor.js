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
    if (clip.kind === 'text' || clip.kind === 'graphic') return null;

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

      // Sort clips on track by start time to find adjacencies easily
      const trackClips = track.clips.map(id => clips[id]).filter(c => c).sort((a, b) => a.start - b.start);

      for (let j = 0; j < trackClips.length; j++) {
        const clip = trackClips[j];
        const isActive = time >= clip.start && time < clip.start + clip.duration;

        let inTransition = false;
        let tProgress = 0;

        if (clip.transition && j > 0) {
            const prevClip = trackClips[j-1];
            const isAdjacent = Math.abs((prevClip.start + prevClip.duration) - clip.start) < 0.1;

            if (isAdjacent && time >= clip.start && time < clip.start + clip.transition.duration) {
                inTransition = true;
                tProgress = (time - clip.start) / clip.transition.duration;
            }
        }

        if (isActive) {
           activeClips.push({ clip, inTransition, tProgress });
        } else if (j < trackClips.length - 1 && trackClips[j+1].transition) {
           const nextClip = trackClips[j+1];
           const isAdjacent = Math.abs((clip.start + clip.duration) - nextClip.start) < 0.1;
           if (isAdjacent && time >= nextClip.start && time < nextClip.start + nextClip.transition.duration) {
               activeClips.push({ clip, isGhost: true, nextClip });
           }
        }
      }
    }

    // Draw clips
    for (const renderData of activeClips) {
      const { clip, isGhost, inTransition, tProgress, nextClip } = renderData;

      this.ctx.save();

      // Apply transform
      const { x, y, scale, rotation, opacity } = clip.transform;

      // Center of project is origin for transforms usually, but let's just do top-left relative for simplicity here
      // To center-origin:
      this.ctx.translate(project.width / 2 + x, project.height / 2 + y);
      this.ctx.rotate(rotation * Math.PI / 180);
      this.ctx.scale(scale, scale);

      // Entrance/Exit Animations (fade, slide, pop, typewriter handled in text)
      let currentOpacity = opacity;
      let offsetX = 0;
      let offsetY = 0;
      let currentScale = 1;

      // Calculate clipLocalTime depending on whether it's ghost or not
      // For ghost frame, the local time should be frozen at the end of the clip duration
      // to avoid running past the end of the video or animation.
      let clipLocalTime = time - clip.start;
      if (isGhost) clipLocalTime = clip.duration - 0.001; // Just before end

      const timeFromEnd = clip.duration - clipLocalTime;

      if (anims.in && clipLocalTime < anims.inDuration) {
        const t = clipLocalTime / anims.inDuration;
        if (anims.in === 'fade') currentOpacity *= t;
        if (anims.in === 'slide') offsetY += (1 - t) * 100;
        if (anims.in === 'pop') currentScale *= t;
      }
      if (anims.out && timeFromEnd < anims.outDuration) {
        const t = timeFromEnd / anims.outDuration;
        if (anims.out === 'fade') currentOpacity *= t;
        if (anims.out === 'slide') offsetY += (1 - t) * 100;
        if (anims.out === 'pop') currentScale *= t;
      }

      // Transitions
      if (isGhost && nextClip) {
          const transTime = time - nextClip.start;
          const tProgressNext = transTime / nextClip.transition.duration;
          if (nextClip.transition.type === 'crossfade') {
              // Ghost stays opaque, incoming clip fades in over it
              currentOpacity *= 1;
          } else if (nextClip.transition.type === 'dipToBlack') {
              // First half: fade out to black. Second half: next clip fades in from black.
              if (tProgressNext < 0.5) {
                 const fadeOut = 1 - (tProgressNext * 2);
                 currentOpacity *= fadeOut;
              } else {
                 currentOpacity = 0;
              }
          }
      } else if (inTransition) {
          if (clip.transition.type === 'crossfade') {
              currentOpacity *= tProgress;
          } else if (clip.transition.type === 'dipToBlack') {
              if (tProgress > 0.5) {
                  const fadeIn = (tProgress - 0.5) * 2;
                  currentOpacity *= fadeIn;
              } else {
                  currentOpacity = 0;
              }
          }
      }

      this.ctx.translate(offsetX, offsetY);
      this.ctx.scale(currentScale, currentScale);
      this.ctx.globalAlpha = Math.max(0, currentOpacity);

      // Apply effects (CSS filters)
      if (clip.effects && clip.effects.length > 0) {
        this.ctx.filter = clip.effects.join(' ');
      }

      if (clip.kind === 'text') {
        const textDef = clip.text;
        this.ctx.font = `${textDef.size}px ${textDef.font || 'sans-serif'}`;
        this.ctx.textAlign = textDef.align || 'center';
        this.ctx.textBaseline = 'middle';

        let content = textDef.content;

        // Typewriter animation
        if (anims.in === 'typewriter' && clipLocalTime < anims.inDuration) {
           const chars = Math.floor((clipLocalTime / anims.inDuration) * content.length);
           content = content.substring(0, chars);
        }

        // Max-width wrap and newline support
        const maxWidth = textDef.maxWidth || 9999;
        const hardLines = content.split('\n');
        let lines = [];

        for (const hLine of hardLines) {
          const words = hLine.split(' ');
          let currentLine = words[0] || '';

          for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = this.ctx.measureText(currentLine + " " + word).width;
            if (width < maxWidth) {
              currentLine += " " + word;
            } else {
              lines.push(currentLine);
              currentLine = word;
            }
          }
          lines.push(currentLine);
        }

        const lineHeight = textDef.size * 1.2;
        const totalHeight = lines.length * lineHeight;
        let startY = -totalHeight / 2 + lineHeight / 2;

        // Padding
        const padX = textDef.paddingX || 0;
        const padY = textDef.paddingY || 0;

        // Shadow
        if (textDef.shadow) {
           this.ctx.shadowColor = textDef.shadow.color || 'rgba(0,0,0,0.5)';
           this.ctx.shadowBlur = textDef.shadow.blur || 10;
           this.ctx.shadowOffsetX = textDef.shadow.offsetX || 0;
           this.ctx.shadowOffsetY = textDef.shadow.offsetY || 0;
        } else {
           this.ctx.shadowColor = 'transparent';
        }

        // Measure max line width for background
        let maxLineWidth = 0;
        lines.forEach(line => {
           maxLineWidth = Math.max(maxLineWidth, this.ctx.measureText(line).width);
        });

        // Background pill
        if (textDef.background) {
           this.ctx.fillStyle = textDef.background;
           const bgWidth = maxLineWidth + padX * 2;
           const bgHeight = totalHeight + padY * 2;

           let bgX = -bgWidth / 2; // Default to center
           if (textDef.align === 'left') {
             bgX = -padX;
           } else if (textDef.align === 'right') {
             bgX = -bgWidth + padX;
           }

           const bgY = -totalHeight / 2 - padY;
           const radius = textDef.bgRadius || 0;

           this.ctx.beginPath();
           this.ctx.roundRect(bgX, bgY, bgWidth, bgHeight, radius);
           this.ctx.fill();
        }

        // Reset shadow for text drawing to avoid double shadow if not desired
        if (textDef.shadow) {
           // We keep it for text
        }

        lines.forEach((line, index) => {
          const y = startY + (index * lineHeight);

          if (textDef.stroke) {
             this.ctx.lineWidth = textDef.strokeWidth || 2;
             this.ctx.strokeStyle = textDef.stroke;
             this.ctx.strokeText(line, 0, y);
          }

          this.ctx.fillStyle = textDef.color;
          this.ctx.fillText(line, 0, y);
        });

        this.ctx.shadowColor = 'transparent'; // Reset

      } else if (clip.kind === 'graphic') {
        const gDef = clip.graphic;

        if (gDef.shadow) {
           this.ctx.shadowColor = gDef.shadow.color || 'rgba(0,0,0,0.5)';
           this.ctx.shadowBlur = gDef.shadow.blur || 10;
           this.ctx.shadowOffsetX = gDef.shadow.offsetX || 0;
           this.ctx.shadowOffsetY = gDef.shadow.offsetY || 0;
        }

        if (gDef.type === 'rect' || gDef.type === 'roundrect') {
           this.ctx.fillStyle = gDef.fill || '#fff';
           this.ctx.beginPath();
           const w = gDef.width || 100;
           const h = gDef.height || 100;
           const r = gDef.radius || 0;
           this.ctx.roundRect(-w/2, -h/2, w, h, r);
           this.ctx.fill();
           if (gDef.stroke) {
             this.ctx.lineWidth = gDef.strokeWidth || 2;
             this.ctx.strokeStyle = gDef.stroke;
             this.ctx.stroke();
           }
        } else if (gDef.type === 'circle') {
           this.ctx.fillStyle = gDef.fill || '#fff';
           this.ctx.beginPath();
           this.ctx.arc(0, 0, gDef.radius || 50, 0, Math.PI * 2);
           this.ctx.fill();
           if (gDef.stroke) {
             this.ctx.lineWidth = gDef.strokeWidth || 2;
             this.ctx.strokeStyle = gDef.stroke;
             this.ctx.stroke();
           }
        } else if (gDef.type === 'svg' && gDef.content) {
           // Create image from SVG string
           if (!this.mediaElements[clip.id]) {
             const img = new Image();
             img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(gDef.content);
             this.mediaElements[clip.id] = img;
           }
           const img = this.mediaElements[clip.id];
           if (img && img.complete) {
             const w = gDef.width || img.width || 100;
             const h = gDef.height || img.height || 100;
             this.ctx.drawImage(img, -w/2, -h/2, w, h);
           }
        }

        this.ctx.shadowColor = 'transparent'; // Reset

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
