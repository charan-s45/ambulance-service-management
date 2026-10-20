// Small presentational helpers for loading / error / flash states.
import { useFlash } from "../context/FlashContext.jsx";

export function Loading({ text = "Loading..." }) {
  return (
    <p className="small loading" role="status">
      <i className="fas fa-spinner fa-spin"></i> {text}
    </p>
  );
}

export function ErrorState({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="notice error" role="alert">
      <span>{error.message || "Something went wrong."}</span>
      {onRetry && (
        <button type="button" className="btn secondary small-btn" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Notice({ type = "info", children }) {
  return (
    <div className={`notice ${type}`} role={type === "error" ? "alert" : "status"}>
      <span>{children}</span>
    </div>
  );
}

export function FlashBanner() {
  const { message, clear } = useFlash();
  if (!message) return null;
  return (
    <div key={message.key} className={`notice flash ${message.type}`} role={message.type === "error" ? "alert" : "status"}>
      <span>{message.text}</span>
      <button type="button" className="notice-close" aria-label="Dismiss" onClick={clear}>
        <i className="fas fa-xmark"></i>
      </button>
    </div>
  );
}
