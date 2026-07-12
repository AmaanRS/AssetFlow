import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthPage } from './pages/AuthPage.jsx'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
