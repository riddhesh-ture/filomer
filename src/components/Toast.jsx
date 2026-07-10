// Toast.jsx — MUI Snackbar + Alert notification system
import { useState, useCallback } from 'react'
import Alert from '@mui/material/Alert'
import Stack from '@mui/material/Stack'
import Slide from '@mui/material/Slide'

export function useToasts() {
  const [toasts, setToasts] = useState([])
  const addToast = useCallback((msg, type = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])
  return { toasts, addToast }
}

export default function ToastContainer({ toasts }) {
  if (!toasts.length) return null
  return (
    <Stack
      spacing={1}
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        maxWidth: 380,
      }}
    >
      {toasts.map(t => (
        <Slide key={t.id} direction="left" in mountOnEnter unmountOnExit>
          <Alert
            severity={t.type === 'warn' ? 'warning' : t.type}
            variant="filled"
            sx={{
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              borderRadius: 3,
              fontWeight: 500,
            }}
          >
            {t.msg}
          </Alert>
        </Slide>
      ))}
    </Stack>
  )
}
