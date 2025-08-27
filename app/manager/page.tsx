"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { ManagerDashboard } from "@/components/manager-dashboard"

export const dynamic = "force-dynamic";

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
      console.log("[v0] Parsed user data:", user)
      if (user.role !== "manager") {
        console.log("[v0] User is not a manager, redirecting to login")
        router.replace("/auth/login")
        return
      }
      console.log("[v0] Manager authenticated successfully")
    } catch (error) {
      console.log("[v0] Error parsing user data:", error)
      router.replace("/auth/login")
      return
    }
  }, [router])

  return <ManagerDashboard />
}
