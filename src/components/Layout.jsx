// Layout.jsx — MUI v9 App Shell: premium glassmorphic AppBar with pill nav + theme toggle
// All accent colours are DYNAMIC — they change based on the active pane:
//   Convert → blue/indigo     Compress → green/emerald
import { useLocation, useNavigate } from 'react-router-dom'
import { useColorScheme } from '@mui/material/styles'
import { useRef, useState, useLayoutEffect } from 'react'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Container from '@mui/material/Container'
import Tooltip from '@mui/material/Tooltip'
import useMediaQuery from '@mui/material/useMediaQuery'
import { Zap, Shield, MonitorDown, Sun, Moon } from 'lucide-react'
import ToastContainer from './Toast.jsx'

// ─── Dynamic colour palettes ───────────────────────────────────
const PALETTES = {
  // Convert pane — blue / indigo
  convert: {
    main:      '#3B82F6',
    dark:      '#2563EB',
    secondary: '#6366F1',
    rgb:       '59,130,246',
    gradient:  'linear-gradient(135deg, #3B82F6, #6366F1)',
    gradientFaint: {
      dark:  'linear-gradient(135deg, rgba(59,130,246,0.25), rgba(99,102,241,0.20))',
      light: 'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(124,58,237,0.10))',
    },
    border: { dark: 'rgba(59,130,246,0.30)', light: 'rgba(37,99,235,0.20)' },
    glow:   { dark: '0 1px 8px rgba(59,130,246,0.15)', light: '0 1px 4px rgba(37,99,235,0.08)' },
    dot:    { dark: '0 0 6px rgba(59,130,246,0.5)', light: '0 0 6px rgba(37,99,235,0.4)' },
    shadow: '0 2px 8px rgba(59,130,246,0.4)',
    brandGlow: '0 0 16px rgba(37, 99, 235, 0.4)',
    brandGradient: 'linear-gradient(135deg, #2563EB, #7C3AED)',
    brandShadow: '0 2px 10px rgba(37, 99, 235, 0.25)',
  },
  // Compress pane — green / emerald
  compress: {
    main:      '#10B981',
    dark:      '#059669',
    secondary: '#06B6D4',
    rgb:       '16,185,129',
    gradient:  'linear-gradient(135deg, #10B981, #06B6D4)',
    gradientFaint: {
      dark:  'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(6,182,212,0.20))',
      light: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,182,212,0.10))',
    },
    border: { dark: 'rgba(16,185,129,0.30)', light: 'rgba(16,185,129,0.20)' },
    glow:   { dark: '0 1px 8px rgba(16,185,129,0.15)', light: '0 1px 4px rgba(16,185,129,0.08)' },
    dot:    { dark: '0 0 6px rgba(16,185,129,0.5)', light: '0 0 6px rgba(16,185,129,0.4)' },
    shadow: '0 2px 8px rgba(16,185,129,0.4)',
    brandGlow: '0 0 16px rgba(16, 185, 129, 0.4)',
    brandGradient: 'linear-gradient(135deg, #059669, #06B6D4)',
    brandShadow: '0 2px 10px rgba(16, 185, 129, 0.25)',
  },
}

