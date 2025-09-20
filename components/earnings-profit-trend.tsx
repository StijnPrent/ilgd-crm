"use client"

import {useCallback, useEffect, useMemo, useState} from "react"
import {Line, LineChart, CartesianGrid, XAxis, YAxis} from "recharts"

import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card"
import {ToggleGroup, ToggleGroupItem} from "@/components/ui/toggle-group"
import {Skeleton} from "@/components/ui/skeleton"
import {ChartContainer, ChartTooltip, ChartTooltipContent} from "@/components/ui/chart"
import {api} from "@/lib/api"

const RANGE_OPTIONS = [
    {label: "Week", value: "week"},
    {label: "Month", value: "month"},
    {label: "Year", value: "year"},
] as const

type RangeOption = (typeof RANGE_OPTIONS)[number]["value"]

type Interval = "day" | "month"

type ChartPoint = {
    key: string
    label: string
    tooltipLabel: string
    earnings: number
    profit: number
}

interface EarningsProfitTrendProps {
    monthStart?: string
    monthEnd?: string
    monthLabel?: string
}

const clampDate = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

const addDays = (date: Date, amount: number) => {
    const result = new Date(date)
    result.setDate(result.getDate() + amount)
    return clampDate(result)
}

const formatDateKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

const formatMonthKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

const parseDateOnly = (value?: string | null) => {
    if (!value) return null
    const parts = value.split("-").map((part) => Number(part))
    if (parts.length >= 3 && parts.every((part) => Number.isFinite(part))) {
        const [year, month, day] = parts as [number, number, number]
        return new Date(year, month - 1, day)
    }
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : clampDate(parsed)
}

const parseDateTime = (value: unknown) => {
    if (typeof value !== "string") return null
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
        return clampDate(parsed)
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return parseDateOnly(value)
    }
    return null
}

interface RangeInfo {
    range: RangeOption
    start: Date
    end: Date
    interval: Interval
}

const getRangeInfo = (
    range: RangeOption,
    monthStart?: string,
    monthEnd?: string,
): RangeInfo => {
    const today = clampDate(new Date())
    const parsedStart = parseDateOnly(monthStart) ?? today
    const parsedEnd = parseDateOnly(monthEnd) ?? today

    if (range === "year") {
        const year = parsedStart.getFullYear()
        const start = clampDate(new Date(year, 0, 1))
        const end = clampDate(new Date(parsedEnd.getFullYear(), parsedEnd.getMonth(), parsedEnd.getDate()))
        return {
            range,
            start,
            end: end < start ? start : end,
            interval: "month",
        }
    }

    if (range === "week") {
        const end = parsedEnd
        let start = addDays(end, -6)
        const monthBoundary = parseDateOnly(monthStart)
        if (monthBoundary && start < monthBoundary) {
            start = monthBoundary
        }
        return {
            range,
            start,
            end: end < start ? start : end,
            interval: "day",
        }
    }

    const start = parseDateOnly(monthStart) ?? addDays(parsedEnd, -29)
    const end = parsedEnd < start ? start : parsedEnd
    return {
        range,
        start,
        end,
        interval: "day",
    }
}

const buildBuckets = (info: RangeInfo): ChartPoint[] => {
    const buckets: ChartPoint[] = []
    if (info.interval === "month") {
        const current = new Date(info.start.getFullYear(), info.start.getMonth(), 1)
        const limit = new Date(info.end.getFullYear(), info.end.getMonth(), 1)
        while (current <= limit) {
            const key = formatMonthKey(current)
            buckets.push({
                key,
                label: current.toLocaleDateString("nl-NL", {month: "short"}),
                tooltipLabel: current.toLocaleDateString("nl-NL", {month: "long", year: "numeric"}),
                earnings: 0,
                profit: 0,
            })
            current.setMonth(current.getMonth() + 1)
        }
        return buckets
    }

    let current = info.start
    while (current <= info.end) {
        const key = formatDateKey(current)
        buckets.push({
            key,
            label:
                info.range === "week"
                    ? current.toLocaleDateString("nl-NL", {weekday: "short"})
                    : current.toLocaleDateString("nl-NL", {day: "numeric"}),
            tooltipLabel: current.toLocaleDateString("nl-NL", {
                day: "numeric",
                month: "short",
                year: "numeric",
            }),
            earnings: 0,
            profit: 0,
        })
        current = addDays(current, 1)
    }
    return buckets
}

