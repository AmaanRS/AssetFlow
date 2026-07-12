import { useEffect, useState } from 'react'
import { apiClient, clearStoredToken, getStoredToken, storeToken } from '../api/client.js'
import { AuthContext } from './auth-context.js'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isInitializing, setIsInitializing] = useState(() => Boolean(getStoredToken()))

  useEffect(() => {
    const token = getStoredToken()
    if (!token) return

    let active = true
    apiClient
      .get('/api/auth/session')
      .then(({ data }) => {
        if (active) setUser(data.user)
      })
      .catch(() => {
        clearStoredToken()
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setIsInitializing(false)
      })

    return () => {
      active = false
    }
  }, [])

  const login = async (credentials, remember = false) => {
    const { data } = await apiClient.post('/api/auth/login', credentials)
    storeToken(data.token, remember)
    setUser(data.user)
    return data.user
  }

  const signup = async (details) => {
    const { data } = await apiClient.post('/api/auth/signup', details)
    storeToken(data.token)
    setUser(data.user)
    return data.user
  }

  const logout = () => {
    clearStoredToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isInitializing, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
