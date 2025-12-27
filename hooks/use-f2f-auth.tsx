"use client"

import type React from "react"
import { createContext, useContext, useMemo, useState } from "react"

import { F2F_AUTH_DEFAULT_MESSAGE } from "@/lib/f2f-auth"

type F2FAuthState = {
  required: boolean
  message?: string
}

interface F2FAuthContextValue {
  state: F2FAuthState
  requireAuth: (message?: string) => void
  clearRequirement: () => void
}

const fallbackValue: F2FAuthContextValue = {
  state: { required: false, message: undefined },
  requireAuth: () => {},
  clearRequirement: () => {},
}

const F2FAuthContext = createContext<F2FAuthContextValue | null>(null)

export const F2FAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<F2FAuthState>({
    required: false,
    message: undefined,
  })

  const requireAuth = (message?: string) => {
    setState({
      required: true,
      message: message || F2F_AUTH_DEFAULT_MESSAGE,
    })
  }

  const clearRequirement = () => {
    setState((current) =>
      current.required ? { required: false, message: undefined } : current,
    )
  }

  const value = useMemo(
    () => ({
      state,
      requireAuth,
      clearRequirement,
    }),
    [state],
  )

  return (
    <F2FAuthContext.Provider value={value}>
      {children}
    </F2FAuthContext.Provider>
  )
}

export const useF2FAuth = () => {
  return useContext(F2FAuthContext) ?? fallbackValue
}
