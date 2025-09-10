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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { DollarSign, X } from "lucide-react"
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { api } from "@/lib/api"

interface RevenueEntry {
  id: string
  date: string
  amount: number
  modelCommissionRate: number
  chatterCommissionRate: number
}

interface DailyData {
  day: number
  revenue: number
  fullDate: string
  entries: RevenueEntry[]
}

export function RevenueOverview() {
  const [entries, setEntries] = useState<RevenueEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [platformFee, setPlatformFee] = useState(20)
  const [adjustments, setAdjustments] = useState<number[]>([])
  const [hoveredBar, setHoveredBar] = useState<number | null>(null)

  useEffect(() => {
    const fetchRevenue = async () => {
      try {
        const data = await api.getRevenueEarnings()
        const formatted = (data || []).map((e: any) => ({
          id: String(e.id),
          date: e.date || e.created_at,
          amount: Number(e.amount ?? 0),
          modelCommissionRate: Number(
            e.modelCommissionRate ?? e.model_commission_rate ?? 0,
          ),
          chatterCommissionRate: Number(
            e.chatterCommissionRate ?? e.chatter_commission_rate ?? 0,
          ),
        }))
        setEntries(formatted)
      } catch (err) {
        console.error("Failed to load revenue earnings:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchRevenue()
  }, [])

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const monthlyEntries = useMemo(
    () =>
      entries.filter((e) => {
        const d = new Date(e.date)
        return d.getFullYear() === year && d.getMonth() === month
      }),
    [entries, year, month],
  )

  const dailyData: DailyData[] = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1
      const fullDate = new Date(year, month, day)
        .toISOString()
        .split("T")[0]
      const dayEntries = monthlyEntries.filter((e) =>
        e.date.startsWith(fullDate),
      )
      const revenue = dayEntries.reduce((sum, e) => {
        const amount = Number(e.amount)
        const net = amount * (1 - platformFee / 100)
        const mComm = net * (e.modelCommissionRate / 100)
        const cComm = net * (e.chatterCommissionRate / 100)
        return sum + (net - mComm - cComm)
      }, 0)
      return { day, revenue, fullDate, entries: dayEntries }
    })
  }, [monthlyEntries, daysInMonth, year, month, platformFee])

  const monthTotals = useMemo(() => {
    return monthlyEntries.reduce(
      (acc, e) => {
        const amount = Number(e.amount)
        const net = amount * (1 - platformFee / 100)
        const mComm = net * (e.modelCommissionRate / 100)
        const cComm = net * (e.chatterCommissionRate / 100)
        acc.total += amount
        acc.platformFee += amount - net
        acc.afterPlatform += net
        acc.modelCommission += mComm
        acc.chatterCommission += cComm
        return acc
      },
      {
        total: 0,
        platformFee: 0,
        afterPlatform: 0,
        modelCommission: 0,
        chatterCommission: 0,
      },
    )
  }, [monthlyEntries, platformFee])

  const companyRevenue =
    monthTotals.afterPlatform -
    monthTotals.modelCommission -
    monthTotals.chatterCommission
  const adjustmentsTotal = adjustments.reduce(
    (sum, val) => sum + (val || 0),
    0,
  )
  const finalRevenue = companyRevenue + adjustmentsTotal

  const selectedEntries = selectedDate
    ? dailyData.find((d) => d.fullDate === selectedDate)?.entries || []
    : []

  const dayTotals = useMemo(() => {
    return selectedEntries.reduce(
      (acc, e) => {
        const amount = Number(e.amount)
        const net = amount * (1 - platformFee / 100)
        const mComm = net * (e.modelCommissionRate / 100)
        const cComm = net * (e.chatterCommissionRate / 100)
        acc.total += amount
        acc.platformFee += amount - net
        acc.afterPlatform += net
        acc.modelCommission += mComm
        acc.chatterCommission += cComm
        return acc
      },
      {
        total: 0,
        platformFee: 0,
        afterPlatform: 0,
        modelCommission: 0,
        chatterCommission: 0,
      },
    )
  }, [selectedEntries, platformFee])

  const dayCompanyRevenue =
    dayTotals.afterPlatform -
    dayTotals.modelCommission -
    dayTotals.chatterCommission

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
    }).format(Number.isFinite(amount) ? amount : 0)

  const formatFullDate = (date: string) =>
    new Date(date).toLocaleDateString("nl-NL", {
      weekday: "long",
      month: "long",
      day: "numeric",
    })

  const addAdjustment = () => setAdjustments([...adjustments, 0])
  const updateAdjustment = (index: number, value: number) => {
    const newAdjustments = [...adjustments]
    newAdjustments[index] = value
    setAdjustments(newAdjustments)
  }
  const removeAdjustment = (index: number) => {
    setAdjustments(adjustments.filter((_, i) => i !== index))
  }

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
    revenue: {
      label: "Revenue",
      color: "#6CE8F2",
    },
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Revenue Overview
        </CardTitle>
        <CardDescription>
          Company revenue for {" "}
          {now.toLocaleDateString("nl-NL", { month: "long", year: "numeric" })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ChartContainer
          config={chartConfig}
          className="h-64 w-full aspect-auto"
        >
          <BarChart data={dailyData}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6CE8F2" />
                <stop offset="100%" stopColor="#FFA6FF" />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={40} />
            <Bar dataKey="revenue">
              {dailyData.map((d, idx) => (
                <Cell
                  key={d.day}
                  cursor="pointer"
                  fill="url(#revenueGradient)"
                  fillOpacity={hoveredBar === idx ? 0 : 1}
                  onMouseEnter={() => setHoveredBar(idx)}
                  onMouseLeave={() => setHoveredBar(null)}
                  onClick={() => {
                    setSelectedDate(d.fullDate)
                    setHoveredBar(null)
                  }}
                />
              ))}
            </Bar>
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
              <h3 className="font-medium">{formatFullDate(selectedDate)}</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(null)}
              >
                Back to month
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gross</TableHead>
                  <TableHead>Model %</TableHead>
                  <TableHead>Chatter %</TableHead>
                  <TableHead className="text-right">Company</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedEntries.map((e) => {
                  const net = e.amount * (1 - platformFee / 100)
                  const mComm = net * (e.modelCommissionRate / 100)
                  const cComm = net * (e.chatterCommissionRate / 100)
                  const company = net - mComm - cComm
                  return (
                    <TableRow key={e.id}>
                      <TableCell>{formatCurrency(e.amount)}</TableCell>
                      <TableCell>{e.modelCommissionRate}%</TableCell>
                      <TableCell>{e.chatterCommissionRate}%</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(company)}
                      </TableCell>
                    </TableRow>
                  )
                })}
            {selectedEntries.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  No entries
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Total earnings</span>
            <span>{formatCurrency(dayTotals.total)}</span>
          </div>
          <div className="flex justify-between">
            <span>Platform fee ({platformFee}%)</span>
            <span>-{formatCurrency(dayTotals.platformFee)}</span>
          </div>
          <div className="flex justify-between">
            <span>After platform</span>
            <span>{formatCurrency(dayTotals.afterPlatform)}</span>
          </div>
          <div className="flex justify-between">
            <span>Model commissions</span>
            <span>-{formatCurrency(dayTotals.modelCommission)}</span>
          </div>
          <div className="flex justify-between">
            <span>Chatter commissions</span>
            <span>-{formatCurrency(dayTotals.chatterCommission)}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Company revenue</span>
            <span>{formatCurrency(dayCompanyRevenue)}</span>
          </div>
        </div>
      </div>
    ) : (
      <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="platform-fee">Platform fee (%)</Label>
                <Input
                  id="platform-fee"
                  type="number"
                  value={platformFee}
                  onChange={(e) => setPlatformFee(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Manual adjustments (negative = cost)</Label>
                {adjustments.map((adj, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={adj}
                      onChange={(e) =>
                        updateAdjustment(idx, Number(e.target.value) || 0)
                      }
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => removeAdjustment(idx)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={addAdjustment}
                  className="w-full"
                >
                  Add adjustment
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total earnings</span>
                <span>{formatCurrency(monthTotals.total)}</span>
              </div>
              <div className="flex justify-between">
                <span>Platform fee ({platformFee}%)</span>
                <span>-{formatCurrency(monthTotals.platformFee)}</span>
              </div>
              <div className="flex justify-between">
                <span>After platform</span>
                <span>{formatCurrency(monthTotals.afterPlatform)}</span>
              </div>
              <div className="flex justify-between">
                <span>Model commissions</span>
                <span>-{formatCurrency(monthTotals.modelCommission)}</span>
              </div>
              <div className="flex justify-between">
                <span>Chatter commissions</span>
                <span>-{formatCurrency(monthTotals.chatterCommission)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Company revenue</span>
                <span>{formatCurrency(companyRevenue)}</span>
              </div>
              {adjustmentsTotal !== 0 && (
                <div className="flex justify-between">
                  <span>Adjustments</span>
                  <span>
                    {adjustmentsTotal >= 0 ? "+" : ""}
                    {formatCurrency(adjustmentsTotal)}
                  </span>
                </div>
              )}
              <div className="flex justify-between font-bold">
                <span>Final revenue</span>
                <span>{formatCurrency(finalRevenue)}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

