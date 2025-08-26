"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Calendar } from "lucide-react"

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

  useEffect(() => {
    if (!userId) return

    const fetchEarnings = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 500))

        const storedEarnings = localStorage.getItem(`earnings_${userId}`)
        let userEarnings: Earning[] = []

        if (storedEarnings) {
          userEarnings = JSON.parse(storedEarnings)
        } else {
          userEarnings = [
            {
              id: "1",
              date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
              amount: 125.5,
              description: "Daily chat earnings",
            },
            {
              id: "2",
              date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
              amount: 98.75,
              description: "Daily chat earnings",
            },
            {
              id: "3",
              date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
              amount: 156.25,
              description: "Daily chat earnings",
            },
            {
              id: "4",
              date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
              amount: 89.5,
              description: "Daily chat earnings",
            },
            {
              id: "5",
              date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
              amount: 134.75,
              description: "Daily chat earnings",
            },
          ]

          localStorage.setItem(`earnings_${userId}`, JSON.stringify(userEarnings))
        }

        userEarnings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

        if (limit) {
          userEarnings = userEarnings.slice(0, limit)
        }

        setEarnings(userEarnings)
      } catch (error) {
        console.error("Error fetching earnings:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchEarnings()
  }, [userId, limit])

  const formatCurrency = (amount: number) => {
    const user = JSON.parse(localStorage.getItem("user") || "{}")
    const chatters = JSON.parse(localStorage.getItem("chatters") || "[]")
    const currentChatter = chatters.find((c: any) => c.id === userId)
    const currency = currentChatter?.currency || "EUR"

    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: currency,
    }).format(amount)
  }

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
                <div className="text-lg font-semibold">{formatCurrency(earning.amount)}</div>
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
          <span className="font-semibold">{formatCurrency(earning.amount)}</span>
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
