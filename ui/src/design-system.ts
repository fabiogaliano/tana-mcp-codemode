/**
 * Design System: "Terminal"
 *
 * Utilitarian, data-forward. Like a Bloomberg terminal or technical spec sheet.
 * Numbers are the hero. Everything else supports readability.
 */

export const colors = {
  // Foundation - True darks, not trendy
  bg: {
    deep: "#09090b",       // Near black
    base: "#0f0f11",       // Base surface
    elevated: "#18181b",   // Cards
    hover: "#1f1f23",      // Interactive
    subtle: "#27272a",     // Borders, dividers
  },

  // Text - High contrast hierarchy
  text: {
    primary: "#fafafa",
    secondary: "#a1a1aa",
    muted: "#71717a",
    faint: "#52525b",
  },

  // Data colors - Functional, not decorative
  winner: {
    primary: "#22c55e",      // Clear green for winner
    primarySoft: "rgba(34, 197, 94, 0.1)",
    secondary: "#f97316",    // Warm orange for comparison
    secondarySoft: "rgba(249, 115, 22, 0.1)",
  },

  // Semantic only
  error: "#ef4444",
  errorSoft: "rgba(239, 68, 68, 0.1)",

  // Borders
  border: {
    subtle: "rgba(255, 255, 255, 0.06)",
    default: "rgba(255, 255, 255, 0.1)",
    strong: "rgba(255, 255, 255, 0.15)",
  },
};

export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  xxl: "32px",
  xxxl: "48px",
};

export const radius = {
  sm: "4px",
  md: "6px",
  lg: "8px",
};

export const typography = {
  // Mono for data - this is non-negotiable
  mono: "'IBM Plex Mono', 'SF Mono', Monaco, monospace",
  // Clean sans for labels
  sans: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif",

  xs: "11px",
  sm: "12px",
  base: "13px",
  lg: "14px",
  xl: "16px",
  xxl: "20px",

  normal: 400,
  medium: 500,
  semibold: 600,
};
