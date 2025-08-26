"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, Medal, Award, DollarSign } from "lucide-react"
import { api } from "@/lib/api"

interface LeaderboardEntry {
  id: string
  full_name: string
  total_earnings: number
  week_earnings: number
  month_earnings: number
  rank: number
}

interface LeaderboardProps {
  limit?: number
  refreshTrigger?: number
}

export function Leaderboard({ limit, refreshTrigger }: LeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeaderboard()
  }, [refreshTrigger])

  const fetchLeaderboard = async () => {
    try {
      const [earningsData, chattersData] = await Promise.all([
        api.getEmployeeEarnings(),
        api.getChatters(),
      ])

      const leaderboardData = (chattersData || []).map((chatter: any) => {
        const chatterEarnings = (earningsData || []).filter(
          (earning: any) => String(earning.chatter_id) === String(chatter.id),
        )

        const now = new Date()
        const startOfWeek = new Date(now)
        startOfWeek.setDate(now.getDate() - now.getDay())
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

        const weekEarnings = chatterEarnings
          .filter((earning: any) => new Date(earning.date) >= startOfWeek)
          .reduce((sum: number, earning: any) => sum + (earning.amount || 0), 0)

        const monthEarnings = chatterEarnings
          .filter((earning: any) => new Date(earning.date) >= startOfMonth)
          .reduce((sum: number, earning: any) => sum + (earning.amount || 0), 0)

        const totalEarnings = chatterEarnings.reduce(
          (sum: number, earning: any) => sum + (earning.amount || 0),
          0,
        )

        return {
          id: String(chatter.id),
          full_name: chatter.full_name,
          total_earnings: totalEarnings,
          week_earnings: weekEarnings,
          month_earnings: monthEarnings,
          rank: 0,
        }
      })

      const sortedData = leaderboardData
        .sort((a, b) => b.month_earnings - a.month_earnings)
        .map((entry, index) => ({ ...entry, rank: index + 1 }))

      const limitedData = limit ? sortedData.slice(0, limit) : sortedData
      setLeaderboard(limitedData)
    } catch (error) {
      console.error("Error fetching leaderboard:", error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
    }).format(amount)
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />
      default:
        return <span className="text-sm font-bold text-muted-foreground">#{rank}</span>
    }
  }

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return <Badge className="bg-yellow-100 text-yellow-800">1st Place</Badge>
      case 2:
        return <Badge className="bg-gray-100 text-gray-800">2nd Place</Badge>
      case 3:
        return <Badge className="bg-amber-100 text-amber-800">3rd Place</Badge>
      default:
        return <Badge variant="outline">#{rank}</Badge>
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(limit || 10)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Leaderboard
        </CardTitle>
        <CardDescription>Top performing chatters ranked by monthly earnings</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {leaderboard.map((entry) => (
            <div
              key={entry.id}
              className={`flex items-center justify-between p-4 rounded-lg border ${
                entry.rank <= 3 ? "bg-muted/50" : "bg-background"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-10 h-10">{getRankIcon(entry.rank)}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{entry.full_name}</h3>
                    {entry.rank <= 3 && getRankBadge(entry.rank)}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Week: {formatCurrency(entry.week_earnings)}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-lg font-bold">
                  <DollarSign className="h-4 w-4" />
                  {formatCurrency(entry.month_earnings)}
                </div>
                <div className="text-sm text-muted-foreground">Monthly Earnings</div>
              </div>
            </div>
          ))}
        </div>

        {leaderboard.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No earnings data available yet. Chatters need to start logging their earnings.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
