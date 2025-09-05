"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, DollarSign, Clock, TrendingUp } from "lucide-react"
import { api } from "@/lib/api"
import { useEmployeeEarnings } from "@/hooks/use-employee-earnings"

interface Stats {
  totalChatters: number
  currentlyOnline: number
  totalEarningsToday: number
  totalEarningsWeek: number
  totalEarningsMonth: number
}

export function ManagerStats() {
  const [stats, setStats] = useState<Stats>({
    totalChatters: 0,
    currentlyOnline: 0,
    totalEarningsToday: 0,
    totalEarningsWeek: 0,
    totalEarningsMonth: 0,
  })
  const [loading, setLoading] = useState(true)
  const { earnings } = useEmployeeEarnings()

  useEffect(() => {
    console.log("earnings changed:", earnings)
    if (earnings === null) return

    const calculateRealStats = async () => {
      try {
        const chatters = await api.getChatters()

        const today = new Date().toISOString().split("T")[0]
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
        const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

        const todayEarnings = (earnings || [])
          .filter((e: any) => e.date.split("T")[0] === today)
          .reduce((sum: number, e: any) => sum + (e.amount || 0), 0)

        const weekEarnings = (earnings || [])
          .filter((e: any) => e.date.split("T")[0] >= oneWeekAgo)
          .reduce((sum: number, e: any) => sum + (e.amount || 0), 0)

        const monthEarnings = (earnings || [])
          .filter((e: any) => e.date.split("T")[0] >= oneMonthAgo)
          .reduce((sum: number, e: any) => sum + (e.amount || 0), 0)

        const onlineCount = Math.floor((chatters?.length || 0) * 0.4)

        setStats({
          totalChatters: (chatters || []).length,
          currentlyOnline: onlineCount,
          totalEarningsToday: todayEarnings,
          totalEarningsWeek: weekEarnings,
          totalEarningsMonth: monthEarnings,
        })
      } catch (err) {
        console.error("Error calculating stats:", err)
      } finally {
        setLoading(false)
      }
    }

    calculateRealStats()
  }, [earnings])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-8 bg-muted rounded w-3/4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Chatters</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalChatters}</div>
          <p className="text-xs text-muted-foreground">Active employees</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Currently clocked-in</CardTitle>
          <Clock className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{stats.currentlyOnline}</div>
          <p className="text-xs text-muted-foreground">Clocked in now</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Today's Earnings</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(stats.totalEarningsToday)}</div>
          <p className="text-xs text-muted-foreground">Total revenue today</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">This Month</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(stats.totalEarningsMonth)}</div>
          <p className="text-xs text-muted-foreground">+{formatCurrency(stats.totalEarningsWeek)} this week</p>
        </CardContent>
      </Card>
    </div>
  )
}
