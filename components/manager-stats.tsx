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

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("nl-NL", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  }

  useEffect(() => {
    if (earnings === null) return
    console.log(earnings[2])

    const calculateRealStats = async () => {
      try {
        const [chatters, onlineChatters] = await Promise.all([
          api.getChatters(),
          api.getOnlineChatters(),
        ])
        const TZ = "Europe/Amsterdam";
        const ymdFmt = new Intl.DateTimeFormat("en-CA", {
          timeZone: TZ,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
        const toYMD = (d: Date | string) => ymdFmt.format(new Date(d));

        const nowLocal = new Date(new Date().toLocaleString("en-US", {timeZone: TZ}));

        const weekStartLocal = new Date(nowLocal);
        weekStartLocal.setHours(0, 0, 0, 0);
        const mondayIndex = (weekStartLocal.getDay() + 6) % 7;
        weekStartLocal.setDate(weekStartLocal.getDate() - mondayIndex);

        const monthStartLocal = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), 1);
        monthStartLocal.setHours(0, 0, 0, 0);

        const today = toYMD(nowLocal);
        const weekStartYMD = toYMD(weekStartLocal);
        const monthStartYMD = toYMD(monthStartLocal);

        const normalized = (earnings || []).map((e: any) => ({
          ...e,
          _ymd: toYMD(e.date || e.createdAt),
          _amount: Number(e.amount) || 0,
        }));

        const todayTotal = normalized
            .filter(e => e._ymd === today)
            .reduce((sum, e) => sum + e._amount, 0);

        const weekTotal = normalized
            .filter(e => e._ymd >= weekStartYMD)
            .reduce((sum, e) => sum + e._amount, 0);

        const monthTotal = normalized
            .filter(e => e._ymd >= monthStartYMD)
            .reduce((sum, e) => sum + e._amount, 0);

        setStats({
          totalChatters: (chatters || []).length,
          currentlyOnline: (onlineChatters || []).length,
          totalEarningsToday: todayTotal,
          totalEarningsWeek: weekTotal,
          totalEarningsMonth: monthTotal,
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
