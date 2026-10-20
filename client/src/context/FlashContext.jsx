import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const FlashContext = createContext(null);

// Replaces the prototype's alert() pop-ups with a message banner that does not
// block the page and survives navigation (e.g. "Welcome, Kavya (user)").
export function FlashProvider({ children }) {
  const [message, setMessage] = useState(null);
  const timer = useRef(null);

  const clear = useCallback(() => setMessage(null), []);

  const flash = useCallback((text, type = "success") => {
    clearTimeout(timer.current);
    setMessage({ text, type, key: Date.now() });
    timer.current = setTimeout(() => setMessage(null), type === "error" ? 8000 : 5000);
  }, []);

  const value = useMemo(() => ({ message, flash, clear }), [message, flash, clear]);
  return <FlashContext.Provider value={value}>{children}</FlashContext.Provider>;
}

export function useFlash() {
  const ctx = useContext(FlashContext);
  if (!ctx) throw new Error("useFlash must be used inside <FlashProvider>");
  return ctx;
}
