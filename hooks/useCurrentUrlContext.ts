import { createContext } from 'react';
import { SITE_URL } from '@/constants/config';

type CurrentUrlContextValues = [string, React.Dispatch<React.SetStateAction<string>>];

function createCurrentUrlContext() {
  const value: CurrentUrlContextValues = [SITE_URL, () => {}];

  return createContext(value);
}

export const CurrentUrlContext = createCurrentUrlContext();
