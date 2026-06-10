import { bus } from './bus.js';

const AUTOSAVE_KEY = 'clipforge_autosave';

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function getInitialState() {
  return {
    project: {
      id: generateId(),
      name: 'Untitled Project',
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 30 // Initial duration, grows as needed
    },
    tracks: [
      { id: 'v1', kind: 'video', name: 'V1', clips: [] },
      { id: 'a1', kind: 'audio', name: 'A1', clips: [] }
    ],
    clips: {},
    assets: {} // Holds session-persistent asset info (JSON serialized form minus blob URLs)
  };
}

class Store {
  constructor() {
    this.state = getInitialState();
    this.undoStack = [];
    this.redoStack = [];
    this.isApplying = false;

    this.loadAutosave();
  }

  loadAutosave() {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        this.state = JSON.parse(saved);
        // Clean up transient properties just in case
        for (const assetId in this.state.assets) {
          if (this.state.assets[assetId]) {
            delete this.state.assets[assetId].thumbnailUrl;
          }
        }
        console.log('Project loaded from autosave.');
      }
    } catch (e) {
      console.warn('Failed to load autosave:', e);
    }
  }

  saveAutosave() {
    try {
      const stateToSave = JSON.parse(JSON.stringify(this.state));
      // Scrub transient properties before saving
      for (const assetId in stateToSave.assets) {
        if (stateToSave.assets[assetId]) {
           delete stateToSave.assets[assetId].thumbnailUrl;
        }
      }
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      console.warn('Failed to autosave:', e);
    }
  }

  exportProject() {
    const stateToSave = JSON.parse(JSON.stringify(this.state));
    for (const assetId in stateToSave.assets) {
      if (stateToSave.assets[assetId]) {
         delete stateToSave.assets[assetId].thumbnailUrl;
      }
    }
    const blob = new Blob([JSON.stringify(stateToSave, null, 2)], { type: 'application/json' });
    return URL.createObjectURL(blob);
  }

  importProject(jsonString) {
    try {
      const newState = JSON.parse(jsonString);
      this.state = newState;
      this.undoStack = [];
      this.redoStack = [];
      this.saveAutosave();
      bus.emit('state:changed', this.state);
      bus.emit('project:load', this.state);
      return true;
    } catch (e) {
      console.error('Failed to import project:', e);
      return false;
    }
  }

  // --- Command Pattern ---

  /**
   * Dispatches a command object { execute: (state) => void, undo: (state) => void }
   */
  dispatch(command) {
    if (this.isApplying) return;
    this.isApplying = true;

    // Deep clone state before applying to allow true immutable rollback if we wanted it
    // But since execute mutates the passed state directly, we just pass this.state
    command.execute(this.state);

    this.undoStack.push(command);
    this.redoStack = []; // Clear redo on new action

    this.saveAutosave();
    bus.emit('state:changed', this.state);
    this.isApplying = false;
  }

  undo() {
    if (this.undoStack.length === 0) return;
    this.isApplying = true;

    const command = this.undoStack.pop();
    command.undo(this.state);
    this.redoStack.push(command);

    this.saveAutosave();
    bus.emit('state:changed', this.state);
    this.isApplying = false;
  }

  redo() {
    if (this.redoStack.length === 0) return;
    this.isApplying = true;

    const command = this.redoStack.pop();
    command.execute(this.state);
    this.undoStack.push(command);

    this.saveAutosave();
    bus.emit('state:changed', this.state);
    this.isApplying = false;
  }
}

export const store = new Store();

// --- Built-in Commands ---

export function CmdUpdateProjectName(newName) {
  let oldName = null;
  return {
    execute: (state) => {
      oldName = state.project.name;
      state.project.name = newName;
    },
    undo: (state) => {
      state.project.name = oldName;
    }
  };
}

export function CmdAddAsset(asset) {
  let assetId = asset.id;
  return {
    execute: (state) => {
      state.assets[assetId] = asset;
    },
    undo: (state) => {
      delete state.assets[assetId];
    }
  };
}

