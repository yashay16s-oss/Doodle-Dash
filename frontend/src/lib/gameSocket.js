import { WS_URL } from "./config";

export function createGameSocket() {
  const listeners = new Map();
  let queue = [];
  let ws = new WebSocket(WS_URL);

  const attach = (socket) => {
    socket.onopen = () => {
      queue.forEach((msg) => socket.send(msg));
      queue = [];
    };
    socket.onmessage = (event) => {
      const { type, payload } = JSON.parse(event.data);
      (listeners.get(type) || []).forEach((cb) => cb(payload));
    };
  };

  attach(ws);

  return {
    on(type, cb) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(cb);
      return () => {
        listeners.set(type, (listeners.get(type) || []).filter((fn) => fn !== cb));
      };
    },
    emit(type, payload) {
      const msg = JSON.stringify({ type, payload });
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      } else {
        queue.push(msg);
      }
    },
    close() {
      ws.close();
    },
  };
}
