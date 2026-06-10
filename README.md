# ClipForge

**ClipForge** is a serious, fully client-side, web-based video editor. Think CapCut-web or iMovie class, running entirely in the browser, deployable on GitHub Pages. No build step, no framework, just pure ES modules and vanilla JavaScript.

## Screenshots
*(Placeholder for screenshots)*

## Development & Running

ClipForge is a completely client-side application with zero build steps. To run it locally:

1. Clone the repository.
2. Serve the directory with any static web server. For example:
   ```bash
   python3 -m http.server 8000
   ```
3. Open `http://localhost:8000` in your browser.

## Roadmap
- [x] **Wave 1 (Current):** Core platform, visual identity, state management, media library, playback engine, compositor, undo/redo, autosave.
- [ ] **Wave 2:** Full Timeline UI (multitrack drag & drop, snapping, zooming).
- [ ] **Wave 3:** Advanced Inspector & Effects (filters, transitions, keyframes).
- [ ] **Wave 4:** Titles & Text Engine.
- [ ] **Wave 5:** Export Module (WebCodecs / MediaRecorder rendering).