// ── Pill-style theme toggle (Dark ←→ Light) ────────────────────
function ThemeToggle({ pal }) {
  const { mode, setMode } = useColorScheme()
  if (!mode) return null
  const isDark = mode === 'dark'

  return (
    <Tooltip title={`Switch to ${isDark ? 'light' : 'dark'} mode`}>
      <Box
        onClick={() => setMode(isDark ? 'light' : 'dark')}
        sx={{
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          width: 68,
          height: 36,
          borderRadius: 99,
          bgcolor: isDark
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(0,0,0,0.06)',
          border: '1px solid',
          borderColor: isDark
            ? 'rgba(255,255,255,0.10)'
            : 'rgba(0,0,0,0.10)',
          cursor: 'pointer',
          transition: 'all 0.35s ease',
          overflow: 'hidden',
          flexShrink: 0,
          '&:hover': {
            borderColor: isDark
              ? 'rgba(255,255,255,0.20)'
              : 'rgba(0,0,0,0.18)',
            bgcolor: isDark
              ? 'rgba(255,255,255,0.08)'
              : 'rgba(0,0,0,0.08)',
          },
        }}
      >
        {/* Sliding pill indicator — uses dynamic accent colour */}
        <Box
          sx={{
            position: 'absolute',
            top: 3,
            left: isDark ? 3 : 'calc(100% - 33px)',
            width: 30,
            height: 30,
            borderRadius: 99,
            background: isDark
              ? pal.gradient
              : 'linear-gradient(135deg, #F59E0B, #F97316)',
            transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: isDark
              ? pal.shadow
              : '0 2px 8px rgba(245,158,11,0.4)',
          }}
        />
        {/* Moon icon (left) */}
        <Box
          sx={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', zIndex: 1,
            color: isDark ? '#fff' : 'text.secondary',
            transition: 'color 0.25s ease',
          }}
        >
          <Moon size={13} />
        </Box>
        {/* Sun icon (right) */}
        <Box
          sx={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', zIndex: 1,
            color: isDark ? 'text.secondary' : '#fff',
            transition: 'color 0.25s ease',
          }}
        >
          <Sun size={13} />
        </Box>
      </Box>
    </Tooltip>
  )
}

