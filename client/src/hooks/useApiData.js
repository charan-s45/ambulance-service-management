import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/apiClient.js";

/**
 * Loads data from the API and (optionally) refreshes it every `pollMs`.
 *
 * - Only ONE timer exists per component (the prototype stacked a new
 *   setTimeout on every render).
 * - Polling pauses while the browser tab is hidden.
 * - On a failed refresh the last good data is kept and `error` is set.
 */
export function useApiData(path, { pollMs = 0, enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const mounted = useRef(true);

  const reload = useCallback(async () => {
    if (!enabled || !path) return;
    try {
      const res = await api.get(path);
      if (!mounted.current) return;
      setData(res.data);
      setError(null);
    } catch (err) {
      if (mounted.current) setError(err);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [path, enabled]);

  useEffect(() => {
    mounted.current = true;
    setLoading(enabled);
    reload();
    if (!pollMs || !enabled) {
      return () => {
        mounted.current = false;
      };
    }
    const id = setInterval(() => {
      if (document.visibilityState !== "hidden") reload();
    }, pollMs);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [reload, pollMs, enabled]);

  return { data, error, loading, reload };
}
