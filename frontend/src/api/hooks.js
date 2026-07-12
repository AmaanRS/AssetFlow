import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client.js'

function buildQuery(params = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.append(key, value)
    }
  })
  const queryString = search.toString()
  return queryString ? `?${queryString}` : ''
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await apiClient.get('/api/categories')).data.categories,
  })
}

export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: async () => (await apiClient.get('/api/departments')).data.departments,
  })
}

export function useUsers(params) {
  return useQuery({
    queryKey: ['users', params ?? {}],
    queryFn: async () =>
      (await apiClient.get(`/api/users${buildQuery(params)}`)).data.users,
  })
}

export function useAssets(params) {
  return useQuery({
    queryKey: ['assets', params ?? {}],
    queryFn: async () =>
      (await apiClient.get(`/api/assets${buildQuery(params)}`)).data,
    placeholderData: (previous) => previous,
  })
}

export function useAssetHistory(assetId) {
  return useQuery({
    queryKey: ['asset-history', assetId],
    queryFn: async () =>
      (await apiClient.get(`/api/assets/${assetId}/history`)).data,
    enabled: Boolean(assetId),
  })
}

export function useAllocations(params) {
  return useQuery({
    queryKey: ['allocations', params ?? {}],
    queryFn: async () =>
      (await apiClient.get(`/api/allocations${buildQuery(params)}`)).data.allocations,
  })
}

export function useTransfers(params) {
  return useQuery({
    queryKey: ['transfers', params ?? {}],
    queryFn: async () =>
      (await apiClient.get(`/api/transfers${buildQuery(params)}`)).data.transfers,
  })
}

// Option helpers for Mantine Select components.
export function toUserOptions(users = []) {
  return users.map((user) => ({ value: String(user.userId), label: `${user.name} (${user.email})` }))
}

export function toDepartmentOptions(departments = []) {
  return departments.map((department) => ({
    value: String(department.departmentId),
    label: department.name,
  }))
}

export function toCategoryOptions(categories = []) {
  return categories.map((category) => ({
    value: String(category.categoryId),
    label: category.name,
  }))
}
