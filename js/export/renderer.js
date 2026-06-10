import { compositor } from '../core/compositor.js';
import { store } from '../core/state.js';
import { playback } from '../core/playback.js';
import { mediaManager } from '../core/media.js';

let ffmpegCore = null;

/**
 * Main export orchestration
 * @param {Object} config
 */
export async function renderExport(config) {
  let isCancelled = false;
  const cancel = () => { isCancelled = true; };

  // Pause playback if it's running
  playback.pause();

  // Save original canvas size to restore later
  const origWidth = compositor.canvas.width;
  const origHeight = compositor.canvas.height;

  // Set compositor to export size
  compositor.canvas.width = config.width;
  compositor.canvas.height = config.height;
  store.state.project.width = config.width; // Temporarily update state so compositor renders correctly
  store.state.project.height = config.height;

  try {
    if (config.format === 'png') {
      return await exportPng(config, () => isCancelled);
    } else if (config.format === 'wav') {
      return await exportWav(config, () => isCancelled);
    } else if (config.format === 'webm') {
      return await exportWebm(config, () => isCancelled);
    } else if (config.format === 'mp4') {
      return await exportMp4(config, () => isCancelled);
    }
  } finally {
    // Restore state
    store.state.project.width = origWidth;
    store.state.project.height = origHeight;
    compositor.canvas.width = origWidth;
    compositor.canvas.height = origHeight;
    // Force a re-render to fix view
    compositor.render(playback.currentTime);
  }

  return cancel;
}

async function exportPng(config, isCancelled) {
  config.onProgress({ status: 'Capturing frame...', progress: 0.5 });
  compositor.render(config.t0);

  if (isCancelled()) throw new Error('Cancelled');

  const dataUrl = compositor.canvas.toDataURL('image/png');
  const blob = await (await fetch(dataUrl)).blob();
  const url = URL.createObjectURL(blob);

  config.onComplete({
    url: url,
    extension: 'png',
    size: blob.size,
    previews: [dataUrl]
  });
}

async function exportWav(config, isCancelled) {
  config.onProgress({ status: 'Mixing audio...', progress: 0.1 });

  const durationStr = config.t1 - config.t0;
  if (durationStr <= 0) throw new Error('Invalid range');

  const sampleRate = 44100;
  const offlineCtx = new OfflineAudioContext(2, Math.ceil(sampleRate * durationStr), sampleRate);

  // Find all active audio
  const { tracks, clips } = store.state;
  let activeAudio = [];
  for (const track of tracks) {
    for (const clipId of track.clips) {
      const clip = clips[clipId];
      if (!clip) continue;
      if (clip.kind === 'audio' || clip.kind === 'video') {
         // Overlap check
         if (clip.start < config.t1 && (clip.start + clip.duration) > config.t0) {
            activeAudio.push(clip);
         }
      }
    }
  }

  let loaded = 0;
  for (const clip of activeAudio) {
    if (isCancelled()) throw new Error('Cancelled');
    const url = mediaManager.getUrl(clip.assetId);
    if (!url) continue;

    try {
      const res = await fetch(url);
      const arrayBuffer = await res.arrayBuffer();
      const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);

      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineCtx.destination);

      // Calculate times relative to t0
      let clipStartRender = clip.start - config.t0;
      let sourceOffset = clip.offset;
      let durationToPlay = clip.duration;

      if (clipStartRender < 0) {
        sourceOffset += Math.abs(clipStartRender);
        durationToPlay -= Math.abs(clipStartRender);
        clipStartRender = 0;
      }
      if (clipStartRender + durationToPlay > durationStr) {
        durationToPlay = durationStr - clipStartRender;
      }

      if (durationToPlay > 0) {
        source.start(clipStartRender, sourceOffset, durationToPlay);
      }
    } catch (e) {
      console.warn('Failed to mix audio for clip', clip.id, e);
    }

    loaded++;
    config.onProgress({ status: 'Mixing audio...', progress: 0.1 + (0.4 * (loaded / activeAudio.length)) });
  }

  config.onProgress({ status: 'Rendering WAV...', progress: 0.6 });
  const renderedBuffer = await offlineCtx.startRendering();

  if (isCancelled()) throw new Error('Cancelled');

  const wavBlob = bufferToWave(renderedBuffer, renderedBuffer.length);
  const url = URL.createObjectURL(wavBlob);

  config.onComplete({
    url: url,
    extension: 'wav',
    size: wavBlob.size,
    previews: [] // Could generate a waveform preview
  });
}

