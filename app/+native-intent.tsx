interface redirectSystemPathProps {
  path: string;
  initial: boolean;
}

export function redirectSystemPath(_props: redirectSystemPathProps) {
  return '/(tabs)';
}
