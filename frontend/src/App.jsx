import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './auth/ProtectedRoute.jsx'
import { AppLayout } from './layouts/AppLayout.jsx'
import { AllocationsPage } from './pages/AllocationsPage.jsx'
import { AuditPage } from './pages/AuditPage.jsx'
import { AuthPage } from './pages/AuthPage.jsx'
import { AssetsPage } from './pages/AssetsPage.jsx'
import { BookingsPage } from './pages/BookingsPage.jsx'
import { DashboardPage } from './pages/DashboardPage.jsx'
import { MaintenancePage } from './pages/MaintenancePage.jsx'
import { NotificationsPage } from './pages/NotificationsPage.jsx'
import { OrganizationPage } from './pages/OrganizationPage.jsx'
import { ReportsPage } from './pages/ReportsPage.jsx'
import { ResetPasswordPage } from './pages/ResetPasswordPage.jsx'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/organization" element={<ProtectedRoute roles={['Admin']}><OrganizationPage /></ProtectedRoute>} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/allocations" element={<AllocationsPage />} />
        <Route path="/bookings" element={<BookingsPage />} />
        <Route path="/maintenance" element={<MaintenancePage />} />
        <Route path="/audits" element={<ProtectedRoute roles={['Admin', 'AssetManager', 'Employee', 'DepartmentHead']}><AuditPage /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute roles={['Admin', 'AssetManager', 'DepartmentHead']}><ReportsPage /></ProtectedRoute>} />
        <Route path="/notifications" element={<NotificationsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
