"use client"

import { useEffect, useState } from "react"
import {useRouter, useSearchParams} from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LogoutButton } from "@/components/logout-button"
import { EmployeeStats } from "@/components/employee-stats"
import { ClockInOut } from "@/components/clock-in-out"
import { EarningsEntry } from "@/components/earnings-entry"
import { EmployeeShifts } from "@/components/employee-shifts"
import { Leaderboard } from "@/components/leaderboard"
import { DollarSign, Calendar, Award, User } from "lucide-react"
import Image from "next/image"
import { EmployeeEarningsHistory } from "@/components/employee-earnings-history"
import { WeeklyCalendar } from "@/components/weekly-calendar"
import { api } from "@/lib/api"

export function EmployeeDashboard() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshStats, setRefreshStats] = useState(0)
  const router = useRouter()
  const searchParams  = useSearchParams()
  const initialTab    = searchParams.get('tab') ?? 'overview'
  const [activeTab, setActiveTab] = useState<string>(initialTab)

  const handleClockChange = () => setRefreshStats(p => p + 1);

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      if (typeof window === "undefined") return
      try {
        // Require token + stored user id (set by api.login)
        const token = localStorage.getItem("auth_token")
        const storedUserStr = localStorage.getItem("user")
        if (!token || !storedUserStr) {
          router.replace("/auth/login")
          return
        }

        let storedUser: any
        try {
          storedUser = JSON.parse(storedUserStr)
        } catch {
          localStorage.removeItem("user")
          router.replace("/auth/login")
          return
        }

        const userId = String(storedUser?.id ?? "")
        if (!userId) {
          router.replace("/auth/login")
          return
        }

        // 1) Base user
        const baseUser = await api.getUser(userId) // GET /users/:id

        // Guard: only chatters can use this dashboard
        const role = String(baseUser?.role || "").toLowerCase()
        const normalizedRole = role === "employee" ? "chatter" : role
        if (normalizedRole !== "chatter") {
          router.replace("/auth/login")
          return
        }

        // 2) Chatter profile (may include currency/commission/platform fee)
        let chatter: any = null
        try {
          chatter = await api.getChatter(userId) // GET /chatters/:id
        } catch {
          // if not found, continue with defaults
        }

        // 3) Normalize to the structure your components use
        const normalizedUser = {
          id: String(baseUser.id),
          email: baseUser.email ?? baseUser.username ?? storedUser.username ?? "",
          profile: {
            id: String(baseUser.id),
            full_name:
                baseUser.fullName ??
                baseUser.full_name ??
                baseUser.name ??
                baseUser.username ??
                "Chatter",
            username: baseUser.username ?? storedUser.username ?? "",
            role: "chatter",
            currency: chatter?.currency ?? storedUser?.currency ?? "EUR",
            commission_rate:
                chatter?.commission_rate ??
                storedUser?.commissionRate ??
                0,
            platform_fee:
                chatter?.platform_fee ??
                storedUser?.platformFeeRate ??
                0,
          },
        }

        // Keep localStorage fresh for other pages
        localStorage.setItem(
            "user",
            JSON.stringify({
              id: normalizedUser.id,
              username: normalizedUser.profile.username,
              fullName: normalizedUser.profile.full_name,
              role: "chatter",
              currency: normalizedUser.profile.currency,
              commissionRate: normalizedUser.profile.commission_rate,
              platformFeeRate: normalizedUser.profile.platform_fee,
            })
        )

        if (!cancelled) {
          setUser(normalizedUser)
          setLoading(false)
        }
      } catch (e) {
        localStorage.removeItem("auth_token")
        localStorage.removeItem("user")
        router.replace("/auth/login")
      }
    }

    bootstrap()
    return () => { cancelled = true }
  }, [router])

  useEffect(() => {
    // only push if it actually changed
    if ((searchParams.get('tab') ?? 'overview') !== activeTab) {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', activeTab)
      router.replace(url.pathname + url.search)
    }
  }, [activeTab, router, searchParams])

  const handleEarningsAdded = () => setRefreshStats((p) => p + 1)

  if (loading) {
    return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
    )
  }

  if (!user) {
    return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">Please log in to access your dashboard.</p>
          </div>
        </div>
    )
  }

  return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Image src="/logo.png" alt="Logo" width={90} height={90} />
                <div className="ml-4">
                    <h1 className="text-2xl font-bold text-foreground">My Dashboard</h1>
                    <p className="text-muted-foreground">Welcome back, {user?.profile?.full_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  <User className="h-3 w-3 mr-1" />
                  Chatter
                </Badge>
                <LogoutButton />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-6">
          {/* Stats Overview */}
          <div className="mb-8">
            <EmployeeStats userId={user.id} refreshTrigger={refreshStats} />
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Clock in/out and log your earnings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <ClockInOut userId={user.id} onChange={handleClockChange} />
                  <EarningsEntry userId={user.id} onEarningsAdded={handleEarningsAdded} />
                </div>
                <div className="mt-6">
                  <WeeklyCalendar userId={user.id} refreshTrigger={refreshStats} compact />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs Navigation */}
          <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="shifts" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                My Shifts
              </TabsTrigger>
              <TabsTrigger value="earnings" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Earnings
              </TabsTrigger>
              <TabsTrigger value="leaderboard" className="flex items-center gap-2">
                <Award className="h-4 w-4" />
                Leaderboard
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Earnings</CardTitle>
                    <CardDescription>Your earnings from the last 7 days</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EmployeeEarningsHistory userId={user.id} limit={7} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Your Ranking</CardTitle>
                    <CardDescription>See how you compare to your teammates</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Leaderboard limit={5} refreshTrigger={refreshStats} />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="shifts">
              <EmployeeShifts userId={user.id} />
            </TabsContent>

            <TabsContent value="earnings">
              <EmployeeEarningsHistory userId={user.id} />
            </TabsContent>

            <TabsContent value="leaderboard">
              <Leaderboard refreshTrigger={refreshStats} />
            </TabsContent>
          </Tabs>
        </main>
      </div>
  )
}
