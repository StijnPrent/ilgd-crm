"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { api } from "@/lib/api"

interface EmployeeEarningsContextValue {
  earnings: any[] | null
  loading: boolean
  refresh: () => Promise<void>
}

const EmployeeEarningsContext = createContext<EmployeeEarningsContextValue | undefined>(undefined)

interface ProviderProps {
  children: ReactNode
  userId?: string
  from?: string
  to?: string
}

export function EmployeeEarningsProvider({ children, userId, from, to }: ProviderProps) {
  const [earnings, setEarnings] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    try {
      setLoading(true)
      const params: {
        chatterId?: string
        from?: string
        to?: string
      } = {}

      if (userId) {
        params.chatterId = String(userId)
      }
      if (from) {
        params.from = from
      }
      if (to) {
        params.to = to
      }

      const data = await api.getEmployeeEarnings(params)
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
  }, [userId, from, to])

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

