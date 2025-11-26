"use client"

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
import { formatUserDate } from "@/lib/timezone"

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
}

interface CommissionTotals {
  earnings: number
  commission: number
}

interface ChatterOption {
  id: string
  full_name: string
  currency: string
}

const PAGE_SIZE = 10
const AWARD_PAGE_SIZE = 13
const DATE_FORMAT = "yyyy-MM-dd"

const formatCurrency = (amount: number, currency = "EUR") => {
  const sanitizedAmount = Number.isFinite(amount) ? amount : 0
  if (currency === "$") {
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "USD",
    }).format(sanitizedAmount)
  }
  if (typeof currency === "string" && currency.trim().length === 3) {
    const code = currency.trim().toUpperCase()
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: code,
    }).format(sanitizedAmount)
  }
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(sanitizedAmount)
}
const formatCommissionDate = (value: string) => {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "-"
  return formatUserDate(parsed, {
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

const coerceNumber = (value: unknown) => {
  if (value === undefined || value === null) return 0
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value === "string") {
    const normalized = value.replace(",", ".")
    const parsed = Number.parseFloat(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export function CommissionCalculator() {
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [chatters, setChatters] = useState<ChatterOption[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedChatter, setSelectedChatter] = useState("all")
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [fromDate, setFromDate] = useState<string | undefined>()
  const [toDate, setToDate] = useState<string | undefined>()
  const [datePreset, setDatePreset] = useState<DatePreset>("all")
  const [totals, setTotals] = useState<CommissionTotals>({
    earnings: 0,
    commission: 0,
  })
  const [bonusAwards, setBonusAwards] = useState<any[]>([])
  const [awardTotalCount, setAwardTotalCount] = useState(0)
  const [awardPage, setAwardPage] = useState(1)

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
        currency: ch.currency || ch.currency_symbol || "EUR",
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
          c.currency_symbol || "EUR"
        const commissionAmount = Number(
          c.commission ?? c.commission_amount ?? 0,
        )

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

      // Load bonus awards for the same filter
      try {
        const awardsParams: any = {}
        if (selectedChatter !== "all") awardsParams.workerId = selectedChatter
        if (fromDate) awardsParams.from = fromDate
        if (toDate) awardsParams.to = toDate
        awardsParams.limit = AWARD_PAGE_SIZE
        awardsParams.offset = (awardPage - 1) * AWARD_PAGE_SIZE
        const awardsResponse = await api.getBonusAwards(awardsParams)
        const awardRows = Array.isArray(awardsResponse)
          ? awardsResponse
          : awardsResponse?.data ?? []
        const normalizedAwards = awardRows.map((row: any) => ({
          id: String(row.id),
          workerId: String(row.workerId ?? row.worker_id ?? ""),
          ruleId: row.ruleId,
          ruleName: row.ruleName ?? row.rule?.name,
          bonusAmountCents:
            row.bonusAmountCents ?? row.bonus_amount_cents ?? row.amountCents ?? row.amount_cents,
          currency: row.currency ?? "EUR",
          awardedAt: row.awardedAt ?? row.createdAt ?? row.created_at,
          reason: row.reason ?? "",
        }))
        setBonusAwards(normalizedAwards)

        const rawAwardsTotal = Array.isArray(awardsResponse)
          ? undefined
          : awardsResponse?.total ??
          awardsResponse?.meta?.total ??
          awardsResponse?.meta?.count ??
          awardsResponse?.meta?.pagination?.total ??
          awardsResponse?.pagination?.total ??
          awardsResponse?.count ??
          awardsResponse?.data?.total

        const awardsFallbackTotal = (awardPage - 1) * AWARD_PAGE_SIZE + normalizedAwards.length
        setAwardTotalCount(parseTotalCount(rawAwardsTotal, awardsFallbackTotal))
      } catch (e) {
        setBonusAwards([])
        setAwardTotalCount(0)
      }

      const totalsFromResponse = Array.isArray(commissionsResponse)
        ? undefined
        : commissionsResponse?.totals || commissionsResponse?.summary

      if (totalsFromResponse && typeof totalsFromResponse === "object") {
        setTotals({
          earnings: Number(
            totalsFromResponse.earnings ??
            totalsFromResponse.totalEarnings ??
            totalsFromResponse.total_earnings ??
            0,
          ),
          commission: Number(
            totalsFromResponse.commission ??
            totalsFromResponse.totalCommission ??
            totalsFromResponse.commission_amount ??
            totalsFromResponse.total_commission ??
            0,
          ),
        })
      } else {
        const aggregated = formatted.reduce(
          (acc, item) => {
            acc.earnings += item.total_earnings || 0
            acc.commission += item.commission_amount || 0
            return acc
          },
          { earnings: 0, commission: 0 },
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

    } catch (error) {
      console.error("Error fetching commissions:", error)
      setCommissions([])
      setTotalCount(0)
      setTotals({ earnings: 0, commission: 0 })
    } finally {
      setLoading(false)
    }
  }, [awardPage, fromDate, page, selectedChatter, toDate])

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
    return "EUR"
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

  const awardPageCount = useMemo(
    () => Math.max(1, Math.ceil(awardTotalCount / AWARD_PAGE_SIZE) || 1),
    [awardTotalCount],
  )

  const awardPaginationNumbers = useMemo(() => {
    if (awardPageCount <= 5) {
      return Array.from({ length: awardPageCount }, (_, index) => index + 1)
    }

    if (awardPage <= 4) {
      return [1, 2, 3, 4, "ellipsis", awardPageCount]
    }

    if (awardPage >= awardPageCount - 3) {
      return [
        1,
        "ellipsis",
        awardPageCount - 3,
        awardPageCount - 2,
        awardPageCount - 1,
        awardPageCount,
      ]
    }

    return [1, "ellipsis", awardPage - 1, awardPage, awardPage + 1, "ellipsis", awardPageCount]
  }, [awardPage, awardPageCount])

  const pagedBonusAwards = useMemo(() => bonusAwards, [bonusAwards])

  const bonusTotal = useMemo(
    () =>
      bonusAwards.reduce((acc, award) => {
        const amountCents = coerceNumber(
          award.bonusAmountCents ??
          award.bonus_amount_cents ??
          award.amountCents ??
          award.amount_cents ??
          0,
        )
        return acc + amountCents / 100
      }, 0),
    [bonusAwards],
  )

  const payoutTotals = useMemo(
    () => ({
      commission: totals.commission,
      bonus: bonusTotal,
      payout: totals.commission + bonusTotal,
    }),
    [bonusTotal, totals.commission],
  )

  useEffect(() => {
    setAwardPage(1)
  }, [selectedChatter, fromDate, toDate])

  useEffect(() => {
    const maxPage = Math.max(1, awardPageCount)
    if (awardPage > maxPage) {
      setAwardPage(maxPage)
    }
  }, [awardPage, awardPageCount])

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
    <section className="space-y-4">
      <Card className="w-full">
        <CardHeader className="pb-2">
          <CardTitle>Total payout per chatter</CardTitle>
          <CardDescription>
            Select a chatter and date range to see combined commission and bonuses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedChatter === "all" ? (
            <p className="text-md text-muted-foreground">
              Select a chatter to see total payout details.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">Commission</span>
                <span className="text-lg font-semibold">
                  {formatCurrency(payoutTotals.commission, totalsCurrency)}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">Bonus</span>
                <span className="text-lg font-semibold">
                  {formatCurrency(payoutTotals.bonus, totalsCurrency)}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">Total payout</span>
                <span className="text-lg font-semibold text-green-600">
                  {formatCurrency(payoutTotals.payout, totalsCurrency)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,340px)]">
        <Card className="w-full">
          <CardHeader>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Percent className="h-5 w-5" />
                    Commissions
                  </CardTitle>
                  <CardDescription>
                    Review generated commissions and automatic bonuses for the selected period.
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
                  <Select
                    value={datePreset}
                    onValueChange={(value) => handleDatePresetChange(value as DatePreset)}
                  >
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
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead>Chatter</TableHead>
                  <TableHead className="hidden md:table-cell">Earnings</TableHead>
                  <TableHead className="hidden md:table-cell">Commission Rate</TableHead>
                  <TableHead>Commission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.map((commission) => {
                  return (
                    <TableRow key={commission.id}>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {formatCommissionDate(commission.commission_date)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{commission.chatter.full_name || "Unknown"}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {formatCurrency(
                          commission.total_earnings,
                          commission.chatter.currency,
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {commission.commission_rate.toFixed(1)}%
                      </TableCell>
                      <TableCell className="font-semibold text-green-600">
                        {formatCurrency(
                          commission.commission_amount,
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
                    Total
                  </TableCell>
                  <TableCell className="font-semibold hidden md:table-cell">
                    {formatCurrency(totals.earnings, totalsCurrency)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell"></TableCell>
                  <TableCell className="font-semibold text-green-600">
                    {formatCurrency(totals.commission, totalsCurrency)}
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
        {/* Monthly / weekly bonus awards */}
        <div className="lg:mt-0">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Monthly & weekly bonus awards</CardTitle>
              <CardDescription>
                Bonuses sourced from the bonus_awards feed (targets, contests, etc.).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Chatter</TableHead>
                    <TableHead>Bonus</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedBonusAwards.map((award) => {
                    const chatterName =
                      chatters.find((c) => c.id === award.workerId)?.full_name || ""
                    const currency =
                      chatters.find((c) => c.id === award.workerId)?.currency ||
                      award.currency ||
                      "EUR"
                    return (
                      <TableRow key={award.id}>
                        <TableCell>{formatCommissionDate(award.awardedAt)}</TableCell>
                        <TableCell>{chatterName}</TableCell>
                        <TableCell>
                          {formatCurrency((award.bonusAmountCents ?? 0) / 100, currency)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {bonusAwards.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <div className="py-6 text-center text-muted-foreground text-sm">
                          No bonus awards in the selected range.
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {bonusAwards.length > 0 && awardPageCount > 1 && (
                <Pagination className="pt-4">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(event) => {
                          event.preventDefault()
                          setAwardPage((current) => Math.max(1, current - 1))
                        }}
                      />
                    </PaginationItem>
                    {awardPaginationNumbers.map((paginationItem, index) => (
                      <PaginationItem key={`${paginationItem}-${index}`}>
                        {paginationItem === "ellipsis" ? (
                          <PaginationEllipsis />
                        ) : (
                          <PaginationLink
                            href="#"
                            isActive={awardPage === paginationItem}
                            onClick={(event) => {
                              event.preventDefault()
                              setAwardPage(paginationItem as number)
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
                          setAwardPage((current) => Math.min(awardPageCount, current + 1))
                        }}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
