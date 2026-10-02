/**
 * SmartPark - shared parking data context.
 *
 * The map, slot list and dashboard all need the same live snapshot, so it is
 * fetched once here and refreshed through `refresh()` after any entry/exit.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api } from './api.js';

const ParkingContext = createContext(null);

export function ParkingProvider({ children }) {
  const [mapData, setMapData] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [mapRes, blockRes] = await Promise.all([api.map(), api.blocks()]);
      setMapData(mapRes.map);
      setBlocks(blockRes.blocks);
      setLastUpdated(mapRes.generatedAt);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Poll so the dashboard stays live while the demo runs.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load({ silent: true });
    }, 20000);
    return () => clearInterval(id);
  }, [load]);

  const value = useMemo(() => {
    const slots = mapData?.slots || [];
    return {
      loading,
      error,
      mapData,
      blocks,
      lastUpdated,
      refresh: load,
      slots,
      slotById: slots.reduce((acc, slot) => ({ ...acc, [slot.slotId]: slot }), {}),
      totals: mapData?.totals || { slots: 0, occupied: 0, empty: 0 },
    };
  }, [loading, error, mapData, blocks, lastUpdated, load]);

  return <ParkingContext.Provider value={value}>{children}</ParkingContext.Provider>;
}

export function useParking() {
  const ctx = useContext(ParkingContext);
  if (!ctx) throw new Error('useParking must be used inside <ParkingProvider>');
  return ctx;
}