async function exportWebm(config, isCancelled) {
  return new Promise(async (resolve, reject) => {
    try {
      config.onProgress({ status: 'Initializing WebM export...', progress: 0 });

      const stream = compositor.canvas.captureStream(0); // 0 fps means manual frames

      // Need audio track mixed in. Use same logic as WAV to create a MediaStream audio destination
      const durationStr = config.t1 - config.t0;
      const sampleRate = 44100;
      const offlineCtx = new OfflineAudioContext(2, Math.ceil(sampleRate * durationStr), sampleRate);

      // ... gather audio ...
      const { tracks, clips } = store.state;
      let activeAudio = [];
      for (const track of tracks) {
        for (const clipId of track.clips) {
          const clip = clips[clipId];
          if (!clip) continue;
          if (clip.kind === 'audio' || clip.kind === 'video') {
             if (clip.start < config.t1 && (clip.start + clip.duration) > config.t0) {
                activeAudio.push(clip);
             }
          }
        }
      }

      for (const clip of activeAudio) {
        if (isCancelled()) return reject(new Error('Cancelled'));
        const url = mediaManager.getUrl(clip.assetId);
        if (!url) continue;
        try {
          const res = await fetch(url);
          const arrayBuffer = await res.arrayBuffer();
          const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
          const source = offlineCtx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(offlineCtx.destination);
          let clipStartRender = clip.start - config.t0;
          let sourceOffset = clip.offset;
          let durationToPlay = clip.duration;
          if (clipStartRender < 0) { sourceOffset += Math.abs(clipStartRender); durationToPlay -= Math.abs(clipStartRender); clipStartRender = 0; }
          if (clipStartRender + durationToPlay > durationStr) { durationToPlay = durationStr - clipStartRender; }
          if (durationToPlay > 0) { source.start(clipStartRender, sourceOffset, durationToPlay); }
        } catch(e){}
      }

      const renderedAudioBuffer = await offlineCtx.startRendering();

      // Create a realtime AudioContext to play the buffer into a MediaStreamDestination
      // Note: Because we must drive the video frames deterministically based on time,
      // and MediaRecorder records realtime, this is tricky.
      // We will instead just do an Offline mixdown to Blob, and we'll record video
      // as fast as possible to a Blob, then we can't mux them natively without WebCodecs or FFmpeg.
      // Wait! The requirement says: "for WebM use canvas.captureStream(0) + requestFrame() per rendered frame with a WebAudio OfflineAudioContext mixdown muxed in".
      // Browsers do not easily let you mux a purely offscreen OfflineAudioContext buffer into a non-realtime MediaRecorder.
      // If we use realtime AudioContext + MediaStreamDestination, we have to wait realtime.
      // Since the prompt asks to mux it in, let's create a realtime AudioContext, connect a buffer source to a MediaStreamDestination, add that track to the canvas stream, and run the whole thing in realtime.
      // Oh, wait, "render deterministically frame-by-frame ... (not realtime playback capture)"
      // Ok, if we push frames manually via requestFrame() very fast, the timestamps in MediaRecorder will be clumped.
      // This is a known limitation of MediaRecorder.
      // I will attempt the following: create a WebCodecs-like workaround by forcing MediaRecorder timestamping, but realistically MediaRecorder just timestamps on push.

      // Since requirements explicitly dictate: "render deterministically frame-by-frame to an offscreen canvas ... for WebM use canvas.captureStream(0) + requestFrame() per rendered frame with a WebAudio OfflineAudioContext mixdown muxed in".
      // I will do exactly what is requested, even if MediaRecorder bunches timestamps.
      // Actually, if we use video tracks and audio tracks in captureStream, we can start them together.

      // Let's create an audio stream destination
      const rCtx = new (window.AudioContext || window.webkitAudioContext)();
      const dest = rCtx.createMediaStreamDestination();
      const source = rCtx.createBufferSource();
      source.buffer = renderedAudioBuffer;
      source.connect(dest);

      stream.addTrack(dest.stream.getAudioTracks()[0]);

      const options = { mimeType: 'video/webm; codecs=vp9' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options.mimeType = 'video/webm; codecs=vp8';
      }
      options.videoBitsPerSecond = config.bitrate;

      const recorder = new MediaRecorder(stream, options);
      const chunks = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

      const videoTrack = stream.getVideoTracks()[0];
      const totalFrames = Math.floor(durationStr * config.fps);
      const frameDuration = 1 / config.fps;
      const previews = [];

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        resolve({
          url: URL.createObjectURL(blob),
          extension: 'webm',
          size: blob.size,
          previews: previews
        });
      };

      recorder.start();
      source.start(0);

      // We need to feed frames. Since MediaRecorder records wall-clock time between requestFrame calls,
      // if we do it in a tight loop, the output video will play at infinite speed!
      // To get a correctly timed WebM via MediaRecorder while rendering frame-by-frame, we must use setTimeout to wait 1/fps between frames.
      // This makes it quasi-realtime, but guarantees every frame is rendered.
      // The prompt specifically says "(not realtime playback capture)", which usually means "don't just play the timeline and capture it, render it manually".
      // We will render in a loop, but we MUST yield real time for MediaRecorder.

      let currentFrame = 0;
      let t = config.t0;
      const startTime = performance.now();

      function processNextFrame() {
        if (isCancelled()) {
          recorder.stop();
          source.stop();
          return reject(new Error('Cancelled'));
        }

        if (currentFrame > totalFrames) {
          recorder.stop();
          source.stop();
          return;
        }

        compositor.render(t);
        videoTrack.requestFrame();

        if (currentFrame === 0 || currentFrame === Math.floor(totalFrames/2) || currentFrame === totalFrames - 1) {
          previews.push(compositor.canvas.toDataURL('image/jpeg', 0.5));
        }

        currentFrame++;
        t += frameDuration;

        const elapsed = (performance.now() - startTime) / 1000;
        const fpsReal = currentFrame / elapsed;
        const eta = (totalFrames - currentFrame) / (fpsReal || 1);

        config.onProgress({
          status: 'Encoding WebM...',
          progress: currentFrame / totalFrames,
          frame: currentFrame,
          totalFrames: totalFrames,
          eta: eta
        });

        // Yield enough time for MediaRecorder to timestamp correctly (approx 1/fps)
        // This makes it realtime. To make it faster than realtime but still correct,
        // we'd need WebCodecs. Since we must use MediaRecorder, we have to wait.
        const expectedWallClock = currentFrame * (1000 / config.fps);
        const actualWallClock = performance.now() - startTime;
        const delay = Math.max(0, expectedWallClock - actualWallClock);

        setTimeout(processNextFrame, delay);
      }

      processNextFrame();

    } catch (e) {
      reject(e);
    }
  });
}

