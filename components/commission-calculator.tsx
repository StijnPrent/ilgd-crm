"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Calculator, DollarSign, Calendar, CheckCircle, Clock, XCircle } from "lucide-react"

interface Commission {
  id: string
  user_id: string
  period_start: string
  period_end: string
  total_earnings: number
  commission_rate: number
  commission_amount: number
  status: string
  created_at: string
  chatter: {
    full_name: string
    currency: string
  }
}

interface ChatterEarnings {
  chatter_id: string
  full_name: string
  currency: string
  commission_rate: number
  platform_fee_rate: number
  total_earnings: number
  commission_amount: number
}

export function CommissionCalculator() {
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState("")
  const [isCalculateDialogOpen, setIsCalculateDialogOpen] = useState(false)
  const [pendingCalculations, setPendingCalculations] = useState<ChatterEarnings[]>([])

  useEffect(() => {
    fetchCommissions()
  }, [])

  const fetchCommissions = async () => {
    try {
      // Mock commission data
      const mockCommissions: Commission[] = [
        {
          id: "1",
          user_id: "user1",
          period_start: "2024-08-01",
          period_end: "2024-08-15",
          total_earnings: 2500,
          commission_rate: 0.08,
          commission_amount: 160,
          status: "paid",
          created_at: "2024-08-16T00:00:00Z",
          chatter: {
            full_name: "Emma Johnson",
            currency: "€",
          },
        },
        {
          id: "2",
          user_id: "user2",
          period_start: "2024-08-01",
          period_end: "2024-08-15",
          total_earnings: 1800,
          commission_rate: 0.1,
          commission_amount: 144,
          status: "pending",
          created_at: "2024-08-16T00:00:00Z",
          chatter: {
            full_name: "Sarah Wilson",
            currency: "$",
          },
        },
        {
          id: "3",
          user_id: "user3",
          period_start: "2024-07-16",
          period_end: "2024-07-31",
          total_earnings: 3200,
          commission_rate: 0.08,
          commission_amount: 204.8,
          status: "paid",
          created_at: "2024-08-01T00:00:00Z",
          chatter: {
            full_name: "Lisa Chen",
            currency: "€",
          },
        },
      ]

      setCommissions(mockCommissions)
    } catch (error) {
      console.error("Error fetching commissions:", error)
    } finally {
      setLoading(false)
    }
  }

  const generatePeriods = () => {
    const periods = []
    const currentDate = new Date()

    // Generate last 6 months of bi-monthly periods
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - Math.floor(i / 2), 1)

      if (i % 2 === 0) {
        // First half of month (1-15)
        const start = new Date(date.getFullYear(), date.getMonth(), 1)
        const end = new Date(date.getFullYear(), date.getMonth(), 15)
        periods.push({
          value: `${start.toISOString().split("T")[0]}_${end.toISOString().split("T")[0]}`,
          label: `${start.toLocaleDateString("nl-NL", { month: "long", year: "numeric" })} (1-15)`,
          start: start.toISOString().split("T")[0],
          end: end.toISOString().split("T")[0],
        })
      } else {
        // Second half of month (16-end)
        const start = new Date(date.getFullYear(), date.getMonth(), 16)
        const end = new Date(date.getFullYear(), date.getMonth() + 1, 0) // Last day of month
        periods.push({
          value: `${start.toISOString().split("T")[0]}_${end.toISOString().split("T")[0]}`,
          label: `${start.toLocaleDateString("nl-NL", { month: "long", year: "numeric" })} (16-${end.getDate()})`,
          start: start.toISOString().split("T")[0],
          end: end.toISOString().split("T")[0],
        })
      }
    }

    return periods
  }

  const calculateCommissionsForPeriod = async () => {
    if (!selectedPeriod) return

    setCalculating(true)
    try {
      // Mock chatter data with individual settings
      const mockChatters = [
        {
          id: "user1",
          full_name: "Emma Johnson",
          currency: "€",
          commission_rate: 8.0,
          platform_fee_rate: 20.0,
        },
        {
          id: "user2",
          full_name: "Sarah Wilson",
          currency: "$",
          commission_rate: 10.0,
          platform_fee_rate: 15.0,
        },
        {
          id: "user3",
          full_name: "Lisa Chen",
          currency: "€",
          commission_rate: 8.0,
          platform_fee_rate: 20.0,
        },
      ]

      const calculations: ChatterEarnings[] = []

      for (const chatter of mockChatters) {
        // Mock earnings for the selected period
        const totalEarnings = Math.floor(Math.random() * 3000) + 1000 // Random earnings between 1000-4000

        const platformFeeAmount = totalEarnings * (chatter.platform_fee_rate / 100)
        const netEarnings = totalEarnings - platformFeeAmount
        const commissionAmount = netEarnings * (chatter.commission_rate / 100)

        if (totalEarnings > 0) {
          calculations.push({
            chatter_id: chatter.id,
            full_name: chatter.full_name,
            currency: chatter.currency,
            commission_rate: chatter.commission_rate,
            platform_fee_rate: chatter.platform_fee_rate,
            total_earnings: totalEarnings,
            commission_amount: commissionAmount,
          })
        }
      }

      setPendingCalculations(calculations)
      setIsCalculateDialogOpen(true)
    } catch (error) {
      console.error("Error calculating commissions:", error)
    } finally {
      setCalculating(false)
    }
  }

  const saveCommissions = async () => {
    if (!selectedPeriod || pendingCalculations.length === 0) return

    setCalculating(true)
    try {
      const [startDate, endDate] = selectedPeriod.split("_")

      // Mock saving - just add to existing commissions
      const newCommissions = pendingCalculations.map((calc, index) => ({
        id: `new_${Date.now()}_${index}`,
        user_id: calc.chatter_id,
        period_start: startDate,
        period_end: endDate,
        total_earnings: calc.total_earnings,
        commission_rate: calc.commission_rate / 100,
        commission_amount: calc.commission_amount,
        status: "pending",
        created_at: new Date().toISOString(),
        chatter: {
          full_name: calc.full_name,
          currency: calc.currency,
        },
      }))

      setCommissions((prev) => [...newCommissions, ...prev])
      setIsCalculateDialogOpen(false)
      setPendingCalculations([])
      setSelectedPeriod("")
    } catch (error) {
      console.error("Error saving commissions:", error)
    } finally {
      setCalculating(false)
    }
  }

  const updateCommissionStatus = async (commissionId: string, newStatus: string) => {
    try {
      setCommissions((prev) =>
        prev.map((commission) => (commission.id === commissionId ? { ...commission, status: newStatus } : commission)),
      )
    } catch (error) {
      console.error("Error updating commission status:", error)
    }
  }

  const formatCurrency = (amount: number, currency = "€") => {
    const currencyCode = currency === "€" ? "EUR" : "USD"
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: currencyCode,
    }).format(amount)
  }

  const formatPeriod = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    return `${startDate.getDate()}-${endDate.getDate()} ${startDate.toLocaleDateString("nl-NL", { month: "short", year: "numeric" })}`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        )
      case "paid":
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Paid
          </Badge>
        )
      case "cancelled":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Cancelled
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Commission Calculator
            </CardTitle>
            <CardDescription>Calculate and manage bi-monthly commissions with individual settings</CardDescription>
          </div>
          <Dialog open={isCalculateDialogOpen} onOpenChange={setIsCalculateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Calculator className="h-4 w-4 mr-2" />
                Calculate New Period
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Calculate Commissions</DialogTitle>
                <DialogDescription>
                  Select a bi-monthly period to calculate commissions with individual rates and platform fees
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Select Period</label>
                  <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a bi-monthly period" />
                    </SelectTrigger>
                    <SelectContent>
                      {generatePeriods().map((period) => (
                        <SelectItem key={period.value} value={period.value}>
                          {period.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedPeriod && (
                  <Button onClick={calculateCommissionsForPeriod} disabled={calculating} className="w-full">
                    {calculating ? "Calculating..." : "Calculate Commissions"}
                  </Button>
                )}

                {pendingCalculations.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold">Commission Preview</h3>
                    <div className="max-h-60 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Total Earnings</TableHead>
                            <TableHead>Platform Fee</TableHead>
                            <TableHead>Net Earnings</TableHead>
                            <TableHead>Commission Rate</TableHead>
                            <TableHead>Commission</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingCalculations.map((calc) => {
                            const platformFeeAmount = calc.total_earnings * (calc.platform_fee_rate / 100)
                            const netEarnings = calc.total_earnings - platformFeeAmount
                            return (
                              <TableRow key={calc.chatter_id}>
                                <TableCell>{calc.full_name}</TableCell>
                                <TableCell>{formatCurrency(calc.total_earnings, calc.currency)}</TableCell>
                                <TableCell className="text-red-600">
                                  -{formatCurrency(platformFeeAmount, calc.currency)} ({calc.platform_fee_rate}%)
                                </TableCell>
                                <TableCell>{formatCurrency(netEarnings, calc.currency)}</TableCell>
                                <TableCell>{calc.commission_rate}%</TableCell>
                                <TableCell className="font-semibold text-green-600">
                                  {formatCurrency(calc.commission_amount, calc.currency)}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <Button onClick={saveCommissions} disabled={calculating} className="w-full">
                      {calculating ? "Saving..." : "Save Commissions"}
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Earnings</TableHead>
              <TableHead>Commission Rate</TableHead>
              <TableHead>Commission</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {commissions.map((commission) => (
              <TableRow key={commission.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {formatPeriod(commission.period_start, commission.period_end)}
                  </div>
                </TableCell>
                <TableCell>{commission.chatter.full_name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    {formatCurrency(commission.total_earnings, commission.chatter.currency)}
                  </div>
                </TableCell>
                <TableCell>{(commission.commission_rate * 100).toFixed(1)}%</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 font-semibold text-green-600">
                    <DollarSign className="h-4 w-4" />
                    {formatCurrency(commission.commission_amount, commission.chatter.currency)}
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(commission.status)}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {commission.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => updateCommissionStatus(commission.id, "paid")}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Mark Paid
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => updateCommissionStatus(commission.id, "cancelled")}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                    {commission.status === "paid" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateCommissionStatus(commission.id, "pending")}
                      >
                        Mark Pending
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {commissions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No commissions calculated yet.</p>
            <p className="text-sm">Use the "Calculate New Period" button to generate commissions.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