export function CmdAddClip(trackId, assetId, start, offset, duration, kind) {
  const clipId = 'clip_' + generateId();
  return {
    execute: (state) => {
      const clip = {
        id: clipId,
        assetId: assetId,
        kind: kind,
        trackId: trackId,
        start: start,
        offset: offset,
        duration: duration,
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
        effects: []
      };
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

export function CmdTrimClip(clipId, newStart, newOffset, newDuration) {
  let oldStart, oldOffset, oldDuration;
  return {
    execute: (state) => {
      const clip = state.clips[clipId];
      if (!clip) return;
      oldStart = clip.start;
      oldOffset = clip.offset;
      oldDuration = clip.duration;

      clip.start = newStart;
      clip.offset = newOffset;
      clip.duration = newDuration;
    },
    undo: (state) => {
      const clip = state.clips[clipId];
      if (!clip) return;
      clip.start = oldStart;
      clip.offset = oldOffset;
      clip.duration = oldDuration;
    }
  };
}

// Helpers
export function getAsset(assetId) {
  return store.state.assets[assetId];
}
export function getClip(clipId) {
  return store.state.clips[clipId];
}

export function CmdMoveClip(clipId, newTrackId, newStart) {
  let oldTrackId, oldStart;
  return {
    execute: (state) => {
      const clip = state.clips[clipId];
      if (!clip) return;
      oldTrackId = clip.trackId;
      oldStart = clip.start;

      clip.start = newStart;
      clip.trackId = newTrackId;

      if (oldTrackId !== newTrackId) {
        const oldTrack = state.tracks.find(t => t.id === oldTrackId);
        const newTrack = state.tracks.find(t => t.id === newTrackId);
        if (oldTrack) oldTrack.clips = oldTrack.clips.filter(id => id !== clipId);
        if (newTrack && !newTrack.clips.includes(clipId)) newTrack.clips.push(clipId);
      }
    },
    undo: (state) => {
      const clip = state.clips[clipId];
      if (!clip) return;
      clip.start = oldStart;
      clip.trackId = oldTrackId;

      if (oldTrackId !== newTrackId) {
        const oldTrack = state.tracks.find(t => t.id === oldTrackId);
        const newTrack = state.tracks.find(t => t.id === newTrackId);
        if (newTrack) newTrack.clips = newTrack.clips.filter(id => id !== clipId);
        if (oldTrack && !oldTrack.clips.includes(clipId)) oldTrack.clips.push(clipId);
      }
    }
  };
}

export function CmdRemoveClip(clipId) {
  let oldClip = null;
  let oldTrackId = null;
  return {
    execute: (state) => {
      const clip = state.clips[clipId];
      if (!clip) return;
      oldClip = JSON.parse(JSON.stringify(clip));
      oldTrackId = clip.trackId;

      delete state.clips[clipId];
      const track = state.tracks.find(t => t.id === oldTrackId);
      if (track) {
        track.clips = track.clips.filter(id => id !== clipId);
      }
    },
    undo: (state) => {
      if (!oldClip) return;
      state.clips[clipId] = JSON.parse(JSON.stringify(oldClip));
      const track = state.tracks.find(t => t.id === oldTrackId);
      if (track && !track.clips.includes(clipId)) {
        track.clips.push(clipId);
      }
    }
  };
}

export function CmdSplitClip(clipId, splitTime) {
  const newClipId = 'clip_' + generateId();
  let oldDuration;
  let addedClipInfo = null;

  return {
    execute: (state) => {
      const clip = state.clips[clipId];
      if (!clip || splitTime <= clip.start || splitTime >= clip.start + clip.duration) return;

      oldDuration = clip.duration;
      const leftDuration = splitTime - clip.start;
      const rightDuration = oldDuration - leftDuration;
      const rightOffset = clip.offset + leftDuration;

      // Update left clip
      clip.duration = leftDuration;

      // Create right clip
      const rightClip = JSON.parse(JSON.stringify(clip));
      rightClip.id = newClipId;
      rightClip.start = splitTime;
      rightClip.offset = rightOffset;
      rightClip.duration = rightDuration;

      // Right clip shouldn't keep the incoming transition of the left clip, as it's an immediate cut
      delete rightClip.transition;

      state.clips[newClipId] = rightClip;

      const track = state.tracks.find(t => t.id === clip.trackId);
      if (track) {
        const idx = track.clips.indexOf(clipId);
        if (idx !== -1) {
          track.clips.splice(idx + 1, 0, newClipId);
        } else {
          track.clips.push(newClipId);
        }
      }

      addedClipInfo = { id: newClipId, trackId: clip.trackId };
    },
    undo: (state) => {
      if (!addedClipInfo) return;

      const clip = state.clips[clipId];
      if (clip) {
        clip.duration = oldDuration;
      }

      delete state.clips[addedClipInfo.id];
      const track = state.tracks.find(t => t.id === addedClipInfo.trackId);
      if (track) {
        track.clips = track.clips.filter(id => id !== addedClipInfo.id);
      }
    }
  };
}

export function CmdDuplicateClip(clipId) {
  const newClipId = 'clip_' + generateId();
  let originalClipData = null;

  return {
    execute: (state) => {
      const clip = state.clips[clipId];
      if (!clip) return;

      originalClipData = JSON.parse(JSON.stringify(clip));

      const newClip = JSON.parse(JSON.stringify(clip));
      newClip.id = newClipId;
      // Place immediately after
      newClip.start = clip.start + clip.duration;

      state.clips[newClipId] = newClip;

      const track = state.tracks.find(t => t.id === clip.trackId);
      if (track) {
        track.clips.push(newClipId);
      }
    },
    undo: (state) => {
      if (!originalClipData) return;
      delete state.clips[newClipId];
      const track = state.tracks.find(t => t.id === originalClipData.trackId);
      if (track) {
        track.clips = track.clips.filter(id => id !== newClipId);
      }
    }
  };
}

export function CmdUpdateClipTransition(clipId, transition) {
  let oldTransition = null;
  return {
    execute: (state) => {
      const clip = state.clips[clipId];
      if (!clip) return;
      if (clip.transition) {
        oldTransition = JSON.parse(JSON.stringify(clip.transition));
      } else {
        oldTransition = null;
      }
      if (transition) {
        clip.transition = JSON.parse(JSON.stringify(transition));
      } else {
        delete clip.transition;
      }
    },
    undo: (state) => {
      const clip = state.clips[clipId];
      if (!clip) return;
      if (oldTransition) {
        clip.transition = JSON.parse(JSON.stringify(oldTransition));
      } else {
        delete clip.transition;
      }
    }
  };
}

export function CmdUpdateTrackState(trackId, updates) {
  let oldValues = {};
  return {
    execute: (state) => {
      const track = state.tracks.find(t => t.id === trackId);
      if (!track) return;
      for (const key in updates) {
        oldValues[key] = track[key];
        track[key] = updates[key];
      }
    },
    undo: (state) => {
      const track = state.tracks.find(t => t.id === trackId);
      if (!track) return;
      for (const key in oldValues) {
        track[key] = oldValues[key];
      }
    }
  };
}

export function CmdRippleDeleteClip(clipId) {
  let oldClip = null;
  let oldTrackId = null;
  let shiftedClips = []; // Array of { id, oldStart }

  return {
    execute: (state) => {
      const clip = state.clips[clipId];
      if (!clip) return;

      oldClip = JSON.parse(JSON.stringify(clip));
      oldTrackId = clip.trackId;
      const duration = clip.duration;
      const start = clip.start;

      // Remove the clip
      delete state.clips[clipId];
      const track = state.tracks.find(t => t.id === oldTrackId);
      if (track) {
        track.clips = track.clips.filter(id => id !== clipId);

        // Shift subsequent clips backward
        track.clips.forEach(id => {
          const c = state.clips[id];
          if (c && c.start >= start) {
            shiftedClips.push({ id: id, oldStart: c.start });
            c.start = Math.max(0, c.start - duration);
          }
        });
      }
    },
    undo: (state) => {
      if (!oldClip) return;

      // Restore shifted clips
      shiftedClips.forEach(change => {
         const c = state.clips[change.id];
         if (c) c.start = change.oldStart;
      });
      shiftedClips = [];

      // Restore the deleted clip
      state.clips[clipId] = JSON.parse(JSON.stringify(oldClip));
      const track = state.tracks.find(t => t.id === oldTrackId);
      if (track && !track.clips.includes(clipId)) {
        track.clips.push(clipId);
      }
    }
  };
}

// Generate an ID helper just for this file again since it's un-exported at the top,
// Actually generateId() is available at the top scope of state.js.

export function CmdPasteClips(clipsData, pasteTime) {
  const generatedClips = []; // Array of actual inserted clips
  let originalTrackIds = {}; // Map of clipId -> trackId

  return {
    execute: (state) => {
      if (clipsData.length === 0) return;

      // Determine the earliest start time among copied clips to maintain relative offsets
      const minStart = Math.min(...clipsData.map(c => c.start));

      clipsData.forEach(clipData => {
         const newId = 'clip_' + Math.random().toString(36).substring(2, 9);
         const relativeStart = clipData.start - minStart;
         const newClip = JSON.parse(JSON.stringify(clipData));

         newClip.id = newId;
         newClip.start = pasteTime + relativeStart;

         state.clips[newId] = newClip;
         generatedClips.push(newId);

         // Add to the same track it was copied from (if it exists), or the first track
         let track = state.tracks.find(t => t.id === clipData.trackId);
         if (!track && state.tracks.length > 0) track = state.tracks[0];

         if (track) {
            track.clips.push(newId);
            originalTrackIds[newId] = track.id;
         }
      });
    },
    undo: (state) => {
      generatedClips.forEach(id => {
         delete state.clips[id];
         const trackId = originalTrackIds[id];
         const track = state.tracks.find(t => t.id === trackId);
         if (track) {
            track.clips = track.clips.filter(cId => cId !== id);
         }
      });
      generatedClips.length = 0;
      originalTrackIds = {};
    }
  };
}
