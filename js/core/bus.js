/**
 * Tiny typed event bus
 */

class EventBus {
  constructor() {
    this.listeners = {};
  }

  /**
   * Subscribe to an event
   * @param {string} event
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  /**
   * Dispatch an event
   * @param {string} event
   * @param {any} [payload]
   */
  emit(event, payload) {
    if (this.listeners[event]) {
      // Create a copy of the array to prevent issues if a listener unsubscribes during emit
      const callbacks = [...this.listeners[event]];
      callbacks.forEach(callback => callback(payload));
    }
  }

  /**
   * Unsubscribe a specific callback from an event
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }
}

export const bus = new EventBus();
