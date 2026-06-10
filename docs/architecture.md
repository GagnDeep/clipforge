# ClipForge Architecture

## Overview
ClipForge is built using vanilla ES modules with a strong separation of concerns. Modules communicate via a central event bus (`bus.js`) and a unified state store (`state.js`).

## Module Map
- **`core/bus.js`**: Tiny typed event bus.
- **`core/state.js`**: Project model, store, command pattern (undo/redo), autosave.
- **`core/media.js`**: Asset manager, import handling, metadata/thumbnail extraction.
- **`core/compositor.js`**: Preview engine, canvas rendering, applying transforms/effects.
- **`core/playback.js`**: Transport, play/pause/seek, master clock syncing.
- **`panels/library.js`**: Media Library UI, grid of imported assets, drag-and-drop.
- **`app.js` (or inline in index.html)**: Main integration, instantiation, wiring.

## State Schema
The core project state (`state.project`) follows this structure:

```javascript
{
  project: {
    id: 'string',
    name: 'string',
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 0 // In seconds
  },
  tracks: [
    {
      id: 'string',
      kind: 'video' | 'audio' | 'text',
      name: 'string',
      clips: [
        // clip IDs
      ]
    }
  ],
  clips: {
    'clip_id': {
      id: 'string',
      assetId: 'string' | null, // null for text clips
      kind: 'video' | 'audio' | 'image' | 'text',
      trackId: 'string',
      start: 0, // Time in project (seconds)
      offset: 0, // Offset into the media (seconds)
      duration: 5, // Duration in the project (seconds)
      transform: {
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        opacity: 1
      },
      effects: [
        // CSS filter strings like 'brightness(1.2)'
      ],
      text: { // Only for text clips
        content: 'string',
        font: 'string',
        size: 48,
        color: '#ffffff',
        align: 'center'
      }
    }
  },
  assets: {
    'asset_id': {
      id: 'string',
      name: 'string',
      kind: 'video' | 'audio' | 'image',
      duration: 10,
      width: 1920, // Optional
      height: 1080, // Optional
      thumbnailUrl: 'blob:...' // Session only
    }
  }
}
```
*Note: Asset objects have transient properties (like `thumbnailUrl` or the raw File blob) which are stripped during JSON export. Project files rely on name and fingerprint for relinking.*

## Commands
Every mutation to the state uses the Command pattern. Commands are functions that return an object `{ execute, undo }`. The store pushes them to an undo stack.
- `CmdAddClip(trackId, assetId, start, offset, duration)`
- `CmdMoveClip(clipId, newTrackId, newStart)`
- `CmdTrimClip(clipId, newStart, newOffset, newDuration)`
- `CmdRemoveClip(clipId)`
- `CmdUpdateProjectName(newName)`
- `CmdUpdateClipTransform(clipId, transform)`

## Bus Events
All cross-module communication happens through the bus.
- `state:changed` - Fired when the store applies a command or undo/redo.
- `media:imported` - Fired when a new asset is added.
- `media:loaded` - Fired when asset metadata/thumbnail is ready.
- `playback:timeupdate` - Fired on every requestAnimationFrame during playback (payload `{ time }`).
- `playback:play`
- `playback:pause`
- `project:load`
- `project:save`

## Interfaces for Upcoming Modules

### Timeline UI Contract
- **Reads**: Store `state.tracks`, `state.clips`.
- **Listens**: `state:changed`, `playback:timeupdate`.
- **Dispatches**: Commands (`CmdMoveClip`, `CmdTrimClip`, `CmdAddClip` on drag-drop).
- **DOM**: Mounts into `#timeline-root`.

### Inspector Contract
- **Reads**: Currently selected clip from a selection state (managed in state or a separate UI state).
- **Listens**: `state:changed`.
- **Dispatches**: Commands (`CmdUpdateClipTransform`, `CmdTrimClip`, etc.).

### Export Contract
The compositor will expose:
```javascript
compositor.renderRange(t0, t1, onFrameCallback)
```
- The export module will iterate from `t0` to `t1` based on `project.fps`, capturing frames via `compositor.canvas` and feeding them to WebCodecs or MediaRecorder.
