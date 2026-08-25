import { useSocketPopups } from "../context/SocketContext";

export default function ReminderToasts() {
  const ctx = useSocketPopups();
  if (!ctx) return null;
  const { popups, dismissPopup } = ctx;

  if (popups.length === 0) return null;

  return (
    <div className="toast-stack">
      {popups.map((p) => (
        <div className="toast" key={p.id}>
          <button onClick={() => dismissPopup(p.id)} aria-label="Dismiss">
            ×
          </button>
          <div className="t-title">{p.title}</div>
          <div className="t-msg">{p.message}</div>
        </div>
      ))}
    </div>
  );
}
