export function CmdUpdateClipTransform(clipId, newTransform) {
  let oldTransform;
  return {
    execute: (state) => {
      const clip = state.clips[clipId];
      if (!clip) return;
      oldTransform = JSON.parse(JSON.stringify(clip.transform || {}));
      clip.transform = { ...oldTransform, ...newTransform };
    },
    undo: (state) => {
      const clip = state.clips[clipId];
      if (!clip) return;
      clip.transform = oldTransform;
    }
  };
}

export function CmdUpdateClipEffects(clipId, newEffects) {
  let oldEffects;
  return {
    execute: (state) => {
      const clip = state.clips[clipId];
      if (!clip) return;
      oldEffects = JSON.parse(JSON.stringify(clip.effects || []));
      clip.effects = JSON.parse(JSON.stringify(newEffects));
    },
    undo: (state) => {
      const clip = state.clips[clipId];
      if (!clip) return;
      clip.effects = oldEffects;
    }
  };
}

export function CmdUpdateClipSpeed(clipId, newSpeed) {
  let oldSpeed, oldDuration;
  return {
    execute: (state) => {
      const clip = state.clips[clipId];
      if (!clip) return;
      oldSpeed = clip.speed || 1;
      oldDuration = clip.duration;
      clip.speed = newSpeed;
      // Duration scales inversely with speed. Assuming oldDuration was at oldSpeed.
      // E.g. base_duration = oldDuration * oldSpeed. new_duration = base_duration / newSpeed
      clip.duration = (oldDuration * oldSpeed) / newSpeed;
    },
    undo: (state) => {
      const clip = state.clips[clipId];
      if (!clip) return;
      clip.speed = oldSpeed;
      clip.duration = oldDuration;
    }
  };
}

export function CmdUpdateClipAudio(clipId, newAudio) {
  let oldAudio;
  return {
    execute: (state) => {
      const clip = state.clips[clipId];
      if (!clip) return;
      oldAudio = JSON.parse(JSON.stringify(clip.audio || { volume: 0, fadeIn: 0, fadeOut: 0 }));
      clip.audio = { ...oldAudio, ...newAudio };
    },
    undo: (state) => {
      const clip = state.clips[clipId];
      if (!clip) return;
      clip.audio = oldAudio;
    }
  };
}

export function CmdUpdateClipText(clipId, newText) {
  let oldText;
  return {
    execute: (state) => {
      const clip = state.clips[clipId];
      if (!clip) return;
      oldText = JSON.parse(JSON.stringify(clip.text || {}));
      clip.text = { ...oldText, ...newText };
    },
    undo: (state) => {
      const clip = state.clips[clipId];
      if (!clip) return;
      clip.text = oldText;
    }
  };
}

export function CmdUpdateProjectSettings(newSettings) {
  let oldSettings;
  return {
    execute: (state) => {
      oldSettings = {
        name: state.project.name,
        width: state.project.width,
        height: state.project.height,
        fps: state.project.fps,
        bgColor: state.project.bgColor || '#000000'
      };
      state.project = { ...state.project, ...newSettings };
    },
    undo: (state) => {
      state.project = { ...state.project, ...oldSettings };
    }
  };
}

export function CmdAddKeyframe(clipId, property, time, value) {
  let oldKeyframes;
  return {
    execute: (state) => {
      const clip = state.clips[clipId];
      if (!clip) return;
      if (!clip.keyframes) clip.keyframes = {};
      oldKeyframes = JSON.parse(JSON.stringify(clip.keyframes));
      if (!clip.keyframes[property]) clip.keyframes[property] = [];

      const kfs = clip.keyframes[property];
      const existingIdx = kfs.findIndex(kf => Math.abs(kf.time - time) < 0.01);
      if (existingIdx !== -1) {
         kfs[existingIdx].value = value;
      } else {
         kfs.push({ time, value });
         kfs.sort((a, b) => a.time - b.time);
      }
    },
    undo: (state) => {
      const clip = state.clips[clipId];
      if (!clip) return;
      clip.keyframes = oldKeyframes;
    }
  };
}

export function CmdRemoveKeyframe(clipId, property, time) {
  let oldKeyframes;
  return {
    execute: (state) => {
      const clip = state.clips[clipId];
      if (!clip) return;
      if (!clip.keyframes) clip.keyframes = {};
      oldKeyframes = JSON.parse(JSON.stringify(clip.keyframes));

      if (clip.keyframes[property]) {
         clip.keyframes[property] = clip.keyframes[property].filter(kf => Math.abs(kf.time - time) >= 0.01);
      }
    },
    undo: (state) => {
      const clip = state.clips[clipId];
      if (!clip) return;
      clip.keyframes = oldKeyframes;
    }
  };
}
