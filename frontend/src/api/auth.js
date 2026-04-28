import apiClient from './client'

export async function login(username, password) {
  const { data } = await apiClient.post('/auth/token/', { username, password })
  return data
}

export async function refreshToken(refresh) {
  const { data } = await apiClient.post('/auth/token/refresh/', { refresh })
  return data
}

export async function register(payload) {
  const { data } = await apiClient.post('/auth/register/', payload)
  return data
}

export async function getMe() {
  const { data } = await apiClient.get('/auth/me/')
  return data
}