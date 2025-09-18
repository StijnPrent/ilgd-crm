"use client"

import { useEffect, useState } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { api } from "@/lib/api"
import {Crown, User } from "lucide-react"

interface ModelEarnings {
  id: string
  displayName: string
  username: string
  totalEarnings: number
}

interface ModelsEarningsLeaderboardProps {
  monthStart?: string
  monthEnd?: string
  monthLabel?: string
}

export function ModelsEarningsLeaderboard({ monthStart, monthEnd, monthLabel }: ModelsEarningsLeaderboardProps) {
  const [models, setModels] = useState<ModelEarnings[]>([])

  useEffect(() => {
    fetchEarnings()
  }, [monthEnd, monthStart])

  const fetchEarnings = async () => {
    try {
      const data = await api.getModelsWithEarnings({ from: monthStart, to: monthEnd })
      const parsed = (data || []).map((m: any) => ({
        id: String(m.id),
        displayName: m.displayName,
        username: m.username,
        totalEarnings: m.totalEarnings || 0,
      }))
      parsed.sort((a, b) => b.totalEarnings - a.totalEarnings)
      setModels(parsed)
    } catch (err) {
      console.error("Error fetching model earnings:", err)
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(amount)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Model Earnings Leaderboard</CardTitle>
        <CardDescription>
          Totale omzet voor {monthLabel ?? "deze maand"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='font-bold'>Name</TableHead>
              <TableHead className="text-right font-bold">Total Earnings</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.map((model, index) => (
                <TableRow key={model.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    {index === 0 ? (
                        <Crown className="w-4 h-4 text-yellow-500" />
                    ) : (
                        <User className="w-4 h-4 text-gray-500" />
                    )}
                    {model.displayName}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(model.totalEarnings)}
                  </TableCell>
                </TableRow>
            ))}
          </TableBody>
        </Table>
        {models.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No earnings data available yet.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

