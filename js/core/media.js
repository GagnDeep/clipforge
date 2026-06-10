import { bus } from './bus.js';
import { store, CmdAddAsset } from './state.js';

class MediaManager {
  constructor() {
    this.sessionBlobs = {}; // Map of assetId -> object URL
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  /**
   * Import a File object
   * @param {File} file
   */
  async importFile(file) {
    const kind = this.determineKind(file.type);
    if (!kind) {
      console.warn('Unsupported file type:', file.type);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const assetId = 'asset_' + Math.random().toString(36).substring(2, 9);

    this.sessionBlobs[assetId] = objectUrl;

    const assetData = {
      id: assetId,
      name: file.name,
      kind: kind,
      duration: 0,
      width: 0,
      height: 0,
      thumbnailUrl: null, // Session only
      fingerprint: `${file.name}-${file.size}-${file.lastModified}`
    };

    // Extract metadata
    try {
      if (kind === 'video') {
        const meta = await this.extractVideoMetadata(objectUrl);
        assetData.duration = meta.duration;
        assetData.width = meta.width;
        assetData.height = meta.height;
        assetData.thumbnailUrl = meta.thumbnailUrl;
      } else if (kind === 'image') {
        const meta = await this.extractImageMetadata(objectUrl);
        assetData.duration = 5; // Default image duration
        assetData.width = meta.width;
        assetData.height = meta.height;
        assetData.thumbnailUrl = meta.thumbnailUrl;
      } else if (kind === 'audio') {
        const meta = await this.extractAudioMetadata(file);
        assetData.duration = meta.duration;
        // Optional: store peaks data for waveform drawing
        assetData.peaks = meta.peaks;
        // Generate a generic audio icon thumbnail
        assetData.thumbnailUrl = this.generateAudioThumbnail();
      }

      store.dispatch(CmdAddAsset(assetData));
      bus.emit('media:imported', assetData);

    } catch (e) {
      console.error('Failed to process media file:', e);
      URL.revokeObjectURL(objectUrl);
      delete this.sessionBlobs[assetId];
    }
  }

  determineKind(mimeType) {
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('image/')) return 'image';
    return null;
  }

  extractVideoMetadata(url) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.src = url;
      video.muted = true;
      video.playsInline = true;

      video.onloadedmetadata = () => {
        // Seek to 0.1s to grab a frame
        video.currentTime = Math.min(0.1, video.duration / 2);
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 90;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        resolve({
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          thumbnailUrl: canvas.toDataURL('image/jpeg', 0.7)
        });
      };

      video.onerror = () => reject(new Error('Failed to load video metadata'));
    });
  }

  extractImageMetadata(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 90;
        const ctx = canvas.getContext('2d');

        // Letterbox the image into the thumbnail
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const x = (canvas.width / 2) - (img.width / 2) * scale;
        const y = (canvas.height / 2) - (img.height / 2) * scale;

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

        resolve({
          width: img.width,
          height: img.height,
          thumbnailUrl: canvas.toDataURL('image/jpeg', 0.7)
        });
      };
      img.onerror = () => reject(new Error('Failed to load image metadata'));
      img.src = url;
    });
  }

  async extractAudioMetadata(file) {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

    // Extract a low-res peak array for waveform drawing
    const channelData = audioBuffer.getChannelData(0);
    const peaks = [];
    const step = Math.ceil(channelData.length / 100);
    for (let i = 0; i < 100; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = channelData[(i * step) + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      peaks.push([min, max]);
    }

    return {
      duration: audioBuffer.duration,
      peaks: peaks
    };
  }

  generateAudioThumbnail() {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1C1E22';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#F59E2D';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 160; i += 10) {
      const h = Math.random() * 40 + 10;
      ctx.moveTo(i, 45 - h/2);
      ctx.lineTo(i, 45 + h/2);
    }
    ctx.stroke();

    return canvas.toDataURL('image/jpeg', 0.7);
  }

  /**
   * Get the object URL for an asset
   */
  getUrl(assetId) {
    return this.sessionBlobs[assetId];
  }

  /**
   * Used when loading a project from JSON where assets need to be relinked
   */
  relinkAsset(assetId, file) {
    const objectUrl = URL.createObjectURL(file);
    this.sessionBlobs[assetId] = objectUrl;

    // Generate new thumbnail
    const asset = store.state.assets[assetId];
    if (asset) {
       if (asset.kind === 'video') {
           this.extractVideoMetadata(objectUrl).then(meta => {
               asset.thumbnailUrl = meta.thumbnailUrl;
               bus.emit('state:changed', store.state);
           });
       } else if (asset.kind === 'image') {
           this.extractImageMetadata(objectUrl).then(meta => {
               asset.thumbnailUrl = meta.thumbnailUrl;
               bus.emit('state:changed', store.state);
           });
       } else if (asset.kind === 'audio') {
           asset.thumbnailUrl = this.generateAudioThumbnail();
           bus.emit('state:changed', store.state);
       }
    }
  }
}

export const mediaManager = new MediaManager();