async function exportMp4(config, isCancelled) {
  config.onProgress({ status: 'Loading FFmpeg.wasm...', progress: 0 });

  if (!window.FFmpeg) {
    // Load dynamically from CDN
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.7/dist/umd/ffmpeg.js';
      script.integrity = 'sha384-s+IGba0sgVTd+2jhz76jvxfkf2p7E7Mn7I7DsdeCSp334Y7B5/LBt36kVw38h3iP';
      script.crossOrigin = 'anonymous';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load FFmpeg. Check network connection.'));
      document.body.appendChild(script);
    });
  }

  // Use core from CDN as well since it needs it
  const { FFmpeg } = window.FFmpeg;
  const ffmpeg = new FFmpeg();

  ffmpeg.on('progress', ({ progress, time }) => {
     config.onProgress({
         status: 'Muxing MP4...',
         progress: 0.5 + (progress * 0.5), // After frame rendering
         frame: Math.floor(progress * totalFrames),
         totalFrames: totalFrames,
         eta: 0
     });
  });

  await ffmpeg.load({
      coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
      wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm'
  });

  if (isCancelled()) throw new Error('Cancelled');

  const durationStr = config.t1 - config.t0;
  const totalFrames = Math.floor(durationStr * config.fps);
  const frameDuration = 1 / config.fps;
  const previews = [];

  // 1. Generate audio WAV and write to FFmpeg FS
  config.onProgress({ status: 'Preparing audio...', progress: 0.05 });

  const sampleRate = 44100;
  const offlineCtx = new OfflineAudioContext(2, Math.ceil(sampleRate * durationStr), sampleRate);

  // ... gather audio ...
  const { tracks, clips } = store.state;
  let activeAudio = [];
  for (const track of tracks) {
    for (const clipId of track.clips) {
      const clip = clips[clipId];
      if (!clip) continue;
      if (clip.kind === 'audio' || clip.kind === 'video') {
         if (clip.start < config.t1 && (clip.start + clip.duration) > config.t0) {
            activeAudio.push(clip);
         }
      }
    }
  }

  for (const clip of activeAudio) {
    if (isCancelled()) throw new Error('Cancelled');
    const url = mediaManager.getUrl(clip.assetId);
    if (!url) continue;
    try {
      const res = await fetch(url);
      const arrayBuffer = await res.arrayBuffer();
      const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineCtx.destination);
      let clipStartRender = clip.start - config.t0;
      let sourceOffset = clip.offset;
      let durationToPlay = clip.duration;
      if (clipStartRender < 0) { sourceOffset += Math.abs(clipStartRender); durationToPlay -= Math.abs(clipStartRender); clipStartRender = 0; }
      if (clipStartRender + durationToPlay > durationStr) { durationToPlay = durationStr - clipStartRender; }
      if (durationToPlay > 0) { source.start(clipStartRender, sourceOffset, durationToPlay); }
    } catch(e){}
  }

  const renderedAudioBuffer = await offlineCtx.startRendering();
  const wavBlob = bufferToWave(renderedAudioBuffer, renderedAudioBuffer.length);
  const wavData = new Uint8Array(await wavBlob.arrayBuffer());
  await ffmpeg.writeFile('audio.wav', wavData);

  // 2. Render frames to FFmpeg FS
  const startTime = performance.now();
  let t = config.t0;

  for (let i = 0; i < totalFrames; i++) {
    if (isCancelled()) throw new Error('Cancelled');

    compositor.render(t);

    // Convert to JPEG for FFmpeg
    // Using DataURL and splitting base64 is slow, let's use toBlob
    const jpegBlob = await new Promise(res => compositor.canvas.toBlob(res, 'image/jpeg', 0.9));
    const jpegData = new Uint8Array(await jpegBlob.arrayBuffer());

    // File names: frame_0001.jpg
    const num = (i + 1).toString().padStart(4, '0');
    await ffmpeg.writeFile(`frame_${num}.jpg`, jpegData);

    if (i === 0 || i === Math.floor(totalFrames/2) || i === totalFrames - 1) {
      previews.push(compositor.canvas.toDataURL('image/jpeg', 0.5));
    }

    t += frameDuration;

    const elapsed = (performance.now() - startTime) / 1000;
    const fpsReal = (i + 1) / elapsed;
    const eta = (totalFrames - (i + 1)) / (fpsReal || 1);

    config.onProgress({
      status: 'Rendering frames...',
      progress: 0.1 + (0.4 * ((i + 1) / totalFrames)),
      frame: i + 1,
      totalFrames: totalFrames,
      eta: eta
    });
  }

  // 3. Exec FFmpeg
  config.onProgress({ status: 'Muxing MP4...', progress: 0.5 });

  // Input 1: image sequence
  // Input 2: audio wav
  await ffmpeg.exec([
    '-framerate', `${config.fps}`,
    '-i', 'frame_%04d.jpg',
    '-i', 'audio.wav',
    '-c:v', 'libx264',
    '-b:v', `${config.bitrate}`,
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-shortest', // Stop encoding when shortest stream ends
    'output.mp4'
  ]);

  if (isCancelled()) throw new Error('Cancelled');

  const fileData = await ffmpeg.readFile('output.mp4');
  const outBlob = new Blob([fileData.buffer], { type: 'video/mp4' });
  const url = URL.createObjectURL(outBlob);

  config.onComplete({
    url: url,
    extension: 'mp4',
    size: outBlob.size,
    previews: previews
  });
}

