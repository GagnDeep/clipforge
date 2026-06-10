import { store, getClip } from '../../core/state.js';
import { bus } from '../../core/bus.js';
import {
  CmdUpdateProjectSettings,
  CmdUpdateClipTransform,
  CmdUpdateClipSpeed,
  CmdUpdateClipAudio,
  CmdUpdateClipEffects,
  CmdUpdateClipText,
  CmdAddKeyframe,
  CmdRemoveKeyframe
} from './commands.js';
import { setupDragScrub } from './dragScrub.js';

export class InspectorPanel {
  constructor() {
    this.root = document.getElementById('inspector-root');
    this.content = document.getElementById('inspector-content');
    this.selectedClipId = null;

    this.render = this.render.bind(this);

    this.playbackTime = 0;

    // In index.html, selectedClipId is set. We'll expose a global way to sync or listen to bus.
    // For now, let's assume we are told about selection via `setSelectedClipId`.
    // Alternatively, we can use an event. Let's provide a method `setSelectedClipId`.

    bus.on('state:changed', this.render);
    bus.on('playback:timeupdate', ({ time }) => {
       this.playbackTime = time;
       this.handleKeyframeInterpolation(time);
    });
  }

  handleKeyframeInterpolation(time) {
     if (!this.selectedClipId) return;
     const clip = getClip(this.selectedClipId);
     if (!clip || !clip.keyframes) return;

     let needsUpdate = false;
     let tX = clip.transform?.x ?? 0;
     let tY = clip.transform?.y ?? 0;
     let tScale = clip.transform?.scale ?? 1;
     let tRot = clip.transform?.rotation ?? 0;
     let tOpac = clip.transform?.opacity ?? 1;

     const interpolate = (propName, defaultValue) => {
        const kfs = clip.keyframes[propName];
        if (!kfs || kfs.length === 0) return defaultValue;

        // Clip local time
        const localTime = (time - clip.start) + clip.offset;

        if (localTime <= kfs[0].time) return kfs[0].value;
        if (localTime >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;

        for (let i = 0; i < kfs.length - 1; i++) {
           if (localTime >= kfs[i].time && localTime < kfs[i+1].time) {
              const range = kfs[i+1].time - kfs[i].time;
              const progress = (localTime - kfs[i].time) / range;
              return kfs[i].value + (kfs[i+1].value - kfs[i].value) * progress;
           }
        }
        return defaultValue;
     };

     if (clip.keyframes['transform.opacity']) { tOpac = interpolate('transform.opacity', tOpac); needsUpdate = true; }
     if (clip.keyframes['transform.x']) { tX = interpolate('transform.x', tX); needsUpdate = true; }
     if (clip.keyframes['transform.y']) { tY = interpolate('transform.y', tY); needsUpdate = true; }
     if (clip.keyframes['transform.scale']) { tScale = interpolate('transform.scale', tScale); needsUpdate = true; }
     if (clip.keyframes['transform.rotation']) { tRot = interpolate('transform.rotation', tRot); needsUpdate = true; }

     if (needsUpdate) {
        // Direct mutation for instant preview without flooding undo stack
        if (!clip.transform) clip.transform = {};
        clip.transform.x = tX;
        clip.transform.y = tY;
        clip.transform.scale = tScale;
        clip.transform.rotation = tRot;
        clip.transform.opacity = tOpac;

        // If inspector is rendering this section, we could sync inputs.
        // For performance, we'll only sync DOM elements if they exist.
        const elOpac = document.getElementById('insp-topac');
        if (elOpac && document.activeElement !== elOpac) {
           elOpac.value = tOpac.toFixed(2);
           document.getElementById('insp-topac-slider').value = tOpac;
        }
        const elX = document.getElementById('insp-tx');
        if (elX && document.activeElement !== elX) elX.value = tX.toFixed(1);
        const elY = document.getElementById('insp-ty');
        if (elY && document.activeElement !== elY) elY.value = tY.toFixed(1);
        const elScale = document.getElementById('insp-tscale');
        if (elScale && document.activeElement !== elScale) elScale.value = tScale.toFixed(2);
        const elRot = document.getElementById('insp-trot');
        if (elRot && document.activeElement !== elRot) elRot.value = tRot.toFixed(1);
     }
  }

  setSelectedClipId(id) {
    this.selectedClipId = id;
    this.render();
  }

  render() {
    if (!this.selectedClipId) {
      this.renderProjectSettings();
      return;
    }

    const clip = getClip(this.selectedClipId);
    if (!clip) {
      this.selectedClipId = null;
      this.renderProjectSettings();
      return;
    }

    this.content.innerHTML = '';

    if (clip.kind === 'video' || clip.kind === 'image') {
      this.renderTransformSection(clip);
      this.renderEffectsSection(clip);
    }

    if (clip.kind === 'video' || clip.kind === 'audio') {
      this.renderSpeedSection(clip);
      this.renderAudioSection(clip);
    }

    if (clip.kind === 'text') {
      this.renderTextSection(clip);
      this.renderTransformSection(clip); // Text also needs transforms
    }

    this.renderKeyframeSection(clip);
  }

  renderKeyframeSection(clip) {
    const sec = document.createElement('div');
    sec.style.cssText = "padding: 10px; border-bottom: 1px solid var(--border-light);";
    sec.innerHTML = `
      <h4 style="font-size: 12px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; letter-spacing: 0.5px;">Keyframes (Transform)</h4>
      <div id="insp-kf-lanes" style="margin-top: 8px;"></div>
    `;
    this.content.appendChild(sec);

    const container = document.getElementById('insp-kf-lanes');
    const props = [
      { id: 'transform.opacity', label: 'Opacity', current: clip.transform?.opacity ?? 1 },
      { id: 'transform.x', label: 'X', current: clip.transform?.x ?? 0 },
      { id: 'transform.y', label: 'Y', current: clip.transform?.y ?? 0 },
      { id: 'transform.scale', label: 'Scale', current: clip.transform?.scale ?? 1 },
      { id: 'transform.rotation', label: 'Rotation', current: clip.transform?.rotation ?? 0 }
    ];

    props.forEach(p => {
       const row = document.createElement('div');
       row.style.marginBottom = '6px';

       const kfs = (clip.keyframes && clip.keyframes[p.id]) ? clip.keyframes[p.id] : [];

       // Calculate current local time for playhead representation
       const localTime = (this.playbackTime - clip.start) + clip.offset;

       // Determine if there is a keyframe near current playhead
       const hasKfAtPlayhead = kfs.some(k => Math.abs(k.time - localTime) < 0.05);

       row.innerHTML = `
         <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:2px; align-items:center;">
           <span>${p.label}</span>
           <button class="kf-btn ${hasKfAtPlayhead ? 'kf-active' : ''}" data-prop="${p.id}" data-val="${p.current}" style="background:none; border:none; color:${hasKfAtPlayhead ? 'var(--accent-amber)' : 'var(--text-muted)'}; cursor:pointer; font-size:14px;" title="Add/Update Keyframe at Playhead">
             &#9672;
           </button>
         </div>
         <div style="position:relative; height:12px; background:var(--bg-deep); border:1px solid var(--border-light); border-radius:2px;">
           ${kfs.map(k => {
              const pct = Math.max(0, Math.min(100, (k.time / clip.duration) * 100));
              return `<div style="position:absolute; left:${pct}%; top:50%; transform:translate(-50%, -50%); width:6px; height:6px; background:var(--accent-amber); transform:translate(-50%, -50%) rotate(45deg); cursor:pointer;" title="Value: ${k.value.toFixed(2)}" class="kf-mark" data-prop="${p.id}" data-time="${k.time}"></div>`;
           }).join('')}
         </div>
       `;
       container.appendChild(row);
    });

    // Add / Update Keyframe button logic
    container.querySelectorAll('.kf-btn').forEach(btn => {
       btn.addEventListener('click', (e) => {
          const prop = e.currentTarget.dataset.prop;
          const val = parseFloat(e.currentTarget.dataset.val);
          const localTime = (this.playbackTime - clip.start) + clip.offset;

          if (localTime >= 0 && localTime <= clip.duration) {
             store.dispatch(CmdAddKeyframe(clip.id, prop, localTime, val));
          } else {
             alert('Playhead must be within the clip duration to add a keyframe.');
          }
       });
    });

    // Remove Keyframe logic
    container.querySelectorAll('.kf-mark').forEach(mark => {
       mark.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          const prop = e.currentTarget.dataset.prop;
          const time = parseFloat(e.currentTarget.dataset.time);
          store.dispatch(CmdRemoveKeyframe(clip.id, prop, time));
       });
    });
  }

  renderEffectsSection(clip) {
    const effects = clip.effects || [];
    const availableFilters = ['brightness', 'contrast', 'saturate', 'grayscale', 'sepia', 'blur', 'hue-rotate'];

    const sec = document.createElement('div');
    sec.style.cssText = "padding: 10px; border-bottom: 1px solid var(--border-light);";
    sec.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <h4 style="font-size: 12px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0; letter-spacing: 0.5px;">Effects Rack</h4>
        <select id="insp-add-effect" style="width:100px; padding:2px; font-size:11px; background: var(--bg-deep); border: 1px solid var(--border-light); color: var(--text-main);">
          <option value="">Add Filter...</option>
          ${availableFilters.map(f => `<option value="${f}">${f}</option>`).join('')}
        </select>
      </div>
      <div id="insp-effects-list"></div>
    `;
    this.content.appendChild(sec);

    const listContainer = document.getElementById('insp-effects-list');

    const renderFilters = () => {
      listContainer.innerHTML = '';
      effects.forEach((effectStr, idx) => {
        // Handle "off:" prefix
        let isOff = false;
        let activeStr = effectStr;
        if (effectStr.startsWith('off:')) {
           isOff = true;
           activeStr = effectStr.substring(4);
        }

        // Parse "filter(value)" e.g. "brightness(1.2)" or "blur(5px)"
        const match = activeStr.match(/^([a-z-]+)\(([^)]+)\)$/);
        if (!match) return;
        const name = match[1];
        let valStr = match[2];
        let suffix = '';
        let numVal = 1;

        if (valStr.endsWith('px')) {
           suffix = 'px';
           numVal = parseFloat(valStr);
        } else if (valStr.endsWith('deg')) {
           suffix = 'deg';
           numVal = parseFloat(valStr);
        } else {
           numVal = parseFloat(valStr);
        }

        let min = 0, max = 2, step = 0.05;
        if (name === 'blur') { max = 20; step = 1; }
        if (name === 'hue-rotate') { min = 0; max = 360; step = 1; }
        if (name === 'grayscale' || name === 'sepia') { max = 1; }

        const row = document.createElement('div');
        row.style.cssText = "margin-bottom: 8px; padding: 6px; background: var(--bg-deep); border: 1px solid var(--border-light); border-radius: 2px;";
        row.innerHTML = `
          <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px; align-items:center;">
            <div style="display:flex; align-items:center; gap: 4px;">
               <input type="checkbox" class="effect-toggle" data-idx="${idx}" ${isOff ? '' : 'checked'} style="accent-color: var(--accent-amber); cursor:pointer;">
               <span style="${isOff ? 'text-decoration: line-through; color: var(--text-muted);' : ''}">${name}</span>
            </div>
            <div style="display:flex; gap: 4px;">
               <button class="reorder-up-btn" data-idx="${idx}" style="background:none; border:none; color:var(--text-muted); cursor:pointer;">&#9650;</button>
               <button class="reorder-down-btn" data-idx="${idx}" style="background:none; border:none; color:var(--text-muted); cursor:pointer;">&#9660;</button>
               <button class="remove-btn" data-idx="${idx}" style="background:none; border:none; color:var(--text-muted); cursor:pointer; margin-left: 4px;">&#10005;</button>
            </div>
          </div>
          <div style="display:flex; gap:4px; align-items:center;">
             <input type="range" class="effect-slider" data-idx="${idx}" min="${min}" max="${max}" step="${step}" value="${numVal}" style="flex:1; accent-color: var(--accent-amber);" ${isOff ? 'disabled' : ''}>
             <input type="number" class="effect-num" data-idx="${idx}" value="${numVal}" step="${step}" style="width:50px; background: var(--bg-elevated); border: 1px solid var(--border-light); color: var(--text-main); padding: 2px;" ${isOff ? 'disabled' : ''}>
          </div>
        `;
        listContainer.appendChild(row);
      });

      // Bind events
      listContainer.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
           const i = parseInt(e.currentTarget.dataset.idx);
           const newEff = [...effects];
           newEff.splice(i, 1);
           store.dispatch(CmdUpdateClipEffects(clip.id, newEff));
        });
      });

      listContainer.querySelectorAll('.reorder-up-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
           const i = parseInt(e.currentTarget.dataset.idx);
           if (i === 0) return;
           const newEff = [...effects];
           const temp = newEff[i - 1];
           newEff[i - 1] = newEff[i];
           newEff[i] = temp;
           store.dispatch(CmdUpdateClipEffects(clip.id, newEff));
        });
      });

      listContainer.querySelectorAll('.reorder-down-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
           const i = parseInt(e.currentTarget.dataset.idx);
           if (i === effects.length - 1) return;
           const newEff = [...effects];
           const temp = newEff[i + 1];
           newEff[i + 1] = newEff[i];
           newEff[i] = temp;
           store.dispatch(CmdUpdateClipEffects(clip.id, newEff));
        });
      });

      listContainer.querySelectorAll('.effect-toggle').forEach(chk => {
        chk.addEventListener('change', (e) => {
           const i = parseInt(e.currentTarget.dataset.idx);
           let eff = effects[i];
           if (e.target.checked) {
              if (eff.startsWith('off:')) eff = eff.substring(4);
           } else {
              if (!eff.startsWith('off:')) eff = 'off:' + eff;
           }
           const newEff = [...effects];
           newEff[i] = eff;
           store.dispatch(CmdUpdateClipEffects(clip.id, newEff));
        });
      });

      const updateEffectVal = (idx, rawVal) => {
         let eff = effects[idx];
         let isOff = eff.startsWith('off:');
         let activeStr = isOff ? eff.substring(4) : eff;

         const match = activeStr.match(/^([a-z-]+)\(([^)]+)\)$/);
         if (!match) return;
         const name = match[1];
         let suffix = '';
         if (name === 'blur') suffix = 'px';
         else if (name === 'hue-rotate') suffix = 'deg';

         let newValStr = `${name}(${rawVal}${suffix})`;
         if (isOff) newValStr = 'off:' + newValStr;

         const newEff = [...effects];
         newEff[idx] = newValStr;
         store.dispatch(CmdUpdateClipEffects(clip.id, newEff));
      };

      listContainer.querySelectorAll('.effect-num').forEach(inp => {
        inp.addEventListener('change', (e) => {
           const i = parseInt(e.currentTarget.dataset.idx);
           updateEffectVal(i, e.target.value);
        });
        setupDragScrub(inp, (val) => {
           const i = parseInt(inp.dataset.idx);
           listContainer.querySelector(`.effect-slider[data-idx="${i}"]`).value = val;
           updateEffectVal(i, val);
        }, { step: inp.step });
      });

      listContainer.querySelectorAll('.effect-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
           const i = parseInt(e.currentTarget.dataset.idx);
           // real-time update
           listContainer.querySelector(`.effect-num[data-idx="${i}"]`).value = e.target.value;
           updateEffectVal(i, e.target.value);
        });
      });
    };

    renderFilters();

    document.getElementById('insp-add-effect').addEventListener('change', (e) => {
      const name = e.target.value;
      if (!name) return;
      e.target.value = '';

      let defaultVal = '1';
      if (name === 'blur') defaultVal = '5px';
      else if (name === 'hue-rotate') defaultVal = '90deg';
      else if (name === 'grayscale' || name === 'sepia') defaultVal = '1';

      const newEff = [...effects, `${name}(${defaultVal})`];
      store.dispatch(CmdUpdateClipEffects(clip.id, newEff));
    });
  }

  renderTextSection(clip) {
    const textDef = clip.text || { content: 'Text', font: 'sans-serif', size: 48, weight: '400', color: '#ffffff', align: 'center' };

    const sec = document.createElement('div');
    sec.style.cssText = "padding: 10px; border-bottom: 1px solid var(--border-light);";
    sec.innerHTML = `
      <h4 style="font-size: 12px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; letter-spacing: 0.5px;">Text</h4>
      <div style="margin-bottom: 6px;">
        <label style="font-size: 12px; color: var(--text-main);">Content</label>
        <textarea id="insp-text-content" style="width:100%; height:60px; background:var(--bg-deep); border:1px solid var(--border-light); color:var(--text-main); font-family:var(--font-ui); padding:4px; margin-top:4px; border-radius: 2px;">${textDef.content}</textarea>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <label style="flex: 1; font-size: 12px; color: var(--text-main);">Font</label>
        <select id="insp-text-font" style="flex: 1.5; background: var(--bg-deep); border: 1px solid var(--border-light); color: var(--text-main); padding: 4px; border-radius: 2px; font-family: var(--font-ui); width: 100%;">
          <option value="sans-serif" ${textDef.font === 'sans-serif' ? 'selected' : ''}>Sans-Serif</option>
          <option value="serif" ${textDef.font === 'serif' ? 'selected' : ''}>Serif</option>
          <option value="monospace" ${textDef.font === 'monospace' ? 'selected' : ''}>Monospace</option>
          <option value="Archivo" ${textDef.font === 'Archivo' ? 'selected' : ''}>Archivo</option>
        </select>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <label style="flex: 1; font-size: 12px; color: var(--text-main);">Weight</label>
        <select id="insp-text-weight" style="flex: 1.5; background: var(--bg-deep); border: 1px solid var(--border-light); color: var(--text-main); padding: 4px; border-radius: 2px; font-family: var(--font-ui); width: 100%;">
          <option value="400" ${textDef.weight === '400' ? 'selected' : ''}>Regular</option>
          <option value="500" ${textDef.weight === '500' ? 'selected' : ''}>Medium</option>
          <option value="600" ${textDef.weight === '600' ? 'selected' : ''}>Semi-Bold</option>
          <option value="700" ${textDef.weight === '700' ? 'selected' : ''}>Bold</option>
        </select>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <label style="flex: 1; font-size: 12px; color: var(--text-main);">Size</label>
        <input type="number" id="insp-text-size" value="${textDef.size}" step="1" style="flex: 1.5; background: var(--bg-deep); border: 1px solid var(--border-light); color: var(--text-main); padding: 4px; border-radius: 2px; font-family: var(--font-ui); font-variant-numeric: tabular-nums; width: 100%;">
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <label style="flex: 1; font-size: 12px; color: var(--text-main);">Color</label>
        <input type="color" id="insp-text-color" value="${textDef.color}" style="flex: 1.5; background: transparent; border: none; height: 24px; padding: 0; cursor: pointer;">
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <label style="flex: 1; font-size: 12px; color: var(--text-main);">Align</label>
        <select id="insp-text-align" style="flex: 1.5; background: var(--bg-deep); border: 1px solid var(--border-light); color: var(--text-main); padding: 4px; border-radius: 2px; font-family: var(--font-ui); width: 100%;">
          <option value="left" ${textDef.align === 'left' ? 'selected' : ''}>Left</option>
          <option value="center" ${textDef.align === 'center' ? 'selected' : ''}>Center</option>
          <option value="right" ${textDef.align === 'right' ? 'selected' : ''}>Right</option>
        </select>
      </div>
      <div style="margin-bottom: 6px;">
        <label style="font-size: 12px; color: var(--text-main); margin-bottom: 4px; display: block;">Position Presets</label>
        <div style="display: flex; gap: 4px;">
           <button class="txt-pos-btn" data-preset="top" style="flex:1; background:var(--bg-elevated); border:1px solid var(--border-light); color:var(--text-main); cursor:pointer; font-size:10px; padding:4px;">Top</button>
           <button class="txt-pos-btn" data-preset="center" style="flex:1; background:var(--bg-elevated); border:1px solid var(--border-light); color:var(--text-main); cursor:pointer; font-size:10px; padding:4px;">Center</button>
           <button class="txt-pos-btn" data-preset="bottom" style="flex:1; background:var(--bg-elevated); border:1px solid var(--border-light); color:var(--text-main); cursor:pointer; font-size:10px; padding:4px;">Bottom</button>
        </div>
      </div>
    `;
    this.content.appendChild(sec);

    const update = () => {
      const content = document.getElementById('insp-text-content').value;
      const font = document.getElementById('insp-text-font').value;
      const weight = document.getElementById('insp-text-weight').value;
      const size = parseInt(document.getElementById('insp-text-size').value) || 48;
      const color = document.getElementById('insp-text-color').value;
      const align = document.getElementById('insp-text-align').value;

      store.dispatch(CmdUpdateClipText(clip.id, { content, font, weight, size, color, align }));
    };

    document.getElementById('insp-text-content').addEventListener('change', update);
    document.getElementById('insp-text-font').addEventListener('change', update);
    document.getElementById('insp-text-weight').addEventListener('change', update);

    const sizeInp = document.getElementById('insp-text-size');
    sizeInp.addEventListener('change', update);
    setupDragScrub(sizeInp, update, { step: 1 });

    document.getElementById('insp-text-color').addEventListener('change', update);
    document.getElementById('insp-text-align').addEventListener('change', update);

    sec.querySelectorAll('.txt-pos-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
         const preset = e.target.dataset.preset;
         let y = 0;
         const pHeight = store.state.project.height;
         if (preset === 'top') y = -(pHeight / 2) + 100;
         if (preset === 'bottom') y = (pHeight / 2) - 100;
         if (preset === 'center') y = 0;

         const newTransform = { ...(clip.transform || { x:0, scale:1, rotation:0, opacity:1 }), y };
         store.dispatch(CmdUpdateClipTransform(clip.id, newTransform));
      });
    });
  }

  renderTransformSection(clip) {
    const t = clip.transform || { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };

    const sec = document.createElement('div');
    sec.style.cssText = "padding: 10px; border-bottom: 1px solid var(--border-light);";
    sec.innerHTML = `
      <h4 style="font-size: 12px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; letter-spacing: 0.5px;">Transform</h4>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <label style="flex: 1; font-size: 12px; color: var(--text-main);">X / Y</label>
        <div style="display:flex; gap:4px; flex: 1.5;">
          <input type="number" id="insp-tx" value="${t.x}" step="1" style="flex:1; background: var(--bg-deep); border: 1px solid var(--border-light); color: var(--text-main); padding: 4px; border-radius: 2px; font-family: var(--font-ui); font-variant-numeric: tabular-nums; width: 100%;">
          <input type="number" id="insp-ty" value="${t.y}" step="1" style="flex:1; background: var(--bg-deep); border: 1px solid var(--border-light); color: var(--text-main); padding: 4px; border-radius: 2px; font-family: var(--font-ui); font-variant-numeric: tabular-nums; width: 100%;">
        </div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <label style="flex: 1; font-size: 12px; color: var(--text-main);">Scale</label>
        <input type="number" id="insp-tscale" value="${t.scale}" step="0.01" style="flex: 1.5; background: var(--bg-deep); border: 1px solid var(--border-light); color: var(--text-main); padding: 4px; border-radius: 2px; font-family: var(--font-ui); font-variant-numeric: tabular-nums; width: 100%;">
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <label style="flex: 1; font-size: 12px; color: var(--text-main);">Rotation</label>
        <input type="number" id="insp-trot" value="${t.rotation}" step="1" style="flex: 1.5; background: var(--bg-deep); border: 1px solid var(--border-light); color: var(--text-main); padding: 4px; border-radius: 2px; font-family: var(--font-ui); font-variant-numeric: tabular-nums; width: 100%;">
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <label style="flex: 1; font-size: 12px; color: var(--text-main);">Opacity</label>
        <div style="display:flex; gap:4px; align-items:center; flex:1.5;">
          <input type="range" id="insp-topac-slider" min="0" max="1" step="0.01" value="${t.opacity}" style="width: 100%; accent-color: var(--accent-amber);">
          <input type="number" id="insp-topac" value="${t.opacity}" step="0.01" style="width: 50px; background: var(--bg-deep); border: 1px solid var(--border-light); color: var(--text-main); padding: 4px; border-radius: 2px; font-family: var(--font-ui); font-variant-numeric: tabular-nums;">
        </div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <button id="insp-treset" class="accent-btn" style="width:100%; padding:4px;">Reset Transform</button>
      </div>
    `;
    this.content.appendChild(sec);

    const update = () => {
      const x = parseFloat(document.getElementById('insp-tx').value) || 0;
      const y = parseFloat(document.getElementById('insp-ty').value) || 0;
      const scale = parseFloat(document.getElementById('insp-tscale').value) || 1;
      const rotation = parseFloat(document.getElementById('insp-trot').value) || 0;
      const opacity = parseFloat(document.getElementById('insp-topac').value) || 0;
      store.dispatch(CmdUpdateClipTransform(clip.id, { x, y, scale, rotation, opacity }));
    };

    const txInp = document.getElementById('insp-tx');
    const tyInp = document.getElementById('insp-ty');
    const tscaleInp = document.getElementById('insp-tscale');
    const trotInp = document.getElementById('insp-trot');
    const opacInp = document.getElementById('insp-topac');

    txInp.addEventListener('change', update);
    tyInp.addEventListener('change', update);
    tscaleInp.addEventListener('change', update);
    trotInp.addEventListener('change', update);

    setupDragScrub(txInp, update, { step: 1 });
    setupDragScrub(tyInp, update, { step: 1 });
    setupDragScrub(tscaleInp, update, { step: 0.01 });
    setupDragScrub(trotInp, update, { step: 1 });
    setupDragScrub(opacInp, (val) => {
        document.getElementById('insp-topac-slider').value = val;
        update();
    }, { step: 0.01, min: 0, max: 1 });

    const opacSlider = document.getElementById('insp-topac-slider');

    opacInp.addEventListener('change', () => {
      opacSlider.value = opacInp.value;
      update();
    });
    opacSlider.addEventListener('input', () => {
      opacInp.value = opacSlider.value;
      // Realtime update via direct DOM event for scrub
      update();
    });

    document.getElementById('insp-treset').addEventListener('click', () => {
      store.dispatch(CmdUpdateClipTransform(clip.id, { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }));
    });
  }

  renderSpeedSection(clip) {
    const speed = clip.speed || 1;
    const sec = document.createElement('div');
    sec.style.cssText = "padding: 10px; border-bottom: 1px solid var(--border-light);";
    sec.innerHTML = `
      <h4 style="font-size: 12px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; letter-spacing: 0.5px;">Speed</h4>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <label style="flex: 1; font-size: 12px; color: var(--text-main);">Rate</label>
        <div style="display:flex; gap:4px; align-items:center; flex:1.5;">
          <input type="range" id="insp-speed-slider" min="0.25" max="4" step="0.01" value="${speed}" style="width: 100%; accent-color: var(--accent-amber);">
          <input type="number" id="insp-speed" value="${speed}" step="0.01" style="width: 50px; background: var(--bg-deep); border: 1px solid var(--border-light); color: var(--text-main); padding: 4px; border-radius: 2px; font-family: var(--font-ui); font-variant-numeric: tabular-nums;">
        </div>
      </div>
    `;
    this.content.appendChild(sec);

    const update = (val) => {
      let s = parseFloat(val);
      if (isNaN(s) || s <= 0) s = 1;
      store.dispatch(CmdUpdateClipSpeed(clip.id, s));
    };

    const sInp = document.getElementById('insp-speed');
    const sSlider = document.getElementById('insp-speed-slider');

    setupDragScrub(sInp, (val) => {
        sSlider.value = val;
        update(val);
    }, { step: 0.01, min: 0.25, max: 4 });

    sInp.addEventListener('change', () => {
      sSlider.value = sInp.value;
      update(sInp.value);
    });
    sSlider.addEventListener('change', () => {
      sInp.value = sSlider.value;
      update(sSlider.value);
    });
  }

  renderAudioSection(clip) {
    const audio = clip.audio || { volume: 0, fadeIn: 0, fadeOut: 0 };
    const sec = document.createElement('div');
    sec.style.cssText = "padding: 10px; border-bottom: 1px solid var(--border-light);";
    sec.innerHTML = `
      <h4 style="font-size: 12px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; letter-spacing: 0.5px;">Audio</h4>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <label style="flex: 1; font-size: 12px; color: var(--text-main);">Volume (dB)</label>
        <div style="display:flex; gap:4px; align-items:center; flex:1.5;">
          <input type="range" id="insp-vol-slider" min="-60" max="12" step="1" value="${audio.volume}" style="width: 100%; accent-color: var(--accent-amber);">
          <input type="number" id="insp-vol" value="${audio.volume}" step="1" style="width: 50px; background: var(--bg-deep); border: 1px solid var(--border-light); color: var(--text-main); padding: 4px; border-radius: 2px; font-family: var(--font-ui); font-variant-numeric: tabular-nums;">
        </div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <label style="flex: 1; font-size: 12px; color: var(--text-main);">Fade In (s)</label>
        <input type="number" id="insp-fadein" value="${audio.fadeIn}" step="0.1" min="0" style="flex: 1.5; background: var(--bg-deep); border: 1px solid var(--border-light); color: var(--text-main); padding: 4px; border-radius: 2px; font-family: var(--font-ui); font-variant-numeric: tabular-nums; width: 100%;">
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <label style="flex: 1; font-size: 12px; color: var(--text-main);">Fade Out (s)</label>
        <input type="number" id="insp-fadeout" value="${audio.fadeOut}" step="0.1" min="0" style="flex: 1.5; background: var(--bg-deep); border: 1px solid var(--border-light); color: var(--text-main); padding: 4px; border-radius: 2px; font-family: var(--font-ui); font-variant-numeric: tabular-nums; width: 100%;">
      </div>
    `;
    this.content.appendChild(sec);

    const update = () => {
      const volume = parseFloat(document.getElementById('insp-vol').value) || 0;
      const fadeIn = parseFloat(document.getElementById('insp-fadein').value) || 0;
      const fadeOut = parseFloat(document.getElementById('insp-fadeout').value) || 0;
      store.dispatch(CmdUpdateClipAudio(clip.id, { volume, fadeIn, fadeOut }));
    };

    const vInp = document.getElementById('insp-vol');
    const vSlider = document.getElementById('insp-vol-slider');
    const fadeInp = document.getElementById('insp-fadein');
    const fadeOutInp = document.getElementById('insp-fadeout');

    setupDragScrub(vInp, (val) => {
        vSlider.value = val;
        update();
    }, { step: 1, min: -60, max: 12 });
    setupDragScrub(fadeInp, update, { step: 0.1, min: 0 });
    setupDragScrub(fadeOutInp, update, { step: 0.1, min: 0 });

    vInp.addEventListener('change', () => {
      vSlider.value = vInp.value;
      update();
    });
    vSlider.addEventListener('input', () => {
      vInp.value = vSlider.value;
      update(); // Live update
    });

    fadeInp.addEventListener('change', update);
    fadeOutInp.addEventListener('change', update);
  }

  renderProjectSettings() {
    const { project } = store.state;
    this.content.innerHTML = `
      <div style="padding: 10px; border-bottom: 1px solid var(--border-light);">
        <h4 style="font-size: 12px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; letter-spacing: 0.5px;">Project Settings</h4>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <label style="flex: 1; font-size: 12px; color: var(--text-main);">Name</label>
          <input type="text" id="insp-proj-name" value="${project.name}" style="flex: 1.5; background: var(--bg-deep); border: 1px solid var(--border-light); color: var(--text-main); padding: 4px; border-radius: 2px; font-family: var(--font-ui); font-variant-numeric: tabular-nums; width: 100%;">
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <label style="flex: 1; font-size: 12px; color: var(--text-main);">Preset</label>
          <select id="insp-proj-preset" style="flex: 1.5; background: var(--bg-deep); border: 1px solid var(--border-light); color: var(--text-main); padding: 4px; border-radius: 2px; font-family: var(--font-ui); width: 100%;">
            <option value="custom">Custom</option>
            <option value="1920x1080" ${project.width === 1920 && project.height === 1080 ? 'selected' : ''}>1080p (1920x1080)</option>
            <option value="1280x720" ${project.width === 1280 && project.height === 720 ? 'selected' : ''}>720p (1280x720)</option>
            <option value="3840x2160" ${project.width === 3840 && project.height === 2160 ? 'selected' : ''}>4K UHD (3840x2160)</option>
            <option value="1080x1920" ${project.width === 1080 && project.height === 1920 ? 'selected' : ''}>Vertical (1080x1920)</option>
            <option value="1080x1080" ${project.width === 1080 && project.height === 1080 ? 'selected' : ''}>Square (1080x1080)</option>
          </select>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <label style="flex: 1; font-size: 12px; color: var(--text-main);">Width</label>
          <input type="number" id="insp-proj-width" value="${project.width}" style="flex: 1.5; background: var(--bg-deep); border: 1px solid var(--border-light); color: var(--text-main); padding: 4px; border-radius: 2px; font-family: var(--font-ui); font-variant-numeric: tabular-nums; width: 100%;">
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <label style="flex: 1; font-size: 12px; color: var(--text-main);">Height</label>
          <input type="number" id="insp-proj-height" value="${project.height}" style="flex: 1.5; background: var(--bg-deep); border: 1px solid var(--border-light); color: var(--text-main); padding: 4px; border-radius: 2px; font-family: var(--font-ui); font-variant-numeric: tabular-nums; width: 100%;">
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <label style="flex: 1; font-size: 12px; color: var(--text-main);">FPS</label>
          <input type="number" id="insp-proj-fps" value="${project.fps}" style="flex: 1.5; background: var(--bg-deep); border: 1px solid var(--border-light); color: var(--text-main); padding: 4px; border-radius: 2px; font-family: var(--font-ui); font-variant-numeric: tabular-nums; width: 100%;">
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <label style="flex: 1; font-size: 12px; color: var(--text-main);">Background</label>
          <input type="color" id="insp-proj-bg" value="${project.bgColor || '#000000'}" style="flex: 1.5; background: transparent; border: none; height: 24px; padding: 0; cursor: pointer;">
        </div>
      </div>
    `;

    const updateProj = () => {
      const name = document.getElementById('insp-proj-name').value;
      const width = parseInt(document.getElementById('insp-proj-width').value) || 1920;
      const height = parseInt(document.getElementById('insp-proj-height').value) || 1080;
      const fps = parseInt(document.getElementById('insp-proj-fps').value) || 30;
      const bgColor = document.getElementById('insp-proj-bg').value;
      store.dispatch(CmdUpdateProjectSettings({ name, width, height, fps, bgColor }));
    };

    document.getElementById('insp-proj-name').addEventListener('change', updateProj);

    const wInp = document.getElementById('insp-proj-width');
    const hInp = document.getElementById('insp-proj-height');
    const fpsInp = document.getElementById('insp-proj-fps');

    wInp.addEventListener('change', updateProj);
    hInp.addEventListener('change', updateProj);
    fpsInp.addEventListener('change', updateProj);

    setupDragScrub(wInp, updateProj, { step: 1, min: 1 });
    setupDragScrub(hInp, updateProj, { step: 1, min: 1 });
    setupDragScrub(fpsInp, updateProj, { step: 1, min: 1, max: 240 });

    document.getElementById('insp-proj-bg').addEventListener('change', updateProj);

    document.getElementById('insp-proj-preset').addEventListener('change', (e) => {
       const val = e.target.value;
       if (val !== 'custom') {
          const [w, h] = val.split('x').map(Number);
          wInp.value = w;
          hInp.value = h;
          updateProj();
       }
    });
  }
}