// ── Segmented pill navigation (Convert / Compress) ─────────────
// Text-only, no icons. Always-running marching ants border matches
// DropZone's design language — blue for Convert, green for Compress.
// Pill ants run at lower opacity than DropZone to signal "nav" not "drop target".
function NavPills({ value, onChange, isMobile }) {
  const pillRef = useRef(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = pillRef.current
    if (!el) return
    const measure = () => setDims({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const tabs = [
    { label: 'Convert',  pal: PALETTES.convert },
    { label: 'Compress', pal: PALETTES.compress },
  ]
  const activePal = tabs[value].pal

  // ── Comet around ACTIVE TAB only ─────────────────────────────
  // Active tab = half the pill width minus padding, full height minus padding
  const activeW = dims.w > 0 ? dims.w / 2 - 3 : 0
  const activeH = dims.h > 0 ? dims.h - 6 : 0
  const activeR = Math.max(activeH / 2 - 1, 0)  // fully rounded
  const activePerimeter = activeW && activeH
    ? 2 * (activeW + activeH) - 8 * activeR + 2 * Math.PI * activeR
    : 0
  const PATH_LEN = 1000
  const arcLen   = PATH_LEN * 0.30   // 30% arc — good comet tail length
  const arcGap   = PATH_LEN - arcLen

  const cometClass = value === 0 ? 'pill-comet pill-comet--convert'
                                 : 'pill-comet pill-comet--compress'
  const cometColor = value === 0 ? '#3B82F6' : '#10B981'

  return (
    <Box
      ref={pillRef}
      sx={{
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        height: 44,
        borderRadius: 99,
        bgcolor: (t) =>
          t.palette.mode === 'dark'
            ? 'rgba(255,255,255,0.05)'
            : 'rgba(0,0,0,0.04)',
        // Simple static border — comet handles visual interest
        border: '1px solid',
        borderColor: (t) =>
          t.palette.mode === 'dark'
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(0,0,0,0.08)',
        p: '3px',
        gap: 0,
      }}
    >
      {/* Sliding highlight — faint tint behind the active tab */}
      <Box
        sx={{
          position: 'absolute',
          top: 3,
          left: value === 0 ? 3 : '50%',
          width: 'calc(50% - 3px)',
          height: 'calc(100% - 6px)',
          borderRadius: 99,
          background: (t) =>
            t.palette.mode === 'dark'
              ? activePal.gradientFaint.dark
              : activePal.gradientFaint.light,
          transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.35s ease',
        }}
      />

      {/* ── Comet SVG — key={value} remounts on tab switch, restarting animation ── */}
      {activePerimeter > 0 && (
        <Box
          key={value}
          component="svg"
          sx={{
            position: 'absolute',
            top: 3,
            left: value === 0 ? 3 : '50%',
            width: 'calc(50% - 3px)',
            height: 'calc(100% - 6px)',
            pointerEvents: 'none',
            overflow: 'visible',
            zIndex: 2,
            transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <rect
            x="1" y="1"
            width="calc(100% - 2px)"
            height="calc(100% - 2px)"
            rx={activeR}
            fill="none"
            stroke={cometColor}
            strokeWidth="2"
            strokeLinecap="round"
            pathLength={PATH_LEN}
            strokeDasharray={`${arcLen} ${arcGap}`}
            className={cometClass}
          />
        </Box>
      )}

      {/* Tab labels */}
      {tabs.map((tab, i) => {
        const isActive = value === i
        return (
          <Box
            key={tab.label}
            onClick={() => onChange(i)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              px: isMobile ? 1.5 : 3,
              height: '100%',
              borderRadius: 99,
              cursor: 'pointer',
              position: 'relative',
              zIndex: 1,
              transition: 'color 0.3s ease',
              color: isActive
                ? tab.pal.main
                : `rgba(${tab.pal.rgb}, 0.65)`,
              '&:hover': {
                color: isActive ? tab.pal.main : `rgba(${tab.pal.rgb}, 0.88)`,
              },
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontWeight: isActive ? 800 : 600,
                fontSize: isMobile ? '0.8rem' : '0.875rem',
                letterSpacing: isActive ? '-0.02em' : '-0.01em',
                whiteSpace: 'nowrap',
                transition: 'all 0.3s ease',
                // Subtle glow only on active label
                textShadow: isActive
                  ? `0 0 10px rgba(${tab.pal.rgb}, 0.55)`
                  : 'none',
              }}
            >
              {tab.label}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}

// ── Status badge ───────────────────────────────────────────────
function StatusBadge({ engineState, engineReady, engineProgress, pal }) {
  const label = engineReady
    ? 'Engine Ready'
    : engineState === 'loading'
      ? `Loading ${engineProgress}%`
      : 'Local Only'

  return (
    <Tooltip title="All processing happens on your device — nothing is uploaded">
      <Box
        sx={{
          display: { xs: 'none', sm: 'flex' },
          alignItems: 'center',
          gap: 0.75,
          px: 1.5,
          py: 0.5,
          borderRadius: 99,
          bgcolor: (t) =>
            t.palette.mode === 'dark'
              ? 'rgba(255,255,255,0.04)'
              : 'rgba(0,0,0,0.03)',
          border: '1px solid',
          borderColor: (t) =>
            t.palette.mode === 'dark'
              ? 'rgba(255,255,255,0.08)'
              : 'rgba(0,0,0,0.06)',
          transition: 'all 0.35s ease',
        }}
      >
        {/* Dot indicator — dynamic colour */}
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: engineReady ? 'success.main' : pal.main,
            boxShadow: engineReady
              ? '0 0 6px rgba(16,185,129,0.6)'
              : (t) => t.palette.mode === 'dark' ? pal.dot.dark : pal.dot.light,
            transition: 'background-color 0.35s ease, box-shadow 0.35s ease',
            animation: engineState === 'loading'
              ? 'pulse 1.5s ease-in-out infinite'
              : 'none',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 1, transform: 'scale(1)' },
              '50%': { opacity: 0.5, transform: 'scale(0.8)' },
            },
          }}
        />
        <Shield size={11} style={{ opacity: 0.7 }} />
        <Typography
          variant="caption"
          sx={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.6375rem',
            fontWeight: 500,
            letterSpacing: '0.02em',
            color: 'text.secondary',
            lineHeight: 1,
          }}
        >
          {label}
        </Typography>
      </Box>
    </Tooltip>
  )
}

// ── Main Layout ────────────────────────────────────────────────
export default function Layout({
  children,
  toasts,
  engineState = 'idle',
  engineProgress = 0,
  isInstallable = false,
  isInstalled = false,
  onInstall,
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const isMobile = useMediaQuery('(max-width:600px)')
  const engineReady = engineState === 'ready'

  const tabValue = location.pathname.startsWith('/compress') ? 1 : 0
  const pal = tabValue === 0 ? PALETTES.convert : PALETTES.compress

  const handleTabChange = (newValue) => {
    navigate(newValue === 1 ? '/compress' : '/convert')
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* ── AppBar ──────────────────────────────────────────── */}
      <AppBar
        position="sticky"
        sx={{
          bgcolor: (t) =>
            t.palette.mode === 'dark'
              ? 'rgba(11, 17, 32, 0.80)'
              : 'rgba(248, 250, 252, 0.85)',
          backdropFilter: 'blur(24px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
          borderBottom: '1px solid',
          borderColor: (t) =>
            t.palette.mode === 'dark'
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(0,0,0,0.06)',
        }}
      >
        <Container maxWidth="lg" disableGutters>
          <Toolbar
            sx={{
              gap: { xs: 1.5, sm: 2 },
              px: { xs: 2, sm: 3 },
              minHeight: { xs: 56, sm: 64 },
              position: 'relative',
            }}
          >
            {/* Brand — left */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                cursor: 'pointer',
                '&:hover .brand-logo': {
                  transform: 'scale(1.05)',
                  boxShadow: pal.brandGlow,
                },
              }}
              onClick={() => navigate('/convert')}
            >
              <Box
                className="brand-logo"
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '10px',
                  background: pal.brandGradient,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.35s ease',
                  boxShadow: pal.brandShadow,
                }}
              >
                <Zap size={15} color="#fff" fill="#fff" />
              </Box>
              {!isMobile && (
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 800,
                    letterSpacing: '-0.5px',
                    fontSize: '1.1rem',
                  }}
                >
                  Dev
                  <Box
                    component="span"
                    sx={{
                      color: pal.main,
                      transition: 'color 0.35s ease',
                    }}
                  >
                    Suite
                  </Box>
                </Typography>
              )}
            </Box>

            {/* Pill Navigation — truly page-centred via absolute positioning */}
            <Box
              sx={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1,
              }}
            >
              <NavPills
                value={tabValue}
                onChange={handleTabChange}
                isMobile={isMobile}
              />
            </Box>

            {/* Spacer pushes right-side items to the end */}
            <Box sx={{ flex: 1 }} />

            {/* Install button */}
            {isInstallable && !isInstalled && (
              <Tooltip title="Install as desktop app">
                <Box
                  onClick={onInstall}
                  sx={{
                    display: { xs: 'none', sm: 'flex' },
                    alignItems: 'center',
                    gap: 0.75,
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 99,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: 'divider',
                    transition: 'all 0.35s ease',
                    color: 'text.secondary',
                    '&:hover': {
                      borderColor: pal.main,
                      color: pal.main,
                      bgcolor: `rgba(${pal.rgb},0.06)`,
                    },
                  }}
                >
                  <MonitorDown size={13} />
                  <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                    Install
                  </Typography>
                </Box>
              </Tooltip>
            )}

            {/* Engine status badge */}
            <StatusBadge
              engineState={engineState}
              engineReady={engineReady}
              engineProgress={engineProgress}
              pal={pal}
            />

            {/* Theme toggle */}
            <ThemeToggle pal={pal} />
          </Toolbar>
        </Container>
      </AppBar>

      {/* ── Main Content ───────────────────────────────────── */}
      <Container
        maxWidth="lg"
        sx={{
          pt: { xs: 3, sm: 4 },
          pb: 12,
          position: 'relative',
        }}
      >
        {children}
      </Container>

      {/* ── Toasts ─────────────────────────────────────────── */}
      <ToastContainer toasts={toasts} />
    </Box>
  )
}
