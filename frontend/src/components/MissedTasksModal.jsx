export default function MissedTasksModal({ tasks, onClose }) {
  if (!tasks || tasks.length === 0) return null;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>👋 Welcome back</h2>
        <p className="modal-sub">
          {tasks.length === 1
            ? "This task was assigned on a previous day and is still incomplete:"
            : `These ${tasks.length} tasks were assigned on previous days and are still incomplete:`}
        </p>

        <div className="missed-list">
          {tasks.map((t) => (
            <div className="missed-item" key={t.id}>
              <div className="t">{t.title}</div>
              <div className="d">
                Was due: {new Date(t.dueDate).toLocaleString(undefined, {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary btn-block" onClick={onClose}>
            Got it, thanks
          </button>
        </div>
      </div>
    </div>
  );
}
