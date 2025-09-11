"use client"

import { useEffect, useState } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { api } from "@/lib/api"

interface ModelEarnings {
  id: string
  displayName: string
  username: string
  totalEarnings: number
}

export function ModelsEarningsLeaderboard() {
  const [models, setModels] = useState<ModelEarnings[]>([])

  useEffect(() => {
    fetchEarnings()
  }, [])

  const fetchEarnings = async () => {
    try {
      const data = await api.getModelsWithEarnings()
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
        <CardDescription>Total earnings before commissions</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Username</TableHead>
              <TableHead className="text-right">Total Earnings</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.map((model) => (
              <TableRow key={model.id}>
                <TableCell className="font-medium">{model.displayName}</TableCell>
                <TableCell>{model.username}</TableCell>
                <TableCell className="text-right">{formatCurrency(model.totalEarnings)}</TableCell>
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

