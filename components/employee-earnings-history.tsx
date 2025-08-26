"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Calendar } from "lucide-react"
import { api } from "@/lib/api"

interface EmployeeEarningsHistoryProps {
  userId: string
  limit?: number
}

interface Earning {
  id: string
  date: string
  amount: number
  description: string | null
}

export function EmployeeEarningsHistory({ userId, limit }: EmployeeEarningsHistoryProps) {
  const [earnings, setEarnings] = useState<Earning[]>([])
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState("EUR")

  useEffect(() => {
    if (!userId) return

    const fetchEarnings = async () => {
      try {
        const [earningsData, chatter] = await Promise.all([
          api.getEmployeeEarnings(),
          api.getChatter(userId).catch(() => null),
        ])

        const userEarnings = (earningsData || [])
          .filter((e: any) => String(e.chatterId) === String(userId))
          .map((e: any) => ({
            id: String(e.id),
            date: e.date,
            amount: e.amount,
            description: e.description,
          }))
          .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())

        setCurrency(chatter?.currency || "EUR")

        setEarnings(limit ? userEarnings.slice(0, limit) : userEarnings)
      } catch (error) {
        console.error("Error fetching earnings:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchEarnings()
  }, [userId, limit])

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("nl-NL", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(limit || 10)].map((_, i) => (
          <div key={i} className="h-12 bg-muted rounded"></div>
        ))}
      </div>
    )
  }

  if (!limit) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Earnings History
          </CardTitle>
          <CardDescription>Your complete earnings record</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {earnings.map((earning) => (
              <div key={earning.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{formatDate(earning.date)}</div>
                    {earning.description && <div className="text-sm text-muted-foreground">{earning.description}</div>}
                  </div>
                </div>
                <div className="text-lg font-semibold">€{earning.amount}</div>
              </div>
            ))}
          </div>

          {earnings.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No earnings recorded yet.</p>
              <p className="text-sm">Start logging your daily earnings to track your progress.</p>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {earnings.map((earning) => (
        <div key={earning.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{formatDate(earning.date)}</span>
          </div>
          <span className="font-semibold">€{earning.amount}</span>
        </div>
      ))}

      {earnings.length === 0 && (
        <div className="text-center py-6 text-muted-foreground">
          <p className="text-sm">No recent earnings to display.</p>
        </div>
      )}
    </div>
  )
}
