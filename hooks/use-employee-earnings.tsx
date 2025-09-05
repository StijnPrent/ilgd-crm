"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { api } from "@/lib/api"

interface EmployeeEarningsContextValue {
  earnings: any[] | null
  loading: boolean
  refresh: () => Promise<void>
}

const EmployeeEarningsContext = createContext<EmployeeEarningsContextValue | undefined>(undefined)

interface ProviderProps { children: ReactNode; userId?: string }

export function EmployeeEarningsProvider({ children, userId }: ProviderProps) {
  const [earnings, setEarnings] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    try {
      setLoading(true)
      const data = userId
        ? await api.getEmployeeEarningsByChatter(userId)
        : await api.getEmployeeEarnings()
      setEarnings(data || [])
    } catch (err) {
      console.error("Failed to load employee earnings:", err)
      setEarnings([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [userId])

  return (
    <EmployeeEarningsContext.Provider value={{ earnings, loading, refresh }}>
      {children}
    </EmployeeEarningsContext.Provider>
  )
}

export function useEmployeeEarnings() {
  const ctx = useContext(EmployeeEarningsContext)
  if (!ctx) {
    throw new Error("useEmployeeEarnings must be used within an EmployeeEarningsProvider")
  }
  return ctx
}

