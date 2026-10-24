import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { API_ROOT } from "../services/api";
import { getStoredToken } from "../utils/auth";

let sharedSocket = null;
const listeners = new Set();

function getSocket() {
  const token = getStoredToken();
  if (!token) {
    if (sharedSocket) {
      sharedSocket.disconnect();
      sharedSocket = null;
    }
    return null;
  }

  if (!sharedSocket) {
    const socketUrl = API_ROOT || window.location.origin;
    sharedSocket = io(socketUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    sharedSocket.on("connect", () => {
      listeners.forEach((fn) => fn(true));
    });

    sharedSocket.on("disconnect", () => {
      listeners.forEach((fn) => fn(false));
    });
  }

  return sharedSocket;
}

export function useRealtime() {
  const [connected, setConnected] = useState(() => {
    return Boolean(sharedSocket && sharedSocket.connected);
  });
  const socketRef = useRef(null);

  useEffect(() => {
    const s = getSocket();
    socketRef.current = s;
    if (s) {
      setConnected(s.connected);
    }

    const handleStatus = (status) => setConnected(status);
    listeners.add(handleStatus);

    return () => {
      listeners.delete(handleStatus);
    };
  }, []);

  const subscribe = (event, handler) => {
    const s = socketRef.current || getSocket();
    if (!s) return () => {};
    s.on(event, handler);
    return () => {
      s.off(event, handler);
    };
  };

  const onReconnect = (handler) => {
    const s = socketRef.current || getSocket();
    if (!s) return () => {};
    s.io.on("reconnect", handler);
    return () => {
      s.io.off("reconnect", handler);
    };
  };

  return {
    socket: socketRef.current || sharedSocket,
    connected,
    subscribe,
    onReconnect,
  };
}

export default useRealtime;
