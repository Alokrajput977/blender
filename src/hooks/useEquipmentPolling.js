import { useEffect, useRef, useState } from 'react';
import { EQUIPMENT_URL, POLL_MS } from '../config.js';

/**
 * Polls the equipment API every POLL_MS and calls onData(data[]).
 * Returns { status: 'connecting'|'live'|'error', lastUpdate: Date|null, error }
 */
export function useEquipmentPolling(onData, enabled = true) {
  const [status, setStatus] = useState('connecting');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);
  const cbRef = useRef(onData);
  cbRef.current = onData;

  useEffect(() => {
    if (!enabled) return undefined;
    let stopped = false;
    let timer = null;
    let controller = null;

    const poll = async () => {
      controller = new AbortController();
      try {
        const res = await fetch(EQUIPMENT_URL, {
          signal: controller.signal,
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const data = Array.isArray(json) ? json : json.data;
        if (!Array.isArray(data)) throw new Error('Unexpected API response');
        if (stopped) return;
        cbRef.current?.(data);
        setStatus('live');
        setLastUpdate(new Date());
        setError(null);
      } catch (e) {
        if (stopped || e.name === 'AbortError') return;
        setStatus('error');
        setError(e.message || String(e));
      } finally {
        if (!stopped) timer = setTimeout(poll, POLL_MS);
      }
    };
    poll();

    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [enabled]);

  return { status, lastUpdate, error };
}
