// Frontend-only auth state management
export interface User {
  id: string
  username: string
  fullName: string
  role: "employee" | "manager"
  currency?: string
  commissionRate?: number
  platformFeeRate?: number
}

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null

  const userStr = localStorage.getItem("user")
  return userStr ? JSON.parse(userStr) : null
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false

  return !!localStorage.getItem("auth_token")
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null

  return localStorage.getItem("auth_token")
}
