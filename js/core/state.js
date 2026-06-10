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
