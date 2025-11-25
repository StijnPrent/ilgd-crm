"use client"

import {useEffect, useMemo, useState} from "react"

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
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Button} from "@/components/ui/button"
import {X} from "lucide-react"
import {Bar, BarChart, Cell, XAxis, YAxis} from "recharts"

import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart"
import {api} from "@/lib/api"
import {formatUserDate, getDateInTimezone, getUserTimezone} from "@/lib/timezone"

interface RevenueEntry {
    id: string
    date: string
    amount: number
    modelCommissionRate: number
    chatterCommissionRate: number
    chatterBonusAmount: number
}

interface DailyData {
    day: number
    revenue: number
    fullDate: string
    entries: RevenueEntry[]
}

interface RevenueOverviewProps {
    monthStart?: string
    monthEnd?: string
    monthLabel?: string
}

export function RevenueOverview({monthStart, monthEnd, monthLabel}: RevenueOverviewProps) {
    const [entries, setEntries] = useState<RevenueEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedDate, setSelectedDate] = useState<string | null>(null)
    const [platformFee, setPlatformFee] = useState(20)
    const [adjustments, setAdjustments] = useState<number[]>([])
    const [hoveredBar, setHoveredBar] = useState<number | null>(null)
    const [awardCostsByDate, setAwardCostsByDate] = useState<Record<string, number>>({})
    const [awardTotal, setAwardTotal] = useState(0)
    const userTimezone = useMemo(() => getUserTimezone(), [])

    const readMoney = (entry: any, keys: string[], fallback = 0) => {
        for (const key of keys) {
            const raw = entry?.[key]
            const num = Number(raw)
            if (!Number.isFinite(num)) continue
            const isCents = key.toLowerCase().includes("cent")
            return isCents ? num / 100 : num
        }
        return fallback
    }

    useEffect(() => {
        const fetchRevenue = async () => {
            try {
                const [earningsData, awardsResponse] = await Promise.all([
                    api.getRevenueEarnings({from: monthStart, to: monthEnd}),
                    api.getBonusAwards({
                        from: monthStart,
                        to: monthEnd,
                        limit: 500,
                        offset: 0,
                    }),
                ])

                const formatted = (earningsData || []).map((e: any) => ({
                    id: String(e.id),
                    date: e.date || e.created_at,
                    amount: readMoney(e, ["amount_cents", "amount"], 0),
                    modelCommissionRate: Number(
                        e.modelCommissionRate ?? e.model_commission_rate ?? 0,
                    ),
                    chatterCommissionRate: Number(
                        e.chatterCommissionRate ?? e.chatter_commission_rate ?? 0,
                    ),
                    chatterBonusAmount: readMoney(
                        e,
                        [
                            "chatterBonusCents",
                            "chatter_bonus_cents",
                            "bonusAmountCents",
                            "bonus_amount_cents",
                            "chatterBonusAmount",
                            "chatter_bonus_amount",
                            "bonusAmount",
                            "bonus_amount",
                        ],
                        0,
                    ),
                }))
                setEntries(formatted)

                const awardRows = Array.isArray(awardsResponse)
                    ? awardsResponse
                    : awardsResponse?.data ?? []
                const normalizedAwards = awardRows.map((row: any) => ({
                    date: row.awardedAt ?? row.createdAt ?? row.created_at ?? row.date,
                    amount: readMoney(
                        row,
                        [
                            "bonusAmountCents",
                            "bonus_amount_cents",
                            "amountCents",
                            "amount_cents",
                        ],
                        0,
                    ),
                }))

                const byDate: Record<string, number> = {}
                normalizedAwards.forEach((award) => {
                    const dateKey = (award.date || "").toString().slice(0, 10)
                    if (!dateKey) return
                    byDate[dateKey] = (byDate[dateKey] || 0) + (award.amount || 0)
                })
                setAwardCostsByDate(byDate)

                const metaTotals =
                    (Array.isArray(awardsResponse) ? undefined : awardsResponse?.meta?.totals) ||
                    (Array.isArray(awardsResponse) ? undefined : awardsResponse?.totals) ||
                    {}
                const awardTotalFromMeta = readMoney(metaTotals, [
                    "bonusAmountCents",
                    "bonus_amount_cents",
                    "totalCents",
                    "total_cents",
                ])
                const awardTotalFallback = normalizedAwards.reduce(
                    (sum, a) => sum + (a.amount || 0),
                    0,
                )
                setAwardTotal(
                    Number.isFinite(awardTotalFromMeta) && awardTotalFromMeta !== 0
                        ? awardTotalFromMeta
                        : awardTotalFallback,
                )
            } catch (err) {
                console.error("Failed to load revenue earnings:", err)
            } finally {
                setLoading(false)
            }
        }
        fetchRevenue()
    }, [monthEnd, monthStart])

    const fallbackMonth = useMemo(() => {
        const zonedNow = getDateInTimezone(new Date(), userTimezone) ?? new Date()
        return new Date(zonedNow.getFullYear(), zonedNow.getMonth(), 1)
    }, [userTimezone])
    const baseMonthDate = useMemo(() => {
        if (monthStart) {
            const [yearStr, monthStr] = monthStart.split("-")
            const parsedYear = Number(yearStr)
            const parsedMonth = Number(monthStr) - 1
            if (!Number.isNaN(parsedYear) && !Number.isNaN(parsedMonth)) {
                return new Date(parsedYear, parsedMonth, 1)
            }
        }
        return fallbackMonth
    }, [fallbackMonth, monthStart])

    const year = baseMonthDate.getFullYear()
    const month = baseMonthDate.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const headerLabel = useMemo(
        () => monthLabel ?? formatUserDate(baseMonthDate, {month: "long", year: "numeric"}),
        [baseMonthDate, monthLabel],
    )

    const monthlyEntries = useMemo(
        () =>
            entries.filter((e) => {
                const d = new Date(e.date)
                return d.getFullYear() === year && d.getMonth() === month
            }),
        [entries, month, year],
    )

    const dailyData: DailyData[] = useMemo(() => {
        return Array.from({length: daysInMonth}, (_, i) => {
            const day = i + 1
            const fullDate = new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
            const dayEntries = monthlyEntries.filter((e) =>
                e.date.startsWith(fullDate),
            )
            const awardBonus = awardCostsByDate[fullDate] || 0
            const revenue = dayEntries.reduce((sum, e) => {
                const amount = Number(e.amount)
                const net = amount * (1 - platformFee / 100)
                const mComm = net * (e.modelCommissionRate / 100)
                const cComm = net * (e.chatterCommissionRate / 100)
                const cBonus = Number(e.chatterBonusAmount) || 0
                return sum + (net - mComm - cComm - cBonus)
            }, 0) - awardBonus
            return {day, revenue, fullDate, entries: dayEntries, awardBonus}
        })
    }, [monthlyEntries, daysInMonth, year, month, platformFee, awardCostsByDate])

    const monthTotals = useMemo(() => {
        const aggregated = monthlyEntries.reduce(
            (acc, e) => {
                const amount = Number(e.amount)
                const net = amount * (1 - platformFee / 100)
                const mComm = net * (e.modelCommissionRate / 100)
                const cComm = net * (e.chatterCommissionRate / 100)
                const cBonus = Number(e.chatterBonusAmount) || 0
                acc.total += amount
                acc.platformFee += amount - net
                acc.afterPlatform += net
                acc.modelCommission += mComm
                acc.chatterCommission += cComm
                acc.chatterBonus += cBonus
                return acc
            },
            {
                total: 0,
                platformFee: 0,
                afterPlatform: 0,
                modelCommission: 0,
                chatterCommission: 0,
                chatterBonus: 0,
            },
        )
        return {
            ...aggregated,
            awardBonus: awardTotal,
        }
    }, [monthlyEntries, platformFee, awardTotal])

    const companyRevenue =
        monthTotals.afterPlatform -
        monthTotals.modelCommission -
        monthTotals.chatterCommission -
        monthTotals.chatterBonus -
        (monthTotals as any).awardBonus
    const adjustmentsTotal = adjustments.reduce(
        (sum, val) => sum + (val || 0),
        0,
    )
    const finalRevenue = companyRevenue + adjustmentsTotal
    const profitMargin = monthTotals.total > 0
        ? (finalRevenue / monthTotals.total) * 100
        : 0


    const selectedEntries = selectedDate
        ? dailyData.find((d) => d.fullDate === selectedDate)?.entries || []
        : []

    const dayTotals = useMemo(() => {
        const awardBonus = selectedDate ? awardCostsByDate[selectedDate] || 0 : 0
        // 1) Aggregate raw day sums
        const sums = selectedEntries.reduce(
            (acc, e) => {
                const amount = Number(e.amount) || 0;
                const net = amount * (1 - platformFee / 100);
                const mRate = Number(e.modelCommissionRate) || 0;
                const cRate = Number(e.chatterCommissionRate) || 0;
                const mComm = net * (mRate / 100);
                const cComm = net * (cRate / 100);
                const cBonus = Number(e.chatterBonusAmount) || 0;

                acc.total += amount;
                acc.platformFee += amount - net;
                acc.afterPlatform += net;
                acc.modelCommission += mComm;
                acc.chatterCommission += cComm;
                acc.chatterBonus += cBonus;
                return acc;
            },
            {
                total: 0,
                platformFee: 0,
                afterPlatform: 0,
                modelCommission: 0,
                chatterCommission: 0,
                chatterBonus: 0,
            }
        );
        sums.awardBonus = awardBonus;

        // 2) Derived fields
        const companyRevenue =
            sums.afterPlatform -
            sums.modelCommission -
            sums.chatterCommission -
            sums.chatterBonus -
            sums.awardBonus;

        // If you have per-day adjustments:
        // const dayAdjustmentsTotal =
        //   (adjustmentsByDate?.[selectedDate]?.reduce?.((s: number, v: number) => s + (v || 0), 0)) ?? 0;

        // If you don't track daily adjustments, use 0:
        const dayAdjustmentsTotal = 0;

        const finalRevenue = companyRevenue + dayAdjustmentsTotal;

        const profitMargin = sums.total > 0 ? (finalRevenue / sums.total) * 100 : 0;

        return {
            ...sums,
            companyRevenue,
            finalRevenue,
            profitMargin,        // e.g. 23.45 (percent)
            dayAdjustmentsTotal, // included for completeness
            awardBonus: sums.awardBonus,
        };
    }, [selectedEntries, platformFee, selectedDate, awardCostsByDate /*, adjustmentsByDate */]);

    const dayCompanyRevenue =
        dayTotals.afterPlatform -
        dayTotals.modelCommission -
        dayTotals.chatterCommission -
        dayTotals.chatterBonus -
        dayTotals.awardBonus

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat("nl-NL", {
            style: "currency",
            currency: "EUR",
        }).format(Number.isFinite(amount) ? amount : 0)

    const formatFullDate = (date: string) =>
        formatUserDate(
            new Date(date),
            {
                weekday: "long",
                month: "long",
                day: "numeric",
            },
            "en-EN",
        )

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
                        <div className="h-12 bg-muted rounded"/>
                        <div className="h-12 bg-muted rounded"/>
                        <div className="h-12 bg-muted rounded"/>
                    </div>
                </CardContent>
            </Card>
        )
    }

    const chartConfig = {
        revenue: {
            label: "Profit",
            color: "#6CE8F2",
        },
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    Profit Overview
                </CardTitle>
                <CardDescription>
                    Company revenue for {headerLabel}
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
                                <stop offset="0%" stopColor="#6CE8F2"/>
                                <stop offset="100%" stopColor="#FFA6FF"/>
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="day" tickLine={false} axisLine={false}/>
                        <YAxis tickLine={false} axisLine={false} width={40}/>
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
                            <div className="flex justify-between">
                                <span>Chatter bonuses</span>
                                <span>-{formatCurrency(dayTotals.chatterBonus + (dayTotals.awardBonus || 0))}</span>
                            </div>
                            <div className="flex justify-between font-medium">
                                <span>Company profit</span>
                                <span>{formatCurrency(dayCompanyRevenue)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Profit margin</span>
                                <span>{dayTotals.profitMargin.toFixed(2)}%</span>
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
                                            <X className="h-4 w-4"/>
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
                            <div className="flex justify-between">
                                <span>Chatter bonuses</span>
                                <span>-{formatCurrency(monthTotals.chatterBonus + ((monthTotals as any).awardBonus || 0))}</span>
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
                                <span>Final profit</span>
                                <span>{formatCurrency(finalRevenue)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Profit margin</span>
                                <span>{profitMargin.toFixed(2)}%</span>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

