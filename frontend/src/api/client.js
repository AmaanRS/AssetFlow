import axios from 'axios'

const TOKEN_KEY = 'assetflow_access_token'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
})

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY)
}

export function storeToken(token, persistent = false) {
  clearStoredToken()
  const storage = persistent ? localStorage : sessionStorage
  storage.setItem(TOKEN_KEY, token)
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
}

apiClient.interceptors.request.use((request) => {
  const token = getStoredToken()
  if (token) request.headers.Authorization = `Bearer ${token}`
  return request
})
