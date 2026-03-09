import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

export interface HistoryEntry {
  url: string;
  title: string;
  timestamp: number;
}

const HISTORY_KEY = 'readingHistory';
const MAX_ENTRIES = 100;
const storage = createAsyncStorage(HISTORY_KEY);

export function useHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    storage.getItem(HISTORY_KEY).then((data) => {
      if (data) {
        try {
          setHistory(JSON.parse(data));
        } catch {
          storage.removeItem(HISTORY_KEY);
        }
      }
    });
  }, []);

  const addEntry = useCallback((url: string, title: string) => {
    setHistory((prev) => {
      const filtered = prev.filter((e) => e.url !== url);
      const updated = [{ url, title, timestamp: Date.now() }, ...filtered].slice(0, MAX_ENTRIES);
      storage.setItem(HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearHistory = useCallback(async () => {
    setHistory([]);
    await storage.removeItem(HISTORY_KEY);
  }, []);

  return { history, addEntry, clearHistory };
}