export function EarningsProfitTrend({monthStart, monthEnd, monthLabel}: EarningsProfitTrendProps) {
    const [range, setRange] = useState<RangeOption>("month")
    const [chartData, setChartData] = useState<ChartPoint[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const currencyFormatter = useMemo(
        () => new Intl.NumberFormat("nl-NL", {style: "currency", currency: "EUR"}),
        [],
    )

    const formatCurrencyValue = useCallback(
        (amount: number) => currencyFormatter.format(amount),
        [currencyFormatter],
    )

    const rangeInfo = useMemo(() => getRangeInfo(range, monthStart, monthEnd), [range, monthEnd, monthStart])

    const periodLabel = useMemo(() => {
        if (rangeInfo.interval === "month") {
            const startDate = rangeInfo.start
            const endDate = rangeInfo.end
            const sameYear = startDate.getFullYear() === endDate.getFullYear()
            const startLabel = startDate.toLocaleDateString("nl-NL", {
                month: "short",
                ...(sameYear ? {} : {year: "numeric"}),
            })
            const endLabel = endDate.toLocaleDateString("nl-NL", {month: "short", year: "numeric"})
            return `${startLabel} – ${endLabel}`
        }
        const sameYear = rangeInfo.start.getFullYear() === rangeInfo.end.getFullYear()
        const startLabel = rangeInfo.start.toLocaleDateString("nl-NL", {
            day: "numeric",
            month: "short",
            ...(sameYear ? {} : {year: "numeric"}),
        })
        const endLabel = rangeInfo.end.toLocaleDateString("nl-NL", {day: "numeric", month: "short", year: "numeric"})
        if (startLabel === endLabel) return startLabel
        return `${startLabel} – ${endLabel}`
    }, [rangeInfo])

    useEffect(() => {
        let cancelled = false
        const fetchData = async () => {
            setLoading(true)
            setError(null)
            try {
                const from = rangeInfo.interval === "month"
                    ? formatDateKey(new Date(rangeInfo.start.getFullYear(), rangeInfo.start.getMonth(), 1))
                    : formatDateKey(rangeInfo.start)
                const to = rangeInfo.interval === "month"
                    ? formatDateKey(new Date(rangeInfo.end.getFullYear(), rangeInfo.end.getMonth() + 1, 0))
                    : formatDateKey(rangeInfo.end)

                const [earningsResponse, revenueResponse] = await Promise.all([
                    api.getEmployeeEarnings({from, to}),
                    api.getRevenueEarnings({from, to}),
                ])

                if (cancelled) return

                const buckets = buildBuckets(rangeInfo)
                const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]))

                const earningsEntries = Array.isArray(earningsResponse) ? earningsResponse : earningsResponse?.data
                const revenueEntries = Array.isArray(revenueResponse) ? revenueResponse : revenueResponse?.data

                if (Array.isArray(earningsEntries)) {
                    for (const entry of earningsEntries) {
                        const amount = Number(entry?.amount ?? 0)
                        if (!Number.isFinite(amount)) continue
                        const entryDate = parseDateTime(entry?.date ?? entry?.createdAt ?? entry?.created_at)
                        if (!entryDate) continue
                        const key = rangeInfo.interval === "month"
                            ? formatMonthKey(entryDate)
                            : formatDateKey(entryDate)
                        const bucket = bucketMap.get(key)
                        if (bucket) {
                            bucket.earnings += amount
                        }
                    }
                }

                if (Array.isArray(revenueEntries)) {
                    for (const entry of revenueEntries) {
                        const amount = Number(entry?.amount ?? 0)
                        if (!Number.isFinite(amount)) continue
                        const entryDate = parseDateTime(entry?.date ?? entry?.createdAt ?? entry?.created_at)
                        if (!entryDate) continue
                        const net = amount * (1 - Number(entry?.platformFee ?? entry?.platform_fee ?? 20) / 100)
                        const modelRate = Number(entry?.modelCommissionRate ?? entry?.model_commission_rate ?? 0)
                        const chatterRate = Number(entry?.chatterCommissionRate ?? entry?.chatter_commission_rate ?? 0)
                        const modelCommission = net * (modelRate / 100)
                        const chatterCommission = net * (chatterRate / 100)
                        const profit = net - modelCommission - chatterCommission
                        const key = rangeInfo.interval === "month"
                            ? formatMonthKey(entryDate)
                            : formatDateKey(entryDate)
                        const bucket = bucketMap.get(key)
                        if (bucket) {
                            bucket.profit += profit
                        }
                    }
                }

                setChartData([...bucketMap.values()])
            } catch (err) {
                console.error("Failed to load earnings/profit trend", err)
                if (!cancelled) setError("Unable to load trend data")
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        fetchData()

        return () => {
            cancelled = true
        }
    }, [rangeInfo])

    const totals = useMemo(
        () =>
            chartData.reduce(
                (acc, point) => {
                    acc.earnings += point.earnings
                    acc.profit += point.profit
                    return acc
                },
                {earnings: 0, profit: 0},
            ),
        [chartData],
    )

    const chartConfig = useMemo(
        () => ({
            earnings: {label: "Earnings", color: "#6CE8F2"},
            profit: {label: "Profit", color: "#FFA6FF"},
        }),
        [],
    )

    const tooltipFormatter = useCallback(
        (
            value: number | string | Array<number | string>,
            name?: string | number,
            _item?: unknown,
            _index?: number,
            point?: ChartPoint,
        ) => {
            const numericValue = typeof value === "number" ? value : Number(value)
            const formattedValue = formatCurrencyValue(Number.isFinite(numericValue) ? numericValue : 0)
            const key = typeof name === "string" ? name : name != null ? String(name) : ""
            const label = key === "earnings" ? "Earnings" : "Profit"

            if (key === "profit") {
                const differenceValue = (point?.earnings ?? 0) - (point?.profit ?? 0)
                const formattedDifference = formatCurrencyValue(differenceValue)

                return (
                    <div className="flex w-full flex-col gap-1">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="text-foreground font-mono font-medium tabular-nums">{formattedValue}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">Difference</span>
                            <span className="text-foreground font-mono font-medium tabular-nums">{formattedDifference}</span>
                        </div>
                    </div>
                )
            }

            return (
                <div className="flex w-full items-center justify-between gap-2">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="text-foreground font-mono font-medium tabular-nums">{formattedValue}</span>
                </div>
            )
        },
        [formatCurrencyValue],
    )

    const handleRangeChange = (value: string) => {
        if (!value) return
        if (value === range) return
        if (value === "week" || value === "month" || value === "year") {
            setRange(value)
        }
    }

    return (
        <Card>
            <CardHeader className="gap-4 space-y-0 sm:flex sm:items-center sm:justify-between">
                <div>
                    <CardTitle className="text-lg font-semibold">Earnings vs Profit</CardTitle>
                    <CardDescription>
                        {monthLabel ? `${monthLabel}` : null}
                        {monthLabel ? " · " : ""}
                        {periodLabel}
                    </CardDescription>
                </div>
                <ToggleGroup
                    type="single"
                    value={range}
                    onValueChange={handleRangeChange}
                    variant="outline"
                    className="rounded-lg border"
                >
                    {RANGE_OPTIONS.map((option) => (
                        <ToggleGroupItem key={option.value} value={option.value} className="text-xs sm:text-sm">
                            {option.label}
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>
            </CardHeader>
            <CardContent className="space-y-4">
                {loading ? (
                    <Skeleton className="h-64 w-full" />
                ) : error ? (
                    <div className="flex h-64 w-full items-center justify-center rounded-md border border-dashed border-muted-foreground/30 text-sm text-muted-foreground">
                        {error}
                    </div>
                ) : chartData.every((point) => point.earnings === 0 && point.profit === 0) ? (
                    <div className="flex h-64 w-full items-center justify-center rounded-md border border-dashed border-muted-foreground/30 text-sm text-muted-foreground">
                        No data for this period
                    </div>
                ) : (
                    <ChartContainer config={chartConfig} className="h-64 w-full">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="label" tickLine={false} axisLine={false} />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                width={70}
                                tickFormatter={(value: number) => formatCurrencyValue(value)}
                            />
                            <ChartTooltip
                                content={
                                    <ChartTooltipContent
                                        labelFormatter={(_, payload) => payload?.[0]?.payload?.tooltipLabel}
                                        formatter={tooltipFormatter}
                                    />
                                }
                            />
                            <Line
                                type="monotone"
                                dataKey="earnings"
                                stroke="var(--color-earnings)"
                                strokeWidth={2}
                                dot={false}
                                activeDot={{r: 4}}
                            />
                            <Line
                                type="monotone"
                                dataKey="profit"
                                stroke="var(--color-profit)"
                                strokeWidth={2}
                                dot={false}
                                activeDot={{r: 4}}
                            />
                        </LineChart>
                    </ChartContainer>
                )}

                <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <div className="rounded-lg border bg-muted/40 p-3">
                        <p className="text-muted-foreground">Total earnings</p>
                        <p className="text-base font-semibold">{formatCurrencyValue(totals.earnings)}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/40 p-3">
                        <p className="text-muted-foreground">Total profit</p>
                        <p className="text-base font-semibold">{formatCurrencyValue(totals.profit)}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
