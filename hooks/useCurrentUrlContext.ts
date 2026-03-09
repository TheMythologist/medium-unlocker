import { createContext } from 'react';
import { SITE_URL } from '@/constants/config';

type CurrentUrlContextValues = [string, React.Dispatch<React.SetStateAction<string>>];

function createCurrentUrlContext() {
  const value: CurrentUrlContextValues = [SITE_URL, () => {}];

  return createContext(value);
}

export const CurrentUrlContext = createCurrentUrlContext();

export const ReloadContext = createContext<React.RefObject<(() => void) | null>>({
  current: null,
});

export const NavigateContext = createContext<React.RefObject<((url: string) => void) | null>>({
  current: null,
});

export interface HistoryContextValue {
  history: { url: string; title: string; timestamp: number }[];
  addEntry: (url: string, title: string) => void;
  clearHistory: () => void;
}

export const HistoryContext = createContext<HistoryContextValue>({
  history: [],
  addEntry: () => {},
  clearHistory: () => {},
});
