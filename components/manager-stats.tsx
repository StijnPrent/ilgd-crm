"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Clock, TrendingUp } from "lucide-react"
import { api } from "@/lib/api"
import { useEmployeeEarnings } from "@/hooks/use-employee-earnings"

interface Stats {
  totalChatters: number
  currentlyOnline: number
  totalEarningsDay: number
  totalEarningsWeek: number
  totalEarningsMonth: number
  dayLabel: string
}

interface ManagerStatsProps {
  monthLabel: string
  monthStart: string
  monthEnd: string
}

export function ManagerStats({ monthLabel, monthStart, monthEnd }: ManagerStatsProps) {
  const [stats, setStats] = useState<Stats>({
    totalChatters: 0,
    currentlyOnline: 0,
    totalEarningsDay: 0,
    totalEarningsWeek: 0,
    totalEarningsMonth: 0,
    dayLabel: "",
  })
  const [loading, setLoading] = useState(true)
  const { earnings } = useEmployeeEarnings()

  const monthStartDate = useMemo(() => new Date(`${monthStart}T00:00:00`), [monthStart])
  const monthEndDate = useMemo(() => new Date(`${monthEnd}T23:59:59`), [monthEnd])
  const monthKey = monthStart.slice(0, 7)

  useEffect(() => {
    if (earnings === null) return
    console.log(earnings[2])

    const calculateRealStats = async () => {
      try {
        const [chatters, onlineChatters] = await Promise.all([
          api.getChatters(),
          api.getOnlineChatters(),
        ])

        const today = new Date()
        const currentMonthKey = today.toISOString().slice(0, 7)
        const focusDate = (() => {
          if (currentMonthKey === monthKey) {
            return today
          }
          const fallback = new Date(monthEndDate)
          if (fallback < monthStartDate) return monthStartDate
          if (fallback > monthEndDate) return monthEndDate
          return fallback
        })()
        focusDate.setHours(0, 0, 0, 0)

        const focusDateIso = focusDate.toISOString().split("T")[0]
        const weekStartDate = new Date(focusDate)
        weekStartDate.setDate(focusDate.getDate() - 6)
        if (weekStartDate < monthStartDate) {
          weekStartDate.setTime(monthStartDate.getTime())
        }
        const weekStartIso = weekStartDate.toISOString().split("T")[0]

        const dayEarnings = (earnings || [])
          .filter((e: any) => (e.date || "").split("T")[0] === focusDateIso)
          .reduce((sum: number, e: any) => sum + (e.amount || 0), 0)

        const weekEarnings = (earnings || [])
          .filter((e: any) => {
            const date = (e.date || "").split("T")[0]
            return date >= weekStartIso && date <= focusDateIso
          })
          .reduce((sum: number, e: any) => sum + (e.amount || 0), 0)

        const monthEarnings = (earnings || []).reduce(
          (sum: number, e: any) => sum + (e.amount || 0),
          0,
        )

        setStats({
          totalChatters: (chatters || []).length,
          currentlyOnline: (onlineChatters || []).length,
          totalEarningsDay: dayEarnings,
          totalEarningsWeek: weekEarnings,
          totalEarningsMonth: monthEarnings,
          dayLabel: focusDate.toLocaleDateString("nl-NL", {
            weekday: "short",
            day: "numeric",
            month: "short",
          }),
        })
      } catch (err) {
        console.error("Error calculating stats:", err)
      } finally {
        setLoading(false)
      }
    }

    calculateRealStats()
  }, [earnings, monthEndDate, monthKey, monthStartDate])

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
          <CardTitle className="text-sm font-medium">Dagomzet</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(stats.totalEarningsDay)}</div>
          <p className="text-xs text-muted-foreground">voor {stats.dayLabel}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{monthLabel}</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(stats.totalEarningsMonth)}</div>
          <p className="text-xs text-muted-foreground">{formatCurrency(stats.totalEarningsWeek)} laatste 7 dagen</p>
        </CardContent>
      </Card>
    </div>
  )
}
