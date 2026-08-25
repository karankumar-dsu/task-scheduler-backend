import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { API_BASE } from "../api/axios";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [popups, setPopups] = useState([]); // in-app reminder popups

  useEffect(() => {
    if (!user) return;

    const socketUrl = API_BASE.replace(/\/api\/?$/, "");
    const socket = io(socketUrl, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("register", user.email);
    });

    socket.on("task:reminder", (payload) => {
      pushPopup({
        id: `reminder-${payload.taskId}-${Date.now()}`,
        type: "reminder",
        title: "⏰ Deadline approaching",
        message: `"${payload.title}" is due soon.`,
      });
    });

    socket.on("task:assigned", (payload) => {
      pushPopup({
        id: `assigned-${payload.taskId}-${Date.now()}`,
        type: "assigned",
        title: "📥 New task assigned",
        message: `${payload.from} assigned you "${payload.title}".`,
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  function pushPopup(popup) {
    setPopups((prev) => [...prev, popup]);
    // auto-dismiss after 8 seconds
    setTimeout(() => {
      setPopups((prev) => prev.filter((p) => p.id !== popup.id));
    }, 8000);
  }

  function dismissPopup(id) {
    setPopups((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <SocketContext.Provider value={{ popups, dismissPopup }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketPopups() {
  return useContext(SocketContext);
}
