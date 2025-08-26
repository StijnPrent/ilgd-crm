"use client"

import { useEffect } from "react"
import { ManagerDashboard } from "@/components/manager-dashboard"

export default function ManagerPage() {
  useEffect(() => {
    console.log("[v0] Manager page loaded, checking authentication")
    const userStr = localStorage.getItem("user")

    if (!userStr) {
      console.log("[v0] No user found in localStorage, redirecting to login")
      window.location.href = "/auth/login"
      return
    }

    try {
      const user = JSON.parse(userStr)
      console.log("[v0] Parsed user data:", user)
      if (user.role !== "manager") {
        console.log("[v0] User is not a manager, redirecting to login")
        window.location.href = "/auth/login"
        return
      }
      console.log("[v0] Manager authenticated successfully")
    } catch (error) {
      console.log("[v0] Error parsing user data:", error)
      window.location.href = "/auth/login"
      return
    }
  }, [])

  return <ManagerDashboard />
}
