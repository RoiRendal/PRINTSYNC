export const MACOS_COLORS = {
  blue: '#007AFF',
  blueDark: '#0A84FF',
  cyan: '#5AC8FA',
  green: '#34C759',
  red: '#FF3B30',
  orange: '#FF9500',
  purple: '#AF52DE',
  gray: '#8E8E93',
  bg: '#F5F5F7',
  bgDark: '#1C1C1E',
  text: '#1D1D1F',
  textMuted: '#86868B',
} as const;

export const GLASS = {
  light: 'rgba(255, 255, 255, 0.72)',
  lightStrong: 'rgba(255, 255, 255, 0.86)',
  dark: 'rgba(28, 28, 30, 0.72)',
  darkStrong: 'rgba(44, 44, 46, 0.84)',
  borderLight: 'rgba(255, 255, 255, 0.48)',
  borderDark: 'rgba(255, 255, 255, 0.12)',
  sidebarBlur: '24px',
  toolbarBlur: '20px',
  modalBlur: '40px',
} as const;

export const RADII = {
  button: '8px',
  card: '12px',
  modal: '16px',
  squircle: '20px',
  pill: '9999px',
} as const;

export const SHADOWS = {
  card: '0 1px 3px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.04)',
  glass: '0 12px 40px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.32)',
  modal: '0 24px 80px rgba(0,0,0,0.34), 0 0 0 0.5px rgba(0,0,0,0.08)',
} as const;

export const MOTION = {
  fast: 0.16,
  normal: 0.22,
  slow: 0.32,
  spring: {
    type: 'spring',
    stiffness: 420,
    damping: 34,
  },
} as const;

export const COLORS = {
  ...MACOS_COLORS,
  accent: MACOS_COLORS.blue,
  card: '#FFFFFF',
  border: '#E5E5EA',
};
