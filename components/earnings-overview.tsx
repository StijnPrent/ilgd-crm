"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DollarSign, Calendar, User } from "lucide-react"
import { api } from "@/lib/api"

interface EarningsOverviewProps {
  limit?: number
}

interface EarningsData {
  id: string
  date: string
  amount: number
  description: string | null
  chatter: {
    full_name: string
  }
}

export function EarningsOverview({ limit }: EarningsOverviewProps) {
  const [earnings, setEarnings] = useState<EarningsData[]>([])
  const [loading, setLoading] = useState(true)
  const [totalToday, setTotalToday] = useState(0)
  const [totalWeek, setTotalWeek] = useState(0)

  useEffect(() => {
    fetchEarnings()
  }, [])

  const fetchEarnings = async () => {
    try {
      const [earningsData, chattersData, usersData] = await Promise.all([
        api.getEmployeeEarnings(),
        api.getChatters(),
        api.getUsers(),
      ])

      const userMap = new Map(
        (usersData || []).map((u: any) => [
          String(u.id),
          u.fullName || u.full_name || "",
        ]),
      )

      const activeChattersMap = new Map(
        (chattersData || [])
          .filter((ch: any) => ch.status !== "inactive")
          .map((ch: any) => [String(ch.id), userMap.get(String(ch.user_id || ch.userId))]),
      )

      const validEarnings = (earningsData || []).filter((earning: any) =>
        activeChattersMap.has(String(earning.chatter_id)),
      )

      const formattedEarnings = validEarnings
        .map((earning: any) => ({
          id: String(earning.id),
          date: earning.date,
          amount: earning.amount,
          description: earning.description,
          chatter: {
            full_name: activeChattersMap.get(String(earning.chatter_id)),
          },
        }))
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())

      const limitedEarnings = limit ? formattedEarnings.slice(0, limit) : formattedEarnings
      setEarnings(limitedEarnings)

      const today = new Date().toISOString().split("T")[0]
      const todayTotal = formattedEarnings
        .filter((e: any) => e.date === today)
        .reduce((sum: number, e: any) => sum + (e.amount || 0), 0)

      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      const weekStartStr = weekStart.toISOString().split("T")[0]

      const weekTotal = formattedEarnings
        .filter((e: any) => e.date >= weekStartStr)
        .reduce((sum: number, e: any) => sum + (e.amount || 0), 0)

      setTotalToday(todayTotal)
      setTotalWeek(weekTotal)
    } catch (error) {
      console.error("Error fetching earnings:", error)
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

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("nl-NL", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(limit || 10)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded"></div>
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
          <DollarSign className="h-5 w-5" />
          Earnings Overview
        </CardTitle>
        <CardDescription>{limit ? `Latest ${limit} earnings entries` : "All earnings entries"}</CardDescription>

        {!limit && (
          <div className="flex gap-4 mt-4">
            <Badge variant="outline" className="bg-green-50 text-green-700">
              Today: {formatCurrency(totalToday)}
            </Badge>
            <Badge variant="outline" className="bg-blue-50 text-blue-700">
              This Week: {formatCurrency(totalWeek)}
            </Badge>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Chatter</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {earnings.map((earning) => (
              <TableRow key={earning.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {formatDate(earning.date)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {earning.chatter.full_name}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 font-semibold">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    {formatCurrency(earning.amount)}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-muted-foreground">{earning.description || "No description"}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {earnings.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No earnings recorded yet.</p>
            <p className="text-sm">Earnings will appear here once chatters start logging them.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
