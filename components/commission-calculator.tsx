"use client"

import type { KeyboardEvent } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Calendar, Calculator, Percent } from "lucide-react"

import { format, endOfMonth, startOfMonth } from "date-fns"

import { api } from "@/lib/api"

type DatePreset =
  | "all"
  | "today"
  | "first-half"
  | "second-half"
  | "custom-day"
  | "custom-range"

interface Commission {
  id: string
  chatter_id: string
  commission_date: string
  total_earnings: number
  commission_rate: number
  commission_amount: number
  created_at: string
  chatter: {
    full_name: string
    currency: string
  }
  bonus_amount: number
  total_payout: number
}

interface CommissionTotals {
  earnings: number
  commission: number
  bonus: number
  payout: number
}

interface ChatterOption {
  id: string
  full_name: string
  currency: string
}

const PAGE_SIZE = 10
const DATE_FORMAT = "yyyy-MM-dd"

const formatCurrency = (amount: number, currency = "€") => {
  const currencyCode = currency === "€" ? "EUR" : currency === "$" ? "USD" : currency
  const sanitizedAmount = Number.isFinite(amount) ? amount : 0
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: currencyCode,
  }).format(sanitizedAmount)
}

const formatCommissionDate = (value: string) => {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "-"
  return parsed.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

const parseTotalCount = (value: any, fallback = 0) => {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  if (value && typeof value === "object") {
    const possible =
      value.total ??
      value.count ??
      value.meta?.total ??
      value.pagination?.total ??
      value.data
    if (typeof possible === "number") return possible
    if (typeof possible === "string") {
      const parsed = Number(possible)
      return Number.isFinite(parsed) ? parsed : fallback
    }
  }
  return fallback
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
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [bonusInputs, setBonusInputs] = useState<Record<string, string>>({})
  const [bonusSaveState, setBonusSaveState] = useState<Record<
    string,
    "idle" | "saving" | "error"
  >>({})
  const [fromDate, setFromDate] = useState<string | undefined>()
  const [toDate, setToDate] = useState<string | undefined>()
  const [datePreset, setDatePreset] = useState<DatePreset>("all")
  const [totals, setTotals] = useState<CommissionTotals>({
    earnings: 0,
    commission: 0,
    bonus: 0,
    payout: 0,
  })

  const dateFilterActive = useMemo(
    () => Boolean(fromDate || toDate),
    [fromDate, toDate],
  )

  const fetchCommissions = useCallback(async () => {
    const hasDateFilter = Boolean(fromDate || toDate)
    setLoading(true)
    try {
      const params: {
        limit?: number
        offset?: number
        chatterId?: string
        from?: string
        to?: string
      } = {}

      if (!hasDateFilter) {
        params.limit = PAGE_SIZE
        params.offset = (page - 1) * PAGE_SIZE
      }

      if (selectedChatter !== "all") {
        params.chatterId = selectedChatter
      }

      if (fromDate) {
        params.from = fromDate
      }
      if (toDate) {
        params.to = toDate
      }

      const totalCountPromise = hasDateFilter
        ? Promise.resolve(null)
        : api
            .getCommissionsTotalCount(params)
            .catch((error: unknown) => {
              console.warn("Error fetching commission total count:", error)
              return null
            })

      const [commissionsResponse, totalResponse, chattersData, usersData] =
        await Promise.all([
          api.getCommissions(params),
          totalCountPromise,
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

      const commissionList = Array.isArray(commissionsResponse)
        ? commissionsResponse
        : commissionsResponse?.data ?? []

      const formatted: Commission[] = commissionList.map((c: any) => {
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
          chatter_id: chatterId,
          commission_date:
            c.commissionDate ||
            c.commission_date ||
            c.date ||
            c.shiftDate ||
            c.shift_date ||
            c.periodStart ||
            c.period_start ||
            c.createdAt ||
            c.created_at ||
            "",
          total_earnings: Number(c.earnings ?? c.total_earnings ?? c.total ?? 0),
          commission_rate: Number(c.commissionRate ?? c.commission_rate ?? 0),
          commission_amount: commissionAmount,
          bonus_amount: Number.isFinite(bonusAmount) ? bonusAmount : 0,
          total_payout:
            Number.isFinite(totalPayout)
              ? totalPayout
              : commissionAmount +
                (Number.isFinite(bonusAmount) ? bonusAmount : 0),
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

      const totalsFromResponse = Array.isArray(commissionsResponse)
        ? undefined
        : commissionsResponse?.totals || commissionsResponse?.summary

      if (totalsFromResponse && typeof totalsFromResponse === "object") {
        setTotals({
          earnings: Number(totalsFromResponse.earnings ?? totalsFromResponse.totalEarnings ?? totalsFromResponse.total_earnings ?? 0),
          commission: Number(
            totalsFromResponse.commission ??
              totalsFromResponse.totalCommission ??
              totalsFromResponse.commission_amount ??
              totalsFromResponse.total_commission ??
              0,
          ),
          bonus: Number(
            totalsFromResponse.bonus ??
              totalsFromResponse.totalBonus ??
              totalsFromResponse.bonus_amount ??
              totalsFromResponse.total_bonus ??
              0,
          ),
          payout: Number(
            totalsFromResponse.total ??
              totalsFromResponse.totalPayout ??
              totalsFromResponse.total_payout ??
              totalsFromResponse.payout ??
              0,
          ),
        })
      } else {
        const aggregated = formatted.reduce(
          (acc, item) => {
            acc.earnings += item.total_earnings || 0
            acc.commission += item.commission_amount || 0
            acc.bonus += item.bonus_amount || 0
            acc.payout += (item.commission_amount || 0) + (item.bonus_amount || 0)
            return acc
          },
          { earnings: 0, commission: 0, bonus: 0, payout: 0 },
        )
        setTotals(aggregated)
      }

      if (hasDateFilter) {
        setTotalCount(commissionList.length)
      } else {
        const rawMetaTotal = Array.isArray(commissionsResponse)
          ? undefined
          : commissionsResponse?.total ??
            commissionsResponse?.meta?.total ??
            commissionsResponse?.meta?.count ??
            commissionsResponse?.meta?.pagination?.total ??
            commissionsResponse?.pagination?.total ??
            commissionsResponse?.count ??
            commissionsResponse?.data?.total

        const fallbackTotal = (page - 1) * PAGE_SIZE + commissionList.length

        const derivedTotal = parseTotalCount(
          totalResponse,
          parseTotalCount(rawMetaTotal, fallbackTotal),
        )

        setTotalCount(derivedTotal)
      }

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
      setBonusSaveState({})
      setTotalCount(0)
      setTotals({ earnings: 0, commission: 0, bonus: 0, payout: 0 })
    } finally {
      setLoading(false)
    }
  }, [fromDate, page, selectedChatter, toDate])

  useEffect(() => {
    fetchCommissions()
  }, [fetchCommissions])

  useEffect(() => {
    if (dateFilterActive) {
      if (page !== 1) {
        setPage(1)
      }
      return
    }

    const maxPage = Math.max(1, Math.ceil(totalCount / PAGE_SIZE) || 1)
    if (page > maxPage) {
      setPage(maxPage)
    }
  }, [dateFilterActive, page, totalCount])

  const handleChatterFilterChange = useCallback((value: string) => {
    setSelectedChatter(value)
    setPage(1)
  }, [])

  const applyDateRange = useCallback((from?: Date | string, to?: Date | string) => {
    const normalize = (value?: Date | string) => {
      if (!value) return undefined
      if (value instanceof Date) {
        return format(value, DATE_FORMAT)
      }
      return value
    }

    setFromDate(normalize(from))
    setToDate(normalize(to))
    setPage(1)
  }, [])

  const handleDatePresetChange = useCallback(
    (value: DatePreset) => {
      setDatePreset(value)
      const now = new Date()

      switch (value) {
        case "all":
          applyDateRange(undefined, undefined)
          break
        case "today": {
          const today = new Date()
          applyDateRange(today, today)
          break
        }
        case "first-half": {
          const start = startOfMonth(now)
          const halfEnd = new Date(start)
          halfEnd.setDate(15)
          applyDateRange(start, halfEnd)
          break
        }
        case "second-half": {
          const start = new Date(now.getFullYear(), now.getMonth(), 16)
          const end = endOfMonth(now)
          applyDateRange(start, end)
          break
        }
        case "custom-day": {
          const today = new Date()
          applyDateRange(today, today)
          break
        }
        case "custom-range": {
          const start = startOfMonth(now)
          const end = endOfMonth(now)
          applyDateRange(start, end)
          break
        }
        default:
          break
      }
    },
    [applyDateRange],
  )

  const handleCustomDayChange = useCallback((value: string) => {
    const normalized = value || undefined
    setFromDate(normalized)
    setToDate(normalized)
    setPage(1)
  }, [])

  const handleCustomRangeChange = useCallback(
    (type: "from" | "to", value: string) => {
      const normalized = value || undefined
      if (type === "from") {
        setFromDate(normalized)
      } else {
        setToDate(normalized)
      }
      setPage(1)
    },
    [],
  )

  const pageCount = useMemo(
    () =>
      dateFilterActive
        ? 1
        : Math.max(1, Math.ceil(totalCount / PAGE_SIZE) || 1),
    [dateFilterActive, totalCount],
  )

  const totalsCurrency = useMemo(() => {
    if (commissions.length > 0) {
      return commissions[0].chatter.currency
    }
    if (selectedChatter !== "all") {
      const chatterCurrency = chatters.find(
        (chatter) => chatter.id === selectedChatter,
      )?.currency
      if (chatterCurrency) return chatterCurrency
    }
    return "€"
  }, [chatters, commissions, selectedChatter])

  const paginationNumbers = useMemo(() => {
    if (pageCount <= 5) {
      return Array.from({ length: pageCount }, (_, index) => index + 1)
    }

    if (page <= 4) {
      return [1, 2, 3, 4, "ellipsis", pageCount]
    }

    if (page >= pageCount - 3) {
      return [
        1,
        "ellipsis",
        pageCount - 3,
        pageCount - 2,
        pageCount - 1,
        pageCount,
      ]
    }

    return [1, "ellipsis", page - 1, page, page + 1, "ellipsis", pageCount]
  }, [page, pageCount])

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
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5" />
                Commissions
              </CardTitle>
              <CardDescription>
                Review generated commissions, adjust bonuses, and export totals for
                the selected period.
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                Filter by chatter
              </span>
              <Select
                value={selectedChatter}
                onValueChange={handleChatterFilterChange}
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
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                Date range
              </span>
              <Select value={datePreset} onValueChange={(value) => handleDatePresetChange(value as DatePreset)}>
                <SelectTrigger>
                  <SelectValue placeholder="All dates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="first-half">1 - 15 (current month)</SelectItem>
                  <SelectItem value="second-half">16 - end (current month)</SelectItem>
                  <SelectItem value="custom-day">Specific day</SelectItem>
                  <SelectItem value="custom-range">Custom range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {datePreset === "custom-day" && (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Day
                </span>
                <Input
                  type="date"
                  value={fromDate ?? ""}
                  onChange={(event) => handleCustomDayChange(event.target.value)}
                />
              </div>
            )}
            {datePreset === "custom-range" && (
              <div className="grid gap-2 sm:grid-cols-2 lg:col-span-1">
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    From
                  </span>
                  <Input
                    type="date"
                    value={fromDate ?? ""}
                    onChange={(event) =>
                      handleCustomRangeChange("from", event.target.value)
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    To
                  </span>
                  <Input
                    type="date"
                    value={toDate ?? ""}
                    onChange={(event) =>
                      handleCustomRangeChange("to", event.target.value)
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Chatter</TableHead>
              <TableHead>Earnings</TableHead>
              <TableHead>Commission Rate</TableHead>
              <TableHead>Commission</TableHead>
              <TableHead>Bonus</TableHead>
              <TableHead>Total</TableHead>
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
                        {formatCommissionDate(commission.commission_date)}
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
                    {commission.commission_rate.toFixed(1)}%
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
                        className="h-8 w-24 px-2 text-sm leading-none min-w-0"
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
                </TableRow>
              )
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2} className="font-semibold">
                Totaal
              </TableCell>
              <TableCell className="font-semibold">
                {formatCurrency(totals.earnings, totalsCurrency)}
              </TableCell>
              <TableCell></TableCell>
              <TableCell className="font-semibold text-green-600">
                {formatCurrency(totals.commission, totalsCurrency)}
              </TableCell>
              <TableCell className="font-semibold">
                {formatCurrency(totals.bonus, totalsCurrency)}
              </TableCell>
              <TableCell className="font-semibold">
                {formatCurrency(totals.payout, totalsCurrency)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>

        {!dateFilterActive && pageCount > 1 && totalCount > 0 && (
          <Pagination className="pt-4">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(event) => {
                    event.preventDefault()
                    setPage((current) => Math.max(1, current - 1))
                  }}
                />
              </PaginationItem>
              {paginationNumbers.map((paginationItem, index) => (
                <PaginationItem key={`${paginationItem}-${index}`}>
                  {paginationItem === "ellipsis" ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink
                      href="#"
                      isActive={page === paginationItem}
                      onClick={(event) => {
                        event.preventDefault()
                        setPage(paginationItem as number)
                      }}
                    >
                      {paginationItem}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(event) => {
                    event.preventDefault()
                    setPage((current) => Math.min(pageCount, current + 1))
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}

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
