import { bus } from './bus.js';
import { store } from './state.js';
import { mediaManager } from './media.js';

class PlaybackEngine {
  constructor() {
    this.currentTime = 0;
    this.isPlaying = false;
    this.playbackRate = 1;
    this.lastFrameTime = 0;
    this.rafId = null;

    this.audioElements = {}; // Map of clipId -> HTMLAudioElement

    bus.on('state:changed', () => {
      // If paused, re-render the current frame to reflect edits
      if (!this.isPlaying) {
        this.emitTimeUpdate();
      }
      this.syncAudioClips();
    });
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastFrameTime = performance.now();
    this.rafId = requestAnimationFrame((now) => this.tick(now));
    bus.emit('playback:play');
    this.playAudioElements();
  }

  pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    cancelAnimationFrame(this.rafId);
    bus.emit('playback:pause');
    this.pauseAudioElements();
  }

  toggle() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  seek(time) {
    this.currentTime = Math.max(0, Math.min(time, store.state.project.duration));
    this.emitTimeUpdate();
    if (this.isPlaying) {
      // Sync audio playheads immediately
      this.syncAudioClips(true);
    } else {
      // Pre-seek audio so it's ready when played
      this.syncAudioClips();
    }
  }

  shuttle(direction) {
    // J/K/L behavior
    // direction = -1 (J), 0 (K), 1 (L)
    if (direction === 0) {
      this.pause();
      this.playbackRate = 1;
    } else if (direction === 1) {
      if (!this.isPlaying) {
        this.playbackRate = 1;
        this.play();
      } else {
        this.playbackRate = Math.min(this.playbackRate * 2, 8); // 1, 2, 4, 8
      }
    } else if (direction === -1) {
      // We don't support true reverse playback for media easily in browsers,
      // but we can step the playhead back if just scrubbing UI,
      // or pause if playing forward.
      if (this.isPlaying) {
        this.pause();
        this.playbackRate = 1;
      } else {
        // Step back quickly
        this.seek(this.currentTime - 1);
      }
    }
  }

  step(frames) {
    this.pause();
    const fps = store.state.project.fps;
    const timeStep = frames / fps;
    this.seek(this.currentTime + timeStep);
  }

  tick(now) {
    if (!this.isPlaying) return;

    const deltaMs = now - this.lastFrameTime;
    this.lastFrameTime = now;

    this.currentTime += (deltaMs / 1000) * this.playbackRate;

    // Loop at end
    if (this.currentTime >= store.state.project.duration) {
      this.currentTime = 0;
      this.syncAudioClips(true);
    }

    this.emitTimeUpdate();
    this.syncAudioClips();

    this.rafId = requestAnimationFrame((n) => this.tick(n));
  }

  emitTimeUpdate() {
    bus.emit('playback:timeupdate', { time: this.currentTime });
  }

  // --- Audio Management ---

  syncAudioClips(forceSeek = false) {
    const { tracks, clips } = store.state;

    // We only care about audio tracks or video tracks that have audio (for simplicity, let's treat video audio similarly if we want, but usually video audio is driven by video element.
    // Wait, compositor muted the video elements. So we must manage video audio here as well!)

    const activeAudioClips = [];

    for (const track of tracks) {
      for (const clipId of track.clips) {
        const clip = clips[clipId];
        if (!clip) continue;
        if (clip.kind === 'audio' || clip.kind === 'video') {
          activeAudioClips.push(clip);
        }
      }
    }

    // Clean up old audio elements
    const activeIds = new Set(activeAudioClips.map(c => c.id));
    for (const id in this.audioElements) {
      if (!activeIds.has(id)) {
        this.audioElements[id].pause();
        this.audioElements[id].remove();
        delete this.audioElements[id];
      }
    }

    // Update active
    for (const clip of activeAudioClips) {
      const isWithinClip = this.currentTime >= clip.start && this.currentTime < clip.start + clip.duration;

      let el = this.audioElements[clip.id];

      if (!el) {
        const url = mediaManager.getUrl(clip.assetId);
        if (!url) continue;
        el = new Audio(url);
        this.audioElements[clip.id] = el;
      }

      if (isWithinClip) {
        const localTime = (this.currentTime - clip.start) + clip.offset;

        // Ensure playhead is near
        if (forceSeek || Math.abs(el.currentTime - localTime) > 0.1) {
          el.currentTime = localTime;
        }

        if (this.isPlaying && el.paused) {
          el.play().catch(e => console.warn('Audio play prevented:', e));
        } else if (!this.isPlaying && !el.paused) {
          el.pause();
        }
      } else {
        if (!el.paused) {
          el.pause();
        }
      }
    }
  }

  playAudioElements() {
    this.syncAudioClips(true);
  }

  pauseAudioElements() {
    for (const id in this.audioElements) {
      this.audioElements[id].pause();
    }
  }
}

export const playback = new PlaybackEngine();

// Formatter helper
export function formatTimecode(timeSec, fps) {
  const m = Math.floor(timeSec / 60);
  const s = Math.floor(timeSec % 60);
  const f = Math.floor((timeSec % 1) * fps);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${f.toString().padStart(2, '0')}`;
}
