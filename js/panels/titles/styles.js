const styles = `
/* Left Panel (Tabs & Content) */
.left-panel-container {
  grid-area: library;
  border-right: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
}
.panel-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-light);
  background-color: var(--bg-panel);
}
.tab-btn {
  flex: 1;
  background: none;
  border: none;
  color: var(--text-muted);
  font-family: var(--font-ui);
  padding: 10px 0;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.2s, border-color 0.2s;
}
.tab-btn:hover {
  color: var(--text-main);
}
.tab-btn.active {
  color: var(--accent-amber);
  border-bottom: 2px solid var(--accent-amber);
}
.tab-content {
  display: none;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}
.tab-content.active {
  display: flex;
}

/* Titles & Shapes */
.presets-grid {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
  align-content: start;
}
.preset-card {
  background-color: var(--bg-elevated);
  border: 1px solid var(--border-light);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  overflow: hidden;
  position: relative;
  transition: border-color 0.2s;
  height: 80px;
  align-items: center;
  justify-content: center;
}
.preset-card:hover {
  border-color: var(--accent-amber);
}
.preset-name {
  position: absolute;
  bottom: 0;
  width: 100%;
  background: rgba(20, 21, 24, 0.8);
  font-size: 11px;
  text-align: center;
  padding: 2px 0;
  color: var(--text-muted);
}
.preset-preview-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
`;

export function injectStyles() {
  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);
}
