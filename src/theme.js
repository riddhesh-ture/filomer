// ══════════════════════════════════════════════════════════════
//  Filomer — MUI v9 Theme
//  Light-first, premium SaaS aesthetic
//  Uses colorSchemes + CSS variables for dark mode toggle
// ══════════════════════════════════════════════════════════════

import { createTheme, alpha } from '@mui/material/styles';

// ─── Category colors for file types ────────────────────────────
export const categoryColors = {
  image: '#06B6D4',
  svg:   '#8B5CF6',
  heic:  '#EC4899',
  pdf:   '#EF4444',
  video: '#F97316',
  audio: '#A855F7',
  unknown: '#94A3B8',
};

// ─── Theme ─────────────────────────────────────────────────────
const theme = createTheme({
  cssVariables: {
    colorSchemeSelector: 'class',
  },
  defaultColorScheme: 'dark',
  colorSchemes: {
    light: {
      palette: {
        primary: {
          main: '#2563EB',
          light: '#3B82F6',
          dark: '#1D4ED8',
          contrastText: '#fff',
        },
        secondary: {
          main: '#7C3AED',
          light: '#8B5CF6',
          dark: '#6D28D9',
        },
        background: {
          default: '#F8FAFC',
          paper: '#FFFFFF',
        },
        text: {
          primary: '#0F172A',
          secondary: '#64748B',
          disabled: '#94A3B8',
        },
        success: {
          main: '#10B981',
          light: '#D1FAE5',
          dark: '#059669',
        },
        warning: {
          main: '#F59E0B',
          light: '#FEF3C7',
          dark: '#D97706',
        },
        error: {
          main: '#EF4444',
          light: '#FEE2E2',
          dark: '#DC2626',
        },
        info: {
          main: '#3B82F6',
          light: '#DBEAFE',
          dark: '#2563EB',
        },
        divider: 'rgba(0, 0, 0, 0.08)',
        action: {
          hover: 'rgba(0, 0, 0, 0.04)',
          selected: 'rgba(37, 99, 235, 0.08)',
        },
      },
    },
    dark: {
      palette: {
        primary: {
          main: '#3B82F6',
          light: '#60A5FA',
          dark: '#2563EB',
          contrastText: '#fff',
        },
        secondary: {
          main: '#8B5CF6',
          light: '#A78BFA',
          dark: '#7C3AED',
        },
        background: {
          default: '#0B1120',
          paper: '#111827',
        },
        text: {
          primary: '#F1F5F9',
          secondary: '#94A3B8',
          disabled: '#475569',
        },
        success: {
          main: '#34D399',
          light: '#064E3B',
          dark: '#10B981',
        },
        warning: {
          main: '#FBBF24',
          light: '#78350F',
          dark: '#F59E0B',
        },
        error: {
          main: '#F87171',
          light: '#7F1D1D',
          dark: '#EF4444',
        },
        info: {
          main: '#60A5FA',
          light: '#1E3A5F',
          dark: '#3B82F6',
        },
        divider: 'rgba(255, 255, 255, 0.08)',
        action: {
          hover: 'rgba(255, 255, 255, 0.05)',
          selected: 'rgba(59, 130, 246, 0.12)',
        },
      },
    },
  },

  // ─── Typography ──────────────────────────────────────────────
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    h1: {
      fontSize: 'clamp(2.25rem, 5vw, 3.5rem)',
      fontWeight: 800,
      letterSpacing: '-0.025em',
      lineHeight: 1.1,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 700,
      letterSpacing: '-0.02em',
      lineHeight: 1.2,
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 600,
    },
    h5: {
      fontSize: '1.125rem',
      fontWeight: 600,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
    },
    subtitle1: {
      fontSize: '1.125rem',
      lineHeight: 1.65,
      fontWeight: 400,
    },
    subtitle2: {
      fontSize: '0.9375rem',
      lineHeight: 1.5,
      fontWeight: 500,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    caption: {
      fontSize: '0.75rem',
      fontWeight: 500,
      lineHeight: 1.5,
    },
    overline: {
      fontSize: '0.6875rem',
      fontWeight: 700,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      lineHeight: 1.5,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },

  // ─── Shape ───────────────────────────────────────────────────
  shape: {
    borderRadius: 12,
  },

  // ─── Component Overrides ─────────────────────────────────────
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          scrollBehavior: 'smooth',
        },
        body: {
          scrollbarWidth: 'thin',
          scrollbarColor: '#CBD5E1 transparent',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
        '::selection': {
          background: 'rgba(37, 99, 235, 0.2)',
        },
        '::-webkit-scrollbar': {
          width: '6px',
        },
        '::-webkit-scrollbar-track': {
          background: 'transparent',
        },
        '::-webkit-scrollbar-thumb': {
          background: '#CBD5E1',
          borderRadius: '3px',
        },
        '::-webkit-scrollbar-thumb:hover': {
          background: '#94A3B8',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 10,
          padding: '8px 20px',
          fontSize: '0.875rem',
          fontWeight: 600,
          transition: 'all 0.2s ease',
        },
        sizeSmall: {
          padding: '5px 14px',
          fontSize: '0.8125rem',
          borderRadius: 8,
        },
        sizeLarge: {
          padding: '12px 28px',
          fontSize: '1rem',
          borderRadius: 12,
        },
        containedPrimary: {
          boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2), 0 1px 3px rgba(37, 99, 235, 0.1)',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
          },
        },
        containedSuccess: {
          boxShadow: '0 1px 2px rgba(16, 185, 129, 0.2), 0 1px 3px rgba(16, 185, 129, 0.1)',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
          },
        },
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: '1px solid',
          borderColor: 'var(--mui-palette-divider)',
          overflow: 'hidden',
          transition: 'box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s ease',
          '&:hover': {
            boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
            borderColor: 'var(--mui-palette-primary-main)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          borderRadius: 8,
        },
        sizeSmall: {
          height: 24,
          fontSize: '0.75rem',
        },
      },
    },
    MuiAppBar: {
      defaultProps: {
        elevation: 0,
        color: 'transparent',
      },
      styleOverrides: {
        root: {
          // border handled in Layout.jsx for mode-aware styling
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundImage: 'none',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          border: '1px solid var(--mui-palette-divider)',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          height: 6,
        },
        bar: {
          borderRadius: 4,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.875rem',
          minHeight: 48,
          gap: 6,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          borderRadius: 2,
          height: 3,
        },
      },
    },
    MuiTooltip: {
      defaultProps: {
        arrow: true,
      },
      styleOverrides: {
        tooltip: {
          borderRadius: 8,
          fontSize: '0.75rem',
          fontWeight: 500,
          padding: '6px 12px',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          fontSize: '0.875rem',
        },
      },
    },
    MuiSelect: {
      defaultProps: {
        size: 'small',
      },
      styleOverrides: {
        root: {
          borderRadius: 10,
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: {
          height: 4,
        },
        thumb: {
          width: 16,
          height: 16,
          '&:hover, &.Mui-focusVisible': {
            boxShadow: '0 0 0 6px rgba(37, 99, 235, 0.16)',
          },
        },
      },
    },
    MuiAccordion: {
      defaultProps: {
        elevation: 0,
        disableGutters: true,
      },
      styleOverrides: {
        root: {
          borderRadius: '12px !important',
          border: '1px solid var(--mui-palette-divider)',
          '&::before': {
            display: 'none',
          },
        },
      },
    },
  },
});

export default theme;
