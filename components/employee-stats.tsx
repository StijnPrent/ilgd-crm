"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, TrendingUp, Calendar, Award } from "lucide-react"
// import { api } from "@/lib/api" // ← uncomment when your backend is ready

interface EmployeeStatsProps {
  userId: string
  refreshTrigger?: number
}

interface Stats {
  todayEarnings: number
  weekEarnings: number
  monthEarnings: number
  totalEarnings: number
  currentRank: number
  estimatedCommission: number
  currency: string
  commissionRate: number
  platformFee: number
}

export function EmployeeStats({ userId, refreshTrigger }: EmployeeStatsProps) {
  const [stats, setStats] = useState<Stats>({
    todayEarnings: 0,
    weekEarnings: 0,
    monthEarnings: 0,
    totalEarnings: 0,
    currentRank: 0,
    estimatedCommission: 0,
    currency: "EUR",
    commissionRate: 8,
    platformFee: 20,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return

    const fetchStats = async () => {
      try {
        // ---- Replace this block with your backend call when ready ----
        // const backend = await api.getEmployeeStats(userId)
        // const { todayTotal, weekTotal, monthTotal, allTimeTotal, currency, commissionRate, platformFee, currentRank } = backend

        const earningsData = localStorage.getItem("employee_earnings")
        const allEarnings: any[] = earningsData ? JSON.parse(earningsData) : []

        const chattersData = localStorage.getItem("chatters")
        const chatters = chattersData ? JSON.parse(chattersData) : []
        const currentChatter = chatters.find((c: any) => c.id === userId)

        const userEarnings = allEarnings.filter((e: any) => e.chatter_id === userId)

        // date helpers
        const toISODate = (d: Date) => d.toISOString().split("T")[0]
        const today = toISODate(new Date())

        const weekStart = new Date()
        weekStart.setHours(0, 0, 0, 0)
        weekStart.setDate(weekStart.getDate() - weekStart.getDay()) // Sunday-start; adjust if you want Monday

        const monthStart = new Date()
        monthStart.setHours(0, 0, 0, 0)
        monthStart.setDate(1)

        // filters
        const todayEarnings = userEarnings.filter((e) => e.date === today)
        const weekEarnings = userEarnings.filter((e) => e.date >= toISODate(weekStart))
        const monthEarnings = userEarnings.filter((e) => e.date >= toISODate(monthStart))

        // totals
        const todayTotal = todayEarnings.reduce((sum, e) => sum + Number(e.amount), 0)
        const weekTotal = weekEarnings.reduce((sum, e) => sum + Number(e.amount), 0)
        const monthTotal = monthEarnings.reduce((sum, e) => sum + Number(e.amount), 0)
        const allTimeTotal = userEarnings.reduce((sum, e) => sum + Number(e.amount), 0)

        const currency = currentChatter?.currency || "EUR"
        const commissionRate = currentChatter?.commission_rate ?? 8
        const platformFee = currentChatter?.platform_fee ?? 20

        // commission = % over revenue (no platform fee deduction, per your note)
        const estimatedCommission = monthTotal * (commissionRate / 100)

        // ranking (by month)
        let currentRank = 1
        try {
          const chattersForRanking = chatters as any[]
          const monthStartISO = toISODate(monthStart)

          const allChattersEarnings = chattersForRanking.map((ch) => {
            const chMonthTotal = allEarnings
                .filter((e) => e.chatter_id === ch.id && e.date >= monthStartISO)
                .reduce((sum, e) => sum + Number(e.amount), 0)
            return { id: ch.id, name: ch.full_name, monthTotal: chMonthTotal }
          })

          allChattersEarnings.sort((a, b) => b.monthTotal - a.monthTotal)
          const idx = allChattersEarnings.findIndex((c) => c.id === userId)
          currentRank = idx >= 0 ? idx + 1 : allChattersEarnings.length + 1
        } catch {
          currentRank = 1
        }

        setStats({
          todayEarnings: todayTotal,
          weekEarnings: weekTotal,
          monthEarnings: monthTotal,
          totalEarnings: allTimeTotal,
          currentRank,
          estimatedCommission,
          currency,
          commissionRate,
          platformFee,
        })
      } catch (err) {
        console.error("Error fetching employee stats:", err)
      } finally {
        setLoading(false)
      }
    }

    setTimeout(fetchStats, 500)
  }, [userId, refreshTrigger])

  const formatCurrency = (amount: number) => {
    const map: Record<string, string> = { "€": "EUR", "$": "USD", "£": "GBP", EUR: "EUR", USD: "USD", GBP: "GBP" }
    const currencyCode = map[stats.currency] || "EUR"
    return new Intl.NumberFormat("nl-NL", { style: "currency", currency: currencyCode }).format(amount)
  }

  if (loading) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-2">
                    <div className="h-4 bg-muted rounded w-1/2" />
                    <div className="h-8 bg-muted rounded w-3/4" />
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
            <CardTitle className="text-sm font-medium">Today's Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.todayEarnings)}</div>
            <p className="text-xs text-muted-foreground">Revenue generated today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.weekEarnings)}</div>
            <p className="text-xs text-muted-foreground">Weekly performance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Commission</CardTitle>
            <Calendar className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.estimatedCommission)}</div>
            <p className="text-xs text-muted-foreground">From {formatCurrency(stats.monthEarnings)} revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Rank</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">#{stats.currentRank || "N/A"}</div>
            <p className="text-xs text-muted-foreground">Team leaderboard position</p>
          </CardContent>
        </Card>
      </div>
  )
}
