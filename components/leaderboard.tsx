"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, Medal, Award, DollarSign } from "lucide-react"
import { api } from "@/lib/api"

interface LeaderboardEntry {
  chatterId: string
  chatterName: string
  weeklyAmount: number
  monthlyAmount: number
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
      const data = await api.getEmployeeEarningsLeaderboard()
      const limitedData = limit ? (data || []).slice(0, limit) : data || []
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
              key={entry.chatterId}
              className={`flex items-center justify-between p-4 rounded-lg border ${
                entry.rank <= 3 ? "bg-muted/50" : "bg-background"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-10 h-10">{getRankIcon(entry.rank)}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{entry.chatterName}</h3>
                    {entry.rank <= 3 && getRankBadge(entry.rank)}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Week: {formatCurrency(entry.weeklyAmount)}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-lg font-bold">
                  <DollarSign className="h-4 w-4" />
                  {formatCurrency(entry.monthlyAmount)}
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
