import { Center, Loader } from '@mantine/core'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth.js'

export function ProtectedRoute({ children, roles }) {
  const { user, isInitializing } = useAuth()
  const location = useLocation()

  if (isInitializing) {
    return <Center mih="100svh"><Loader color="teal" /></Center>
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
