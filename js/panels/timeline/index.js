import { bus } from '../../core/bus.js';
import { store, CmdAddClip, CmdMoveClip, CmdTrimClip, CmdRemoveClip, CmdSplitClip, CmdDuplicateClip, CmdRippleDeleteClip, CmdPasteClips, CmdUpdateTrackState } from '../../core/state.js';
import { playback } from '../../core/playback.js';

export class TimelinePanel {
  constructor() {
    this.root = document.getElementById('timeline-root');
    this.zoomLevel = 20; // px per second
    this.minZoom = 10;
    this.maxZoom = 200;
    this.scrollLeft = 0;
    this.selectedClips = new Set();
    this.magneticSnap = true;
    this.clipboard = [];
    this.minimapCanvas = null;
    this.minimapViewport = null;

    // UI Elements
    this.toolbar = null;
    this.ruler = null;
    this.headersContainer = null;
    this.lanesContainer = null;
    this.lanesContent = null;
    this.playhead = null;
    this.contextMenu = null;

    // Drag/Trim State
    this.dragState = null;

    this.initDOM();
    this.bindEvents();
  }


  initDOM() {
    this.root.innerHTML = '';

    // Toolbar
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'timeline-toolbar';
    this.toolbar.innerHTML = `
      <label><input type="checkbox" id="magnetic-snap" checked> Magnetic Snap</label>
      <div class="timeline-minimap-container" id="minimap-container">
         <canvas class="timeline-minimap-canvas" id="minimap-canvas"></canvas>
         <div class="timeline-minimap-viewport" id="minimap-viewport"></div>
      </div>
      <input type="range" id="timeline-zoom" class="zoom-slider" min="${this.minZoom}" max="${this.maxZoom}" value="${this.zoomLevel}">
    `;
    this.root.appendChild(this.toolbar);
    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapViewport = document.getElementById('minimap-viewport');

    // Ruler
    this.ruler = document.createElement('div');
    this.ruler.className = 'timeline-ruler';
    this.rulerCanvas = document.createElement('canvas');
    this.ruler.appendChild(this.rulerCanvas);
    this.root.appendChild(this.ruler);

    // Body
    const bodyContainer = document.createElement('div');
    bodyContainer.className = 'timeline-body-container';

    this.headersContainer = document.createElement('div');
    this.headersContainer.className = 'timeline-headers';
    bodyContainer.appendChild(this.headersContainer);

    this.lanesContainer = document.createElement('div');
    this.lanesContainer.className = 'timeline-lanes';

    this.lanesContent = document.createElement('div');
    this.lanesContent.className = 'timeline-lanes-content';
    this.lanesContainer.appendChild(this.lanesContent);

    this.playhead = document.createElement('div');
    this.playhead.className = 'timeline-playhead';
    this.playhead.innerHTML = '<div class="timeline-playhead-head"></div>';
    this.lanesContent.appendChild(this.playhead);

    bodyContainer.appendChild(this.lanesContainer);
    this.root.appendChild(bodyContainer);

    // Context Menu
    this.contextMenu = document.createElement('div');
    this.contextMenu.className = 'context-menu';
    this.contextMenu.innerHTML = `
      <div class="context-menu-item" id="ctx-split"><span>Split at Playhead</span><span class="context-menu-shortcut">S</span></div>
      <div class="context-menu-item" id="ctx-duplicate"><span>Duplicate</span></div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-item" id="ctx-delete"><span>Delete</span><span class="context-menu-shortcut">Del</span></div>
      <div class="context-menu-item" id="ctx-ripple-delete"><span>Ripple Delete</span><span class="context-menu-shortcut">Shift+Del</span></div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-item" id="ctx-properties"><span>Properties</span></div>
    `;
    document.body.appendChild(this.contextMenu);

    // Marquee
    this.marquee = document.createElement('div');
    this.marquee.className = 'timeline-marquee';
    this.marquee.style.display = 'none';
    this.lanesContent.appendChild(this.marquee);
  }



