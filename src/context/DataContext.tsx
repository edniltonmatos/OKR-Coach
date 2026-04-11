import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Cycle, KeyResult } from '../types';
import { runMigrations } from '../db/client';
import { getKeyResults, getLatestCycle } from '../db/repositories';

type DataContextValue = {
  loading: boolean;
  cycle: Cycle | null;
  keyResults: KeyResult[];
  refresh: () => Promise<void>;
};

const DataContext = createContext<DataContextValue | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [keyResults, setKeyResults] = useState<KeyResult[]>([]);

  const refresh = useCallback(async () => {
    await runMigrations();
    const c = await getLatestCycle();
    setCycle(c);
    if (c) {
      const krs = await getKeyResults(c.id);
      setKeyResults(krs);
    } else {
      setKeyResults([]);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await runMigrations();
        const c = await getLatestCycle();
        if (!alive) return;
        setCycle(c);
        if (c) {
          const krs = await getKeyResults(c.id);
          setKeyResults(krs);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      loading,
      cycle,
      keyResults,
      refresh,
    }),
    [loading, cycle, keyResults, refresh]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useAppData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useAppData must be used within DataProvider');
  return ctx;
}
