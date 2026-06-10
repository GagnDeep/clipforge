import { store } from '../../core/state.js';

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function CmdAddTextGraphicClip(trackId, start, duration, kind, dataDef) {
  const clipId = 'clip_' + generateId();
  return {
    execute: (state) => {
      const clip = {
        id: clipId,
        assetId: null,
        kind: kind, // 'text' or 'graphic'
        trackId: trackId,
        start: start,
        offset: 0,
        duration: duration,
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
        effects: []
      };

      if (kind === 'text') {
        clip.text = JSON.parse(JSON.stringify(dataDef)); // Deep copy the preset def
      } else if (kind === 'graphic') {
        clip.graphic = JSON.parse(JSON.stringify(dataDef));
      }

      state.clips[clipId] = clip;
      const track = state.tracks.find(t => t.id === trackId);
      if (track) {
        track.clips.push(clipId);
      }
    },
    undo: (state) => {
      delete state.clips[clipId];
      const track = state.tracks.find(t => t.id === trackId);
      if (track) {
        track.clips = track.clips.filter(id => id !== clipId);
      }
    }
  };
}

export function CmdUpdateClipTransform(clipId, newTransform) {
  let oldTransform = null;
  return {
    execute: (state) => {
      const clip = state.clips[clipId];
      if (!clip) return;
      if (!oldTransform) {
        oldTransform = JSON.parse(JSON.stringify(clip.transform));
      }
      clip.transform = JSON.parse(JSON.stringify(newTransform));
    },
    undo: (state) => {
      const clip = state.clips[clipId];
      if (!clip) return;
      clip.transform = JSON.parse(JSON.stringify(oldTransform));
    }
  };
}

export function CmdUpdateClipProps(clipId, propsObj, type) {
  let oldProps = null;
  return {
    execute: (state) => {
      const clip = state.clips[clipId];
      if (!clip) return;

      if (type === 'text' && clip.text) {
        if (!oldProps) oldProps = JSON.parse(JSON.stringify(clip.text));
        clip.text = { ...clip.text, ...propsObj };
      } else if (type === 'graphic' && clip.graphic) {
        if (!oldProps) oldProps = JSON.parse(JSON.stringify(clip.graphic));
        clip.graphic = { ...clip.graphic, ...propsObj };
      }
    },
    undo: (state) => {
      const clip = state.clips[clipId];
      if (!clip) return;
      if (type === 'text' && clip.text) {
        clip.text = JSON.parse(JSON.stringify(oldProps));
      } else if (type === 'graphic' && clip.graphic) {
        clip.graphic = JSON.parse(JSON.stringify(oldProps));
      }
    }
  };
}
