"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DollarSign, Calendar, User } from "lucide-react"
import { api } from "@/lib/api"
import { useEmployeeEarnings } from "@/hooks/use-employee-earnings"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface EarningsOverviewProps {
  limit?: number
}

interface EarningsData {
  id: string
  date: string
  amount: number
  description: string | null
  chatterId: string
  chatter: {
    full_name: string
  }
}

export function EarningsOverview({ limit }: EarningsOverviewProps) {
  const [earnings, setEarnings] = useState<EarningsData[]>([])
  const [loading, setLoading] = useState(true)
  const [totalToday, setTotalToday] = useState(0)
  const [totalWeek, setTotalWeek] = useState(0)

  const { earnings: allEarnings, refresh } = useEmployeeEarnings()
  const [chatters, setChatters] = useState<{ id: string; full_name: string }[]>([])

  useEffect(() => {
    if (allEarnings === null) return
    fetchEarnings()
  }, [allEarnings])

  const fetchEarnings = async () => {
    try {
      const [chattersData, usersData] = await Promise.all([
        api.getChatters(),
        api.getUsers(),
      ])

      const userMap = new Map(
          (usersData || []).map((u: any) => [
            String(u.id),
            u.fullName || "",
          ]),
      )

      const activeChatters = (chattersData || []).filter(
        (ch: any) => ch.status !== "inactive",
      )
      const activeChattersMap = new Map(
        activeChatters.map((ch: any) => [String(ch.id), userMap.get(String(ch.id))]),
      )
      setChatters([
        { id: "unknown", full_name: "Unknown chatter" },
        ...activeChatters.map((ch: any) => ({
          id: String(ch.id),
          full_name: userMap.get(String(ch.id)) || "",
        })),
      ])

      const validEarnings = (allEarnings || []).filter(
        (earning: any) =>
          !earning.chatterId || activeChattersMap.has(String(earning.chatterId)),
      )

      const formattedEarnings = validEarnings
        .map((earning: any) => {
          const chatterId = earning.chatterId
            ? String(earning.chatterId)
            : "unknown"
          const full_name = earning.chatterId
            ? activeChattersMap.get(String(earning.chatterId)) || "Unknown chatter"
            : "Unknown chatter"
          return {
            id: String(earning.id),
            date: earning.date,
            amount: earning.amount,
            description: earning.description,
            chatterId,
            chatter: { full_name },
          }
        })
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

  const handleChatterChange = async (earningId: string, chatterId: string) => {
    try {
      await api.updateEmployeeEarning(earningId, {
        chatterId: chatterId === "unknown" ? null : chatterId,
      })
      await refresh()
    } catch (error) {
      console.error("Error updating earning:", error)
    }
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
                  {limit ? (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {earning.chatter.full_name}
                    </div>
                  ) : (
                    <Select
                      value={earning.chatterId}
                      onValueChange={(value) => handleChatterChange(earning.id, value)}
                    >
                      <SelectTrigger className="w-[200px]">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {chatters.map((chatter) => (
                          <SelectItem key={chatter.id} value={chatter.id}>
                            {chatter.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
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
