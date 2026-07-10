import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import theme from './theme.js'
import FileConverter from './FileConverter.jsx'
import Compressor from './Compressor.jsx'

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/convert" element={<FileConverter />} />
          <Route path="/compress" element={<Compressor />} />
          <Route path="*" element={<Navigate to="/convert" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