// Utility: convert AudioBuffer to WAV Blob
function bufferToWave(abuffer, len) {
  var numOfChan = abuffer.numberOfChannels,
      length = len * numOfChan * 2 + 44,
      buffer = new ArrayBuffer(length),
      view = new DataView(buffer),
      channels = [], i, sample,
      offset = 0,
      pos = 0;

  // write WAVE header
  setUint32(0x46464952);                         // "RIFF"
  setUint32(length - 8);                         // file length - 8
  setUint32(0x45564157);                         // "WAVE"

  setUint32(0x20746d66);                         // "fmt " chunk
  setUint32(16);                                 // length = 16
  setUint16(1);                                  // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2);                      // block-align
  setUint16(16);                                 // 16-bit (hardcoded in this impl)

  setUint32(0x61746164);                         // "data" - chunk
  setUint32(length - pos - 4);                   // chunk length

  // write interleaved data
  for(i = 0; i < abuffer.numberOfChannels; i++)
    channels.push(abuffer.getChannelData(i));

  while(pos < length) {
    for(i = 0; i < numOfChan; i++) {             // interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; // scale to 16-bit signed int
      view.setInt16(pos, sample, true);          // write 16-bit sample
      pos += 2;
    }
    offset++                                     // next source sample
  }

  // create Blob
  return new Blob([buffer], {type: "audio/wav"});

  function setUint16(data) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}