export const shapes = [
  {
    id: 'shape-rect',
    name: 'Rectangle',
    type: 'rect',
    width: 200,
    height: 100,
    fill: '#F59E2D',
    shadow: { color: 'rgba(0,0,0,0.5)', blur: 10, offsetX: 0, offsetY: 4 }
  },
  {
    id: 'shape-roundrect',
    name: 'Rounded Rect',
    type: 'roundrect',
    width: 200,
    height: 100,
    radius: 16,
    fill: '#26292E',
    stroke: '#F59E2D',
    strokeWidth: 4
  },
  {
    id: 'shape-circle',
    name: 'Circle',
    type: 'circle',
    radius: 80,
    fill: '#ECEAE6',
    stroke: '#141518',
    strokeWidth: 4
  },
  {
    id: 'sticker-star',
    name: 'Star Sticker',
    type: 'svg',
    width: 100,
    height: 100,
    content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#F59E2D"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'
  },
  {
    id: 'sticker-heart',
    name: 'Heart Sticker',
    type: 'svg',
    width: 100,
    height: 100,
    content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#E48A1B"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>'
  },
  {
    id: 'sticker-arrow',
    name: 'Arrow Sticker',
    type: 'svg',
    width: 100,
    height: 100,
    content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ECEAE6"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>'
  },
  {
    id: 'sticker-smile',
    name: 'Smile Sticker',
    type: 'svg',
    width: 100,
    height: 100,
    content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#F59E2D"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5c-1.8 0-3.35-1.1-4.04-2.65l1.62-.77c.43 1 1.42 1.72 2.42 1.72s1.99-.72 2.42-1.72l1.62.77c-.69 1.55-2.24 2.65-4.04 2.65zm1-6c-.83 0-1.5-.67-1.5-1.5S10.17 7.5 11 7.5s1.5.67 1.5 1.5S11.83 10.5 11 10.5zm4 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>'
  },
  {
    id: 'sticker-speech',
    name: 'Speech Bubble',
    type: 'svg',
    width: 120,
    height: 100,
    content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#26292E" stroke="#A0A5AD" stroke-width="1"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4v5l5-5h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>'
  },
  {
    id: 'sticker-check',
    name: 'Checkmark',
    type: 'svg',
    width: 100,
    height: 100,
    content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ECEAE6"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
  },
  {
    id: 'sticker-warning',
    name: 'Warning Triangle',
    type: 'svg',
    width: 100,
    height: 100,
    content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#F59E2D"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>'
  },
  {
    id: 'sticker-lightning',
    name: 'Lightning Bolt',
    type: 'svg',
    width: 100,
    height: 100,
    content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#F59E2D"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>'
  },
  {
    id: 'sticker-play',
    name: 'Play Button',
    type: 'svg',
    width: 100,
    height: 100,
    content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ECEAE6"><path d="M8 5v14l11-7z"/></svg>'
  },
  {
    id: 'sticker-camera',
    name: 'Camera',
    type: 'svg',
    width: 100,
    height: 100,
    content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#A0A5AD"><circle cx="12" cy="12" r="3.2"/><path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>'
  },
  {
    id: 'sticker-pin',
    name: 'Location Pin',
    type: 'svg',
    width: 100,
    height: 100,
    content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#F59E2D"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>'
  },
  {
    id: 'sticker-cursor',
    name: 'Mouse Cursor',
    type: 'svg',
    width: 100,
    height: 100,
    content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ECEAE6"><path d="M7 2l12 11.2-5.8.5 3.3 7.3-2.2.9-3.2-7.4-4.4 4.7z"/></svg>'
  },
  {
    id: 'sticker-flame',
    name: 'Flame',
    type: 'svg',
    width: 100,
    height: 100,
    content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#F59E2D"><path d="M12 2c0 0-4.5 4.5-4.5 9.5 0 2.2 1.3 4 3 4.6-.3-.7-.5-1.4-.5-2.1 0-2.8 2-4.5 2-4.5s.5 2.5 3 4c1-1 1.5-2.5 1.5-4C16.5 6.5 12 2 12 2z"/></svg>'
  },
  {
    id: 'sticker-sun',
    name: 'Sun',
    type: 'svg',
    width: 100,
    height: 100,
    content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#E48A1B"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3zm1-13h-2v3h2V2zm0 17h-2v3h2v-3zm9-8h-3v-2h3v2zm-17 0H2v-2h3v2zm12.36-6.64l1.41-1.41 2.12 2.12-1.41 1.41-2.12-2.12zM5.64 18.36l1.41-1.41 2.12 2.12-1.41 1.41-2.12-2.12zm12.72 2.12l-1.41 1.41-2.12-2.12 1.41-1.41 2.12 2.12zM5.64 5.64l2.12 2.12-1.41 1.41-2.12-2.12 1.41-1.41z"/></svg>'
  },
  {
    id: 'sticker-moon',
    name: 'Moon',
    type: 'svg',
    width: 100,
    height: 100,
    content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#A0A5AD"><path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>'
  },
  {
    id: 'sticker-cloud',
    name: 'Cloud',
    type: 'svg',
    width: 120,
    height: 100,
    content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ECEAE6"><path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>'
  },
  {
    id: 'sticker-music',
    name: 'Music Note',
    type: 'svg',
    width: 100,
    height: 100,
    content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#F59E2D"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>'
  },
  {
    id: 'sticker-gift',
    name: 'Gift Box',
    type: 'svg',
    width: 100,
    height: 100,
    content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#E48A1B"><path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z"/></svg>'
  },
  {
    id: 'sticker-bell',
    name: 'Bell Notification',
    type: 'svg',
    width: 100,
    height: 100,
    content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#F59E2D"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/></svg>'
  },
  {
    id: 'sticker-crown',
    name: 'Crown',
    type: 'svg',
    width: 120,
    height: 100,
    content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#E48A1B"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/></svg>'
  },
  {
    id: 'sticker-lock',
    name: 'Lock',
    type: 'svg',
    width: 100,
    height: 100,
    content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ECEAE6"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg>'
  },
  {
    id: 'sticker-key',
    name: 'Key',
    type: 'svg',
    width: 100,
    height: 100,
    content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#F59E2D"><path d="M12.65 10A5.99 5.99 0 0 0 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6a5.99 5.99 0 0 0 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>'
  },
  {
    id: 'sticker-search',
    name: 'Search',
    type: 'svg',
    width: 100,
    height: 100,
    content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#A0A5AD"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>'
  },
  {
    id: 'sticker-thumb',
    name: 'Thumbs Up',
    type: 'svg',
    width: 100,
    height: 100,
    content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ECEAE6"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>'
  },
  {
    id: 'sticker-eye',
    name: 'Eye',
    type: 'svg',
    width: 100,
    height: 100,
    content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#F59E2D"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>'
  },
  {
    id: 'sticker-send',
    name: 'Send Arrow',
    type: 'svg',
    width: 100,
    height: 100,
    content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#E48A1B"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>'
  },
  {
    id: 'sticker-mail',
    name: 'Mail',
    type: 'svg',
    width: 100,
    height: 100,
    content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#A0A5AD"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>'
  }
];