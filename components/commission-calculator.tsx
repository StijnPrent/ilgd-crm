"use client"

import type { KeyboardEvent } from "react"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calendar, Calculator } from "lucide-react"

import { api } from "@/lib/api"

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
  bonus_amount: number
  total_payout: number
}

interface ChatterOption {
  id: string
  full_name: string
  currency: string
}

const formatCurrency = (amount: number, currency = "€") => {
  const currencyCode = currency === "€" ? "EUR" : currency === "$" ? "USD" : currency
  const sanitizedAmount = Number.isFinite(amount) ? amount : 0
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: currencyCode,
  }).format(sanitizedAmount)
}

const formatPeriod = (start: string, end: string) => {
  if (!start || !end) return "-"
  const formatter = new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return "-"
  }
  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`
}

const parseBonusValue = (value: string | number | undefined) => {
  if (value === undefined || value === "") return 0
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }
  const normalized = value.replace(",", ".")
  const parsed = Number.parseFloat(normalized)
  return Number.isNaN(parsed) ? 0 : parsed
}

const formatBonusValue = (value: number) => {
  if (!Number.isFinite(value)) return "0.00"
  return value.toFixed(2)
}

export function CommissionCalculator() {
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [chatters, setChatters] = useState<ChatterOption[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedChatter, setSelectedChatter] = useState("all")
  const [bonusInputs, setBonusInputs] = useState<Record<string, string>>({})
  const [bonusSaveState, setBonusSaveState] = useState<Record<string, "idle" | "saving" | "error">>({})

  const fetchCommissions = useCallback(
    async (filters?: { chatterId?: string }) => {
      setLoading(true)
      try {
        const params = filters?.chatterId ? { chatterId: filters.chatterId } : undefined
        const [commissionsData, chattersData, usersData] = await Promise.all([
          api.getCommissions(params),
          api.getChatters(),
          api.getUsers(),
        ])

        const userMap = new Map(
          (usersData || []).map((u: any) => [
            String(u.id),
            u.fullName || u.full_name || "",
          ]),
        )

        const chatterOptions: ChatterOption[] = (chattersData || []).map((ch: any) => ({
          id: String(ch.id),
          full_name:
            userMap.get(String(ch.id)) ||
            ch.fullName ||
            ch.full_name ||
            ch.name ||
            "",
          currency: ch.currency || ch.currency_symbol || "€",
        }))

        setChatters(chatterOptions)

        const chatterCurrency = new Map(
          chatterOptions.map((chatter) => [chatter.id, chatter.currency]),
        )

        const formatted: Commission[] = (commissionsData || []).map((c: any) => {
          const chatterId = String(
            c.chatterId || c.chatter_id || c.user_id || c.userId || "",
          )
          const currency =
            chatterCurrency.get(chatterId) ||
            c.currency ||
            c.currency_symbol ||
            "€"
          const commissionAmount = Number(
            c.commission ?? c.commission_amount ?? 0,
          )
          const bonusAmount = parseBonusValue(
            c.bonus ?? c.bonusAmount ?? c.bonus_amount,
          )
          const totalPayoutRaw =
            c.totalPayout ?? c.total_payout ?? c.total ?? undefined
          const totalPayout = Number.isFinite(Number(totalPayoutRaw))
            ? Number(totalPayoutRaw)
            : commissionAmount + bonusAmount

          return {
            id: String(c.id),
            user_id: chatterId,
            period_start: c.periodStart || c.period_start || "",
            period_end: c.periodEnd || c.period_end || "",
            total_earnings: Number(c.earnings ?? c.total_earnings ?? 0),
            commission_rate: Number(c.commissionRate ?? c.commission_rate ?? 0),
            commission_amount: commissionAmount,
            bonus_amount: Number.isFinite(bonusAmount) ? bonusAmount : 0,
            total_payout:
              Number.isFinite(totalPayout)
                ? totalPayout
                : commissionAmount + (Number.isFinite(bonusAmount) ? bonusAmount : 0),
            status: c.status || "pending",
            created_at: c.createdAt || c.created_at || "",
            chatter: {
              full_name:
                userMap.get(chatterId) ||
                c.chatter?.full_name ||
                c.chatter?.fullName ||
                c.chatterName ||
                "",
              currency,
            },
          }
        })

        setCommissions(formatted)

        const initialBonusInputs = formatted.reduce(
          (acc, commission) => {
            acc[commission.id] = formatBonusValue(commission.bonus_amount)
            return acc
          },
          {} as Record<string, string>,
        )
        setBonusInputs(initialBonusInputs)
        setBonusSaveState({})
      } catch (error) {
        console.error("Error fetching commissions:", error)
        setCommissions([])
        setBonusInputs({})
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    const params =
      selectedChatter === "all" ? undefined : { chatterId: selectedChatter }
    fetchCommissions(params)
  }, [selectedChatter, fetchCommissions])

  const handleBonusInputChange = (id: string, value: string) => {
    setBonusInputs((prev) => ({ ...prev, [id]: value }))
    setBonusSaveState((prev) => {
      if (prev[id] && prev[id] !== "idle") {
        return { ...prev, [id]: "idle" }
      }
      return prev
    })
  }

  const handleBonusBlur = async (commission: Commission) => {
    const rawValue =
      bonusInputs[commission.id] ?? formatBonusValue(commission.bonus_amount)
    const parsedValue = parseBonusValue(rawValue)
    const normalizedValue = formatBonusValue(parsedValue)

    setBonusInputs((prev) => ({ ...prev, [commission.id]: normalizedValue }))

    const currentBonus = commission.bonus_amount ?? 0
    if (Math.abs(parsedValue - currentBonus) < 0.005) {
      return
    }

    setBonusSaveState((prev) => ({ ...prev, [commission.id]: "saving" }))

    try {
      const payload = {
        bonus: parsedValue,
        totalPayout: (commission.commission_amount || 0) + parsedValue,
      }
      const updated = await api.updateCommission(commission.id, payload)
      const bonusFromResponse =
        updated?.bonus ?? updated?.bonusAmount ?? updated?.bonus_amount

      const bonusToApply =
        bonusFromResponse !== undefined
          ? parseBonusValue(bonusFromResponse)
          : parsedValue

      setCommissions((prev) =>
        prev.map((item) => {
          if (item.id !== commission.id) return item
          const baseCommission = item.commission_amount || 0
          const total = baseCommission + bonusToApply
          return {
            ...item,
            bonus_amount: bonusToApply,
            total_payout: total,
          }
        }),
      )

      setBonusInputs((prev) => ({
        ...prev,
        [commission.id]: formatBonusValue(bonusToApply),
      }))

      setBonusSaveState((prev) => ({ ...prev, [commission.id]: "idle" }))
    } catch (error) {
      console.error("Error updating commission bonus:", error)
      setBonusSaveState((prev) => ({ ...prev, [commission.id]: "error" }))
      setBonusInputs((prev) => ({
        ...prev,
        [commission.id]: formatBonusValue(commission.bonus_amount ?? 0),
      }))
    }
  }

  const handleBonusKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    commission: Commission,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault()
      ;(event.currentTarget as HTMLInputElement).blur()
    }
    if (event.key === "Escape") {
      event.preventDefault()
      setBonusInputs((prev) => ({
        ...prev,
        [commission.id]: formatBonusValue(commission.bonus_amount ?? 0),
      }))
    }
  }

  const updateCommissionStatus = async (
    commissionId: string,
    newStatus: string,
  ) => {
    try {
      await api.updateCommission(commissionId, { status: newStatus })
      setCommissions((prev) =>
        prev.map((commission) =>
          commission.id === commissionId
            ? { ...commission, status: newStatus }
            : commission,
        ),
      )
    } catch (error) {
      console.error("Error updating commission status:", error)
    }
  }

  const deleteCommission = async (commissionId: string) => {
    try {
      await api.deleteCommission(commissionId)
      setCommissions((prev) =>
        prev.filter((commission) => commission.id !== commissionId),
      )
    } catch (error) {
      console.error("Error deleting commission:", error)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 rounded bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Commission Calculator
            </CardTitle>
            <CardDescription>
              Review automatically generated commissions and manage payouts.
            </CardDescription>
          </div>
          <div className="w-full md:w-64">
            <span className="mb-1 block text-sm font-medium text-muted-foreground">
              Filter by chatter
            </span>
            <Select
              value={selectedChatter}
              onValueChange={setSelectedChatter}
              disabled={chatters.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="All chatters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All chatters</SelectItem>
                {chatters.map((chatter) => (
                  <SelectItem key={chatter.id} value={chatter.id}>
                    {chatter.full_name || "Unknown"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Chatter</TableHead>
              <TableHead>Earnings</TableHead>
              <TableHead>Commission Rate</TableHead>
              <TableHead>Commission</TableHead>
              <TableHead>Bonus</TableHead>
              <TableHead>Total</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {commissions.map((commission) => {
              const bonusValue =
                bonusInputs[commission.id] ??
                formatBonusValue(commission.bonus_amount)
              const bonusNumber = parseBonusValue(bonusValue)
              const totalWithBonus =
                (commission.commission_amount || 0) +
                (Number.isFinite(bonusNumber) ? bonusNumber : 0)

              return (
                <TableRow key={commission.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {formatPeriod(
                          commission.period_start,
                          commission.period_end,
                        )}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{commission.chatter.full_name || "—"}</TableCell>
                  <TableCell>
                    {formatCurrency(
                      commission.total_earnings,
                      commission.chatter.currency,
                    )}
                  </TableCell>
                  <TableCell>
                    {(commission.commission_rate * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell className="font-semibold text-green-600">
                    {formatCurrency(
                      commission.commission_amount,
                      commission.chatter.currency,
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={bonusValue}
                        onChange={(event) =>
                          handleBonusInputChange(
                            commission.id,
                            event.target.value,
                          )
                        }
                        onBlur={() => handleBonusBlur(commission)}
                        onKeyDown={(event) =>
                          handleBonusKeyDown(event, commission)
                        }
                        disabled={bonusSaveState[commission.id] === "saving"}
                      />
                      {bonusSaveState[commission.id] === "saving" && (
                        <span className="text-xs text-muted-foreground">
                          Saving...
                        </span>
                      )}
                      {bonusSaveState[commission.id] === "error" && (
                        <span className="text-xs text-destructive">
                          Error saving bonus
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">
                    {formatCurrency(
                      totalWithBonus,
                      commission.chatter.currency,
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {commission.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() =>
                              updateCommissionStatus(commission.id, "paid")
                            }
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Mark Paid
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteCommission(commission.id)}
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                      {commission.status === "paid" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            updateCommissionStatus(commission.id, "pending")
                          }
                        >
                          Mark Pending
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        {commissions.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">
            <Calculator className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>No commissions available yet.</p>
            <p className="text-sm">
              Commissions will appear automatically once they are generated.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
