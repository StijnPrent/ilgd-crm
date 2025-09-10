"use client"

import { useEffect, useMemo, useState } from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { DollarSign } from "lucide-react"
import { Bar, BarChart, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { api } from "@/lib/api"

interface EarningsData {
  id: string
  date: string
  amount: number
  description: string | null
  type: string
}

interface DailyData {
  day: number
  earnings: number
  fullDate: string
  entries: EarningsData[]
}

export function EarningsOverview() {
  const [earnings, setEarnings] = useState<EarningsData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    const fetchEarnings = async () => {
      try {
        const data = await api.getEmployeeEarnings({ limit: 1000 })
        const formatted = (data || []).map((e: any) => ({
          id: String(e.id),
          date: e.date,
          amount: e.amount,
          description: e.description,
          type: e.type,
        }))
        setEarnings(formatted)
      } catch (err) {
        console.error("Error loading earnings:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchEarnings()
  }, [])

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const monthlyEarnings = useMemo(
    () =>
      earnings.filter((e) => {
        const d = new Date(e.date)
        return d.getFullYear() === year && d.getMonth() === month
      }),
    [earnings, year, month],
  )

  const dailyData: DailyData[] = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1
      const fullDate = new Date(year, month, day).toISOString().split("T")[0]
      const entries = monthlyEarnings.filter((e) =>
        e.date.startsWith(fullDate),
      )
      const total = entries.reduce((sum, e) => sum + e.amount, 0)
      return { day, earnings: total, fullDate, entries }
    })
  }, [monthlyEarnings, daysInMonth, year, month])

  const monthTotal = useMemo(
    () => dailyData.reduce((sum, d) => sum + d.earnings, 0),
    [dailyData],
  )

  const selectedEntries = useMemo(
    () =>
      selectedDate
        ? dailyData.find((d) => d.fullDate === selectedDate)?.entries || []
        : [],
    [selectedDate, dailyData],
  )

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
    }).format(amount)

  const formatFullDate = (date: string) =>
    new Date(date).toLocaleDateString("nl-NL", {
      weekday: "long",
      month: "long",
      day: "numeric",
    })

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-muted rounded" />
            <div className="h-12 bg-muted rounded" />
            <div className="h-12 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const chartConfig = {
    earnings: {
      label: "Earnings",
      color: "hsl(var(--chart-1))",
    },
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Earnings Overview
        </CardTitle>
        <CardDescription>
          Daily earnings for {now.toLocaleDateString("nl-NL", { month: "long", year: "numeric" })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ChartContainer config={chartConfig} className="h-64">
          <BarChart data={dailyData}>
            <XAxis dataKey="day" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={40} />
            <Bar
              dataKey="earnings"
              fill="var(--color-earnings)"
              onClick={(data: any) =>
                data?.payload?.fullDate &&
                setSelectedDate(data.payload.fullDate)
              }
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatCurrency(value as number)}
                />
              }
            />
          </BarChart>
        </ChartContainer>

        {selectedDate ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">
                {formatFullDate(selectedDate)}
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(null)}
              >
                Back
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedEntries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.description || "-"}</TableCell>
                    <TableCell className="capitalize">{e.type}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(e.amount)}
                    </TableCell>
                  </TableRow>
                ))}
                {selectedEntries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center">
                      No entries
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="text-sm text-muted-foreground">
              Total revenue this month
            </div>
            <div className="text-2xl font-bold">
              {formatCurrency(monthTotal)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

