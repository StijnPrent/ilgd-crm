"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { EmployeeDashboard } from "@/components/employee-dashboard"

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const router = useRouter()

  useEffect(() => {
    console.log("[v0] Dashboard: Checking authentication")

    if (typeof window === "undefined") return

    // Check localStorage for user session
    const userSession = localStorage.getItem("user")
    console.log("[v0] Dashboard: User session found:", !!userSession)

    if (userSession) {
      try {
        const user = JSON.parse(userSession)
        console.log("[v0] Dashboard: User role:", user.role)

        if (user.role === "chatter") {
          console.log("[v0] Dashboard: Chatter authenticated successfully")
          setIsAuthenticated(true)
        } else {
          console.log("[v0] Dashboard: User is not a chatter, redirecting to login")
          router.replace("/auth/login")
          return
        }
      } catch (error) {
        console.log("[v0] Dashboard: Error parsing user session:", error)
        router.replace("/auth/login")
        return
      }
    } else {
      console.log("[v0] Dashboard: No user session found, redirecting to login")
      router.replace("/auth/login")
      return
    }

    setIsLoading(false)
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect in useEffect
  }

  return <EmployeeDashboard />
}
