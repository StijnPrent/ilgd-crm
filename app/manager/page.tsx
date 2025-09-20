"use client"

import { Suspense, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ManagerDashboard } from "@/components/manager-dashboard"

export const dynamic = "force-dynamic"

export default function ManagerPage() {
  const router = useRouter()

  useEffect(() => {
    console.log("[v0] Manager page loaded, checking authentication")

    if (typeof window === "undefined") return

    const userStr = localStorage.getItem("user")

    if (!userStr) {
      console.log("[v0] No user found in localStorage, redirecting to login")
      router.replace("/auth/login")
      return
    }

    try {
      const user = JSON.parse(userStr)
      if (user.role !== "manager") {
        console.log("[ilgd] User is not a manager, redirecting to login")
        router.replace("/auth/login")
        return
      }
      console.log("[ilgd] Manager authenticated successfully")
    } catch (error) {
      console.log("[ilgd] Error parsing user data:", error)
      router.replace("/auth/login")
      return
    }
  }, [router])

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <ManagerDashboard />
    </Suspense>
  )
}