  bindEvents() {

    // Track Header Controls
    this.headersContainer.addEventListener('click', (e) => {
       const btn = e.target.closest('.track-btn');
       if (!btn) return;
       const action = btn.dataset.action;
       const trackId = btn.dataset.track;
       const track = store.state.tracks.find(t => t.id === trackId);
       if (!track) return;

       if (action === 'mute') store.dispatch(CmdUpdateTrackState(trackId, { muted: !track.muted }));
       if (action === 'solo') store.dispatch(CmdUpdateTrackState(trackId, { solo: !track.solo }));
       if (action === 'lock') store.dispatch(CmdUpdateTrackState(trackId, { locked: !track.locked }));
    });

    bus.on('state:changed', () => this.render());
    bus.on('playback:timeupdate', () => this.updatePlayhead());

    // Zooming
    const zoomSlider = document.getElementById('timeline-zoom');
    zoomSlider.addEventListener('input', (e) => {
       this.zoomLevel = parseInt(e.target.value);
       this.render();
    });

    this.lanesContainer.addEventListener('wheel', (e) => {
       if (e.ctrlKey || e.metaKey) {
           e.preventDefault();
           const delta = e.deltaY > 0 ? -10 : 10;
           this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel + delta));
           zoomSlider.value = this.zoomLevel;
           this.render();
       }
    }, { passive: false });


    const minimapContainer = document.getElementById('minimap-container');
    if (minimapContainer) {
        minimapContainer.addEventListener('mousedown', (e) => {
            const rect = minimapContainer.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percentage = x / rect.width;
            const time = percentage * store.state.project.duration;
            playback.seek(time);

            // Center lanes scroll on the playhead
            const scrollPx = (time * this.zoomLevel) - (this.lanesContainer.clientWidth / 2);
            this.lanesContainer.scrollLeft = Math.max(0, scrollPx);
        });
    }

    // Sync scrolling
    this.lanesContainer.addEventListener('scroll', () => {
       this.headersContainer.scrollTop = this.lanesContainer.scrollTop;
       this.ruler.scrollLeft = this.lanesContainer.scrollLeft;
       this.updateMinimapViewport();
    });

    // Magnetic Snap Toggle
    document.getElementById('magnetic-snap').addEventListener('change', (e) => {
      this.magneticSnap = e.target.checked;
    });

    // --- Drag and Drop from Library ---
    this.lanesContent.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    this.lanesContent.addEventListener('drop', (e) => {
      e.preventDefault();
      try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        if (data.type === 'asset') {
          // Find which track we dropped on
          const y = e.clientY - this.lanesContent.getBoundingClientRect().top;
          const trackIndex = Math.floor(y / 65);
          const track = store.state.tracks[trackIndex];
          if (!track) return;

          let dropTime = (e.clientX - this.lanesContent.getBoundingClientRect().left) / this.zoomLevel;
          if (this.magneticSnap) dropTime = Math.round(dropTime);
          dropTime = Math.max(0, dropTime);

          store.dispatch(CmdAddClip(track.id, data.id, dropTime, 0, data.duration || 5, data.kind));
        }
      } catch(err) {
        console.warn('Drop error', err);
      }
    });

    // --- Clip Interactions (Move, Trim, Select) ---
    let dragMode = null; // 'move', 'trim-left', 'trim-right', 'marquee'
    let startX = 0;
    let originalClipState = null;
    let targetClipId = null;

    this.lanesContent.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left click

      const handleEl = e.target.closest('.clip-handle');
      const clipEl = e.target.closest('.clip-block');

      if (handleEl && clipEl) {
        // Trimming
        dragMode = handleEl.dataset.handle === 'left' ? 'trim-left' : 'trim-right';
        targetClipId = clipEl.dataset.clipId;
        const clip = store.state.clips[targetClipId];
        originalClipState = { ...clip };
        startX = e.clientX;
        e.stopPropagation();
      } else if (clipEl) {
        // Moving / Selection
        targetClipId = clipEl.dataset.clipId;

        if (e.shiftKey) {
           if (this.selectedClips.has(targetClipId)) this.selectedClips.delete(targetClipId);
           else this.selectedClips.add(targetClipId);
           if (window.app && window.app.inspector) window.app.inspector.setSelectedClipId(targetClipId);
           this.render();
           return; // Don't start drag on shift-click
        } else if (!this.selectedClips.has(targetClipId)) {
           this.selectedClips.clear();
               if (window.app && window.app.inspector) window.app.inspector.setSelectedClipId(null);

               bus.emit('selection:changed');
           this.selectedClips.add(targetClipId);
           if (window.app && window.app.inspector) window.app.inspector.setSelectedClipId(targetClipId);
           this.render();
        }

        dragMode = 'move';
        const clip = store.state.clips[targetClipId];
        originalClipState = { ...clip, startY: e.clientY };
        startX = e.clientX;
        e.stopPropagation();

      } else {
        // Clear selection or start marquee
        this.selectedClips.clear();
               if (window.app && window.app.inspector) window.app.inspector.setSelectedClipId(null);

               bus.emit('selection:changed');
        this.render();

        // Start marquee
        dragMode = 'marquee';
        startX = e.clientX;
        originalClipState = { startY: e.clientY };
        this.marquee.style.display = 'block';
        this.marquee.style.left = `${startX - this.lanesContent.getBoundingClientRect().left}px`;
        this.marquee.style.top = `${originalClipState.startY - this.lanesContent.getBoundingClientRect().top}px`;
        this.marquee.style.width = '0px';
        this.marquee.style.height = '0px';
      }

    });

    window.addEventListener('mousemove', (e) => {
      if (!dragMode) return;

      if (dragMode === 'marquee') {
         const laneRect = this.lanesContent.getBoundingClientRect();
         const currentX = e.clientX;
         const currentY = e.clientY;

         const left = Math.min(startX, currentX) - laneRect.left;
         const top = Math.min(originalClipState.startY, currentY) - laneRect.top;
         const width = Math.abs(currentX - startX);
         const height = Math.abs(currentY - originalClipState.startY);

         this.marquee.style.left = `${left}px`;
         this.marquee.style.top = `${top}px`;
         this.marquee.style.width = `${width}px`;
         this.marquee.style.height = `${height}px`;
         return;
      }

      if (!targetClipId) return;

      const deltaX = e.clientX - startX;
      const deltaTime = deltaX / this.zoomLevel;
      const clip = store.state.clips[targetClipId];
      if (!clip) return;

      if (dragMode === 'move') {
        let newStart = originalClipState.start + deltaTime;
        if (this.magneticSnap) {
           if (Math.abs(newStart - playback.currentTime) < 0.5) newStart = playback.currentTime;
           else newStart = Math.round(newStart);
        }
        newStart = Math.max(0, newStart);

        const laneRect = this.lanesContent.getBoundingClientRect();
        const y = e.clientY - laneRect.top;
        const trackIndex = Math.max(0, Math.floor(y / 65));
        const track = store.state.tracks[trackIndex];

        const el = document.querySelector(`.clip-block[data-clip-id="${targetClipId}"]`);
        if (el) {
          el.style.left = `${newStart * this.zoomLevel}px`;
          if (track && track.id !== clip.trackId) {
             const newLane = document.querySelector(`.track-lane[data-track-id="${track.id}"]`);
             if (newLane) newLane.appendChild(el);
          }
        }
      } else if (dragMode === 'trim-left') {
         let newStart = originalClipState.start + deltaTime;
         let newDuration = originalClipState.duration - deltaTime;
         if (newDuration < 0.1) return;
         const el = document.querySelector(`.clip-block[data-clip-id="${targetClipId}"]`);
         if (el) {
            el.style.left = `${newStart * this.zoomLevel}px`;
            el.style.width = `${newDuration * this.zoomLevel}px`;
         }
      } else if (dragMode === 'trim-right') {
         let newDuration = originalClipState.duration + deltaTime;
         if (newDuration < 0.1) return;
         const el = document.querySelector(`.clip-block[data-clip-id="${targetClipId}"]`);
         if (el) {
            el.style.width = `${newDuration * this.zoomLevel}px`;
         }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (!dragMode) return;

      if (dragMode === 'marquee') {
         this.marquee.style.display = 'none';
         const laneRect = this.lanesContent.getBoundingClientRect();
         const mLeft = Math.min(startX, e.clientX) - laneRect.left;
         const mRight = Math.max(startX, e.clientX) - laneRect.left;
         const mTop = Math.min(originalClipState.startY, e.clientY) - laneRect.top;
         const mBottom = Math.max(originalClipState.startY, e.clientY) - laneRect.top;

         const clipEls = this.lanesContent.querySelectorAll('.clip-block');
         clipEls.forEach(el => {
             const cLeft = parseFloat(el.style.left);
             const cRight = cLeft + parseFloat(el.style.width || el.offsetWidth);
             const trackLane = el.parentElement;
             const cTop = parseFloat(trackLane.style.top) + 4;
             const cBottom = cTop + 56;

             if (cLeft < mRight && cRight > mLeft && cTop < mBottom && cBottom > mTop) {
                 this.selectedClips.add(el.dataset.clipId);
             }
         });
         this.render();
         dragMode = null;
         return;
      }

      if (!targetClipId) return;
      const deltaX = e.clientX - startX;
      const deltaTime = deltaX / this.zoomLevel;

      if (dragMode === 'move') {
        let newStart = originalClipState.start + deltaTime;
        if (this.magneticSnap) {
           if (Math.abs(newStart - playback.currentTime) < 0.5) newStart = playback.currentTime;
           else newStart = Math.round(newStart);
        }
        newStart = Math.max(0, newStart);

        const laneRect = this.lanesContent.getBoundingClientRect();
        const y = e.clientY - laneRect.top;
        const trackIndex = Math.min(store.state.tracks.length - 1, Math.max(0, Math.floor(y / 65)));
        const track = store.state.tracks[trackIndex];

        if (newStart !== originalClipState.start || (track && track.id !== originalClipState.trackId)) {
            store.dispatch(CmdMoveClip(targetClipId, track.id, newStart));
        } else {
            this.render();
        }
      } else if (dragMode === 'trim-left') {
         let newStart = originalClipState.start + deltaTime;
         let newOffset = originalClipState.offset + deltaTime;
         let newDuration = originalClipState.duration - deltaTime;
         if (newDuration >= 0.1) {
            store.dispatch(CmdTrimClip(targetClipId, newStart, newOffset, newDuration));
         } else {
            this.render();
         }
      } else if (dragMode === 'trim-right') {
         let newDuration = originalClipState.duration + deltaTime;
         if (newDuration >= 0.1) {
            store.dispatch(CmdTrimClip(targetClipId, originalClipState.start, originalClipState.offset, newDuration));
         } else {
            this.render();
         }
      }

      dragMode = null;
      targetClipId = null;
      originalClipState = null;
    });

    // --- Playhead Scrubbing ---
    let scrubbing = false;
    this.ruler.addEventListener('mousedown', (e) => {
       if (e.button !== 0) return;
       scrubbing = true;
       const x = e.clientX - this.lanesContent.getBoundingClientRect().left;
       playback.seek(Math.max(0, x / this.zoomLevel));
    });
    this.playhead.querySelector('.timeline-playhead-head').addEventListener('mousedown', (e) => {
       if (e.button !== 0) return;
       scrubbing = true;
       e.stopPropagation();
    });
    window.addEventListener('mousemove', (e) => {
       if (scrubbing) {
           const x = e.clientX - this.lanesContent.getBoundingClientRect().left;
           let time = Math.max(0, x / this.zoomLevel);
           if (this.magneticSnap) {
               // Optional snap to seconds during scrub
               if (Math.abs(time - Math.round(time)) < 0.2) time = Math.round(time);
           }
           playback.seek(time);
       }
    });
    window.addEventListener('mouseup', () => { scrubbing = false; });

    // --- Keyboard Shortcuts ---
    document.addEventListener('keydown', (e) => {
       if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

       if (e.code === 'Backspace' || e.code === 'Delete') {
          if (this.selectedClips.size > 0) {
             const clips = Array.from(this.selectedClips);
             this.selectedClips.clear();
               if (window.app && window.app.inspector) window.app.inspector.setSelectedClipId(null);

               bus.emit('selection:changed');
             if (e.shiftKey) {
                // Ripple Delete (assuming single selection for simplicity, or looping)
                clips.forEach(id => store.dispatch(CmdRippleDeleteClip(id)));
             } else {
                clips.forEach(id => store.dispatch(CmdRemoveClip(id)));
             }
          }
       } else if (e.code === 'KeyS') {
          if (this.selectedClips.size > 0) {
             const time = playback.currentTime;
             Array.from(this.selectedClips).forEach(id => store.dispatch(CmdSplitClip(id, time)));
          }
       } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
          if (this.selectedClips.size > 0) {
             e.preventDefault();
             const fps = store.state.project.fps || 30;
             const nudgeAmount = e.shiftKey ? 1.0 : (1.0 / fps);
             const direction = e.code === 'ArrowLeft' ? -1 : 1;

             Array.from(this.selectedClips).forEach(id => {
                const clip = store.state.clips[id];
                if (clip) {
                   const newStart = Math.max(0, clip.start + (nudgeAmount * direction));
                   store.dispatch(CmdMoveClip(id, clip.trackId, newStart));
                }
             });
          }
       } else if (e.code === 'KeyC' && (e.ctrlKey || e.metaKey)) {
          if (this.selectedClips.size > 0) {
             this.clipboard = Array.from(this.selectedClips).map(id => store.state.clips[id]).filter(c => c);
          }
       } else if (e.code === 'KeyV' && (e.ctrlKey || e.metaKey)) {
          if (this.clipboard && this.clipboard.length > 0) {
             store.dispatch(CmdPasteClips(this.clipboard, playback.currentTime));
          }
       }
    });

    // --- Context Menu ---
    this.lanesContent.addEventListener('contextmenu', (e) => {
       e.preventDefault();
       const clipEl = e.target.closest('.clip-block');
       if (clipEl) {
           const clipId = clipEl.dataset.clipId;
           if (!this.selectedClips.has(clipId)) {
               this.selectedClips.clear();
               if (window.app && window.app.inspector) window.app.inspector.setSelectedClipId(null);

               bus.emit('selection:changed');
               this.selectedClips.add(clipId);
               if (window.app && window.app.inspector) window.app.inspector.setSelectedClipId(clipId);

               bus.emit('selection:changed');
               this.render();
           }
           this.contextMenu.style.display = 'block';
           this.contextMenu.style.left = `${e.clientX}px`;
           this.contextMenu.style.top = `${e.clientY}px`;
       } else {
           this.contextMenu.style.display = 'none';
       }
    });

    document.addEventListener('click', () => {
       this.contextMenu.style.display = 'none';
    });

    document.getElementById('ctx-split').addEventListener('click', () => {
       const time = playback.currentTime;
       Array.from(this.selectedClips).forEach(id => store.dispatch(CmdSplitClip(id, time)));
    });
    document.getElementById('ctx-duplicate').addEventListener('click', () => {
       Array.from(this.selectedClips).forEach(id => store.dispatch(CmdDuplicateClip(id)));
    });
    document.getElementById('ctx-delete').addEventListener('click', () => {
       const clips = Array.from(this.selectedClips);
       this.selectedClips.clear();
               if (window.app && window.app.inspector) window.app.inspector.setSelectedClipId(null);

               bus.emit('selection:changed');
       clips.forEach(id => store.dispatch(CmdRemoveClip(id)));
    });
    const rippleBtn = document.getElementById('ctx-ripple-delete');
    if(rippleBtn) rippleBtn.addEventListener('click', () => {
       const clips = Array.from(this.selectedClips);
       this.selectedClips.clear();
               if (window.app && window.app.inspector) window.app.inspector.setSelectedClipId(null);

               bus.emit('selection:changed');
       clips.forEach(id => store.dispatch(CmdRippleDeleteClip(id)));
    });
    const propBtn = document.getElementById('ctx-properties');
    if(propBtn) propBtn.addEventListener('click', () => {
       // In a real implementation, this would focus the Inspector panel or open a dialog.
       alert("Properties: " + Array.from(this.selectedClips).join(', '));
    });

  } // end bindEvents
  render() {
    const { tracks, project } = store.state;
    const duration = project.duration;

    // Resize ruler canvas and lanes content
    const totalWidth = Math.max(this.lanesContainer.clientWidth, duration * this.zoomLevel + 100); // 100px padding
    this.lanesContent.style.width = `${totalWidth}px`;
    this.rulerCanvas.width = totalWidth;
    this.rulerCanvas.height = 24;

    this.drawRuler(duration);

    // Store scroll position to avoid resetting on re-render
    const currentScrollY = this.headersContainer.scrollTop;

    this.headersContainer.innerHTML = '';

    // We'll clear clips next step, for now just create the lanes
    Array.from(this.lanesContent.children).forEach(child => {
       if (child !== this.playhead && child !== this.marquee) {
           child.remove();
       }
    });

    tracks.forEach((track, index) => {
      // Header
      const header = document.createElement('div');
      header.className = 'track-header';
      header.innerHTML = `
        <div class="track-header-top">
          <div class="track-header-name">${track.name}</div>
          <div class="track-header-controls">
            <button class="track-btn ${track.muted ? 'active' : ''}" data-action="mute" data-track="${track.id}">M</button>
            <button class="track-btn ${track.solo ? 'active' : ''}" data-action="solo" data-track="${track.id}">S</button>
            <button class="track-btn ${track.locked ? 'active' : ''}" data-action="lock" data-track="${track.id}">L</button>
          </div>
        </div>
      `;
      this.headersContainer.appendChild(header);

      // Lane
      const lane = document.createElement('div');
      lane.className = 'track-lane';
      lane.dataset.trackId = track.id;
      lane.style.top = `${index * 65}px`; // 64px height + 1px border
      this.lanesContent.appendChild(lane);

      this.renderClipsForTrack(track, lane);
    });


    this.updatePlayhead();
    this.headersContainer.scrollTop = currentScrollY;
    this.renderMinimap(duration);
  }

  renderMinimap(duration) {
     if (!this.minimapCanvas) return;
     const container = this.minimapCanvas.parentElement;
     const width = container.clientWidth;
     const height = container.clientHeight;
     this.minimapCanvas.width = width;
     this.minimapCanvas.height = height;

     const ctx = this.minimapCanvas.getContext('2d');
     ctx.clearRect(0, 0, width, height);

     if (duration <= 0) return;

     const { tracks, clips } = store.state;
     const trackHeight = height / Math.max(1, tracks.length);
     const scaleX = width / duration;

     ctx.fillStyle = '#555A64';
     tracks.forEach((track, i) => {
        track.clips.forEach(clipId => {
           const clip = clips[clipId];
           if (!clip) return;
           ctx.fillRect(clip.start * scaleX, i * trackHeight, clip.duration * scaleX, trackHeight - 1);
        });
     });

     this.updateMinimapViewport();
  }

  updateMinimapViewport() {
     if (!this.minimapViewport || store.state.project.duration <= 0) return;
     const container = this.minimapViewport.parentElement;
     const width = container.clientWidth;
     const scaleX = width / store.state.project.duration;

     const viewStartTime = this.lanesContainer.scrollLeft / this.zoomLevel;
     const viewDuration = this.lanesContainer.clientWidth / this.zoomLevel;

     this.minimapViewport.style.left = `${viewStartTime * scaleX}px`;
     this.minimapViewport.style.width = `${viewDuration * scaleX}px`;
  }

  drawRuler(duration) {
    const ctx = this.rulerCanvas.getContext('2d');
    const width = this.rulerCanvas.width;
    const height = this.rulerCanvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#A0A5AD';
    ctx.font = '10px Archivo';
    ctx.textBaseline = 'middle';

    // Adaptive ticks
    let tickStep = 1; // seconds
    if (this.zoomLevel < 10) tickStep = 10;
    else if (this.zoomLevel < 20) tickStep = 5;
    else if (this.zoomLevel < 50) tickStep = 2;

    for (let t = 0; t <= duration; t += tickStep) {
      const x = t * this.zoomLevel;
      ctx.fillRect(x, 14, 1, 10);

      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      const label = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

      // Prevent label overlapping
      const labelWidth = ctx.measureText(label).width;
      if (x === 0 || x - (labelWidth/2) > 0) {
        ctx.fillText(label, x + 4, 12);
      }
    }
  }


  renderClipsForTrack(track, lane) {
    const { clips, assets } = store.state;

    track.clips.forEach(clipId => {
      const clip = clips[clipId];
      if (!clip) return;

      const asset = assets[clip.assetId];
      const clipEl = document.createElement('div');
      clipEl.className = 'clip-block' + (this.selectedClips.has(clipId) ? ' selected' : '');
      clipEl.dataset.clipId = clipId;

      const leftPx = clip.start * this.zoomLevel;
      const widthPx = clip.duration * this.zoomLevel;

      clipEl.style.left = `${leftPx}px`;
      clipEl.style.width = `${Math.max(widthPx, 2)}px`; // min width

      let contentHtml = '';
      if (asset) {
        if (asset.kind === 'video' || asset.kind === 'image') {
          // Simple repeating filmstrip
          if (asset.thumbnailUrl) {
             const repeats = Math.ceil(widthPx / 50); // assume ~50px wide thumbs
             let imgs = '';
             for(let i=0; i<repeats; i++) imgs += `<img src="${asset.thumbnailUrl}">`;
             contentHtml = `<div class="clip-filmstrip">${imgs}</div>`;
          }
        } else if (asset.kind === 'audio') {
           // We could draw waveform onto a canvas, but simple generic styling is okay for now or use the thumbnail which is an audio icon
           if (asset.thumbnailUrl) {
              contentHtml = `<div class="clip-waveform" style="background: url(${asset.thumbnailUrl}) repeat-x center;"></div>`;
           }
        }
      }

      clipEl.innerHTML = `
        <div class="clip-block-label">${asset ? asset.name : 'Text Clip'}</div>
        <div class="clip-block-content">${contentHtml}</div>
        <div class="clip-handle clip-handle-left" data-handle="left"></div>
        <div class="clip-handle clip-handle-right" data-handle="right"></div>
      `;

      lane.appendChild(clipEl);
    });
  }

  updatePlayhead() {
     const x = playback.currentTime * this.zoomLevel;
     this.playhead.style.transform = `translateX(${x}px)`;
  }
}
