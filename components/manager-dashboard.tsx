"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LogoutButton } from "@/components/logout-button"
import { ManagerStats } from "@/components/manager-stats"
import { ChattersList } from "@/components/chatters-list"
import { EarningsOverview } from "@/components/earnings-overview"
import { ShiftManager } from "@/components/shift-manager"
import { CommissionCalculator } from "@/components/commission-calculator"
import { Leaderboard } from "@/components/leaderboard"
import { CreateChatterForm } from "@/components/create-chatter-form"
import { WeeklyCalendar } from "@/components/weekly-calendar"
import { Users, DollarSign, Calendar, TrendingUp, Award, Settings, UserPlus, RotateCcw, Shield } from "lucide-react"

export function ManagerDashboard() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [managerForm, setManagerForm] = useState({
    username: "",
    password: "",
    fullName: "",
  })
  const [isCreatingManager, setIsCreatingManager] = useState(false)

  useEffect(() => {
    const userData = {
      profile: {
        full_name: "Manager Admin",
        username: "admin",
        role: "manager",
      },
    }
    setUser(userData)
    setLoading(false)
  }, [])

  const createManagerAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreatingManager(true)

    try {
      const managerCredentials = JSON.parse(localStorage.getItem("manager_credentials") || "{}")

      if (managerCredentials[managerForm.username]) {
        alert("Manager username already exists!")
        return
      }

      managerCredentials[managerForm.username] = {
        password: managerForm.password,
        fullName: managerForm.fullName,
        role: "manager",
        createdAt: new Date().toISOString(),
      }

      localStorage.setItem("manager_credentials", JSON.stringify(managerCredentials))

      console.log("[v0] New manager account created:", managerForm.username)
      alert(`Manager account '${managerForm.username}' created successfully!`)

      setManagerForm({ username: "", password: "", fullName: "" })
    } catch (error) {
      console.error("[v0] Error creating manager account:", error)
      alert("Error creating manager account. Please try again.")
    } finally {
      setIsCreatingManager(false)
    }
  }

  const resetSystem = () => {
    if (confirm("Dit zal alle chatter data wissen maar admin login behouden. Weet je het zeker?")) {
      if (confirm("LAATSTE WAARSCHUWING: Alle chatter accounts, earnings en data worden permanent gewist. Doorgaan?")) {
        const keysToRemove = ["chatters", "chatter_credentials", "employee_earnings"]

        keysToRemove.forEach((key) => {
          localStorage.removeItem(key)
        })

        console.log("[v0] System reset completed by manager - all chatter data cleared")
        alert("Systeem gereset! Alle chatter data is gewist. Je kunt nu nieuwe accounts aanmaken.")
        window.location.reload()
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
              <h1 className="text-2xl font-bold text-foreground">Manager Dashboard</h1>
              <p className="text-muted-foreground">Welcome back, {user?.profile?.full_name}</p>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <Settings className="h-3 w-3 mr-1" />
                Manager
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={resetSystem}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 bg-transparent"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset System
              </Button>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Stats Overview */}
        <div className="mb-8">
          <ManagerStats />
        </div>

        {/* Tabs Navigation */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="accounts" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Accounts
            </TabsTrigger>
            <TabsTrigger value="chatters" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Chatters
            </TabsTrigger>
            <TabsTrigger value="earnings" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Earnings
            </TabsTrigger>
            <TabsTrigger value="shifts" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Shifts
            </TabsTrigger>
            <TabsTrigger value="commissions" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Commissions
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              Leaderboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="mb-6">
              <WeeklyCalendar showChatterNames={true} compact={true} />
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest earnings and clock-ins from your team</CardDescription>
                </CardHeader>
                <CardContent>
                  <EarningsOverview limit={5} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Top Performers</CardTitle>
                  <CardDescription>This week's highest earners</CardDescription>
                </CardHeader>
                <CardContent>
                  <Leaderboard limit={5} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="accounts">
            <div className="grid gap-6 md:grid-cols-2">
              <CreateChatterForm />
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Create Manager Account
                  </CardTitle>
                  <CardDescription>Create new manager accounts with full dashboard access</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={createManagerAccount} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="manager-username">Username</Label>
                      <Input
                        id="manager-username"
                        type="text"
                        placeholder="Enter manager username"
                        value={managerForm.username}
                        onChange={(e) => setManagerForm({ ...managerForm, username: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manager-fullname">Full Name</Label>
                      <Input
                        id="manager-fullname"
                        type="text"
                        placeholder="Enter full name"
                        value={managerForm.fullName}
                        onChange={(e) => setManagerForm({ ...managerForm, fullName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manager-password">Password</Label>
                      <Input
                        id="manager-password"
                        type="password"
                        placeholder="Enter password"
                        value={managerForm.password}
                        onChange={(e) => setManagerForm({ ...managerForm, password: e.target.value })}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isCreatingManager}>
                      {isCreatingManager ? "Creating..." : "Create Manager Account"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Account Management</CardTitle>
                  <CardDescription>Manage chatter accounts and permissions</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChattersList showActions={true} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="chatters">
            <ChattersList />
          </TabsContent>

          <TabsContent value="earnings">
            <EarningsOverview />
          </TabsContent>

          <TabsContent value="shifts">
            <ShiftManager />
          </TabsContent>

          <TabsContent value="commissions">
            <CommissionCalculator />
          </TabsContent>

          <TabsContent value="leaderboard">
            <Leaderboard />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
