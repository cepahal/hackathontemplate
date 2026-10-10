// Semantic colors match frontend/src/app/globals.css.
export const colors = {
  background: "#f7f8f5",
  foreground: "#20332e",
  card: "#ffffff",
  primary: "#245745",
  primaryForeground: "#ffffff",
  secondary: "#ecf0e9",
  muted: "#58665e",
  border: "#e3e8e0",
  errorBackground: "#fffbeb",
  errorForeground: "#451a03",
} as const;

export const spacing = {
  small: 8,
  medium: 16,
  large: 24,
  section: 32,
} as const;
export const radius = { small: 8, card: 12, panel: 16 } as const;
