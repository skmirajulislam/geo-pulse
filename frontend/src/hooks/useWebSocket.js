import { useState } from 'react';

/**
 * Stub WebSocket hook.
 * The current backend only exposes a REST endpoint (/api/geopolitics),
 * so WebSocket is disabled. This returns a stable { isConnected: false }
 * so the Dashboard status indicator renders correctly without errors.
 */
export default function useWebSocket({ onNewEvent, onStatsUpdate } = {}) {
  const [isConnected] = useState(false);
  return { isConnected };
}
