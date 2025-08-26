"use client"

import { useEffect, useState } from "react"
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
import { EmployeeEarningsHistory } from "@/components/employee-earnings-history"
import { WeeklyCalendar } from "@/components/weekly-calendar"

export function EmployeeDashboard() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshStats, setRefreshStats] = useState(0)

  useEffect(() => {
    const getUser = () => {
      console.log("[v0] EmployeeDashboard: Getting user from localStorage")

      const userData = localStorage.getItem("user")
      if (userData) {
        const parsedUser = JSON.parse(userData)
        console.log("[v0] EmployeeDashboard: User found:", parsedUser)

        // Create mock user profile based on stored session
        const mockUser = {
          id: parsedUser.id || "chatter-1",
          email: parsedUser.username,
          profile: {
            id: parsedUser.id || "chatter-1",
            full_name: parsedUser.username === "wolf@test.com" ? "Wolf Test" : "Chatter User",
            username: parsedUser.username,
            role: "chatter",
            currency: "€",
            commission_rate: 8.0,
            platform_fee: 20.0,
          },
        }

        setUser(mockUser)
        console.log("[v0] EmployeeDashboard: Mock user created:", mockUser)
      } else {
        console.log("[v0] EmployeeDashboard: No user session found, redirecting to login")
        window.location.href = "/auth/login"
      }

      setLoading(false)
    }

    getUser()
  }, [])

  const handleEarningsAdded = () => {
    console.log("[v0] EmployeeDashboard: Earnings added, refreshing stats")
    setRefreshStats((prev) => prev + 1)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">My Dashboard</h1>
              <p className="text-muted-foreground">Welcome back, {user?.profile?.full_name}</p>
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
          <EmployeeStats userId={user?.id} refreshTrigger={refreshStats} />
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
                <ClockInOut userId={user?.id} />
                <EarningsEntry userId={user?.id} onEarningsAdded={handleEarningsAdded} />
              </div>
              <div className="mt-6">
                <WeeklyCalendar userId={user?.id} compact={true} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs Navigation */}
        <Tabs defaultValue="overview" className="space-y-6">
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
                  <EmployeeEarningsHistory userId={user?.id} limit={7} />
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
            <EmployeeShifts userId={user?.id} />
          </TabsContent>

          <TabsContent value="earnings">
            <EmployeeEarningsHistory userId={user?.id} />
          </TabsContent>

          <TabsContent value="leaderboard">
            <Leaderboard refreshTrigger={refreshStats} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
