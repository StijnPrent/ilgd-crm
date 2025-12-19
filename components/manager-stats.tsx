"use client"

import {useEffect, useMemo, useState} from "react"

import {Users, Clock, TrendingUp} from "lucide-react"

import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card"
import {api} from "@/lib/api"
import {getStartOfDayInTimezone, getUserTimezone} from "@/lib/timezone"

const parseIsoDateOnly = (value: string | null | undefined) => {
    if (!value) return null
    const [yearStr, monthStr, dayStr] = value.split("-")
    const year = Number(yearStr)
    const month = Number(monthStr)
    const day = Number(dayStr)
    if (![year, month, day].every((part) => Number.isFinite(part))) return null
    return new Date(Date.UTC(year, month - 1, day))
}

const isoDateString = (date: Date) => date.toISOString().split("T")[0]

interface Stats {
    totalChatters: number
    currentlyOnline: number
    totalEarningsDay: number
    totalEarningsWeek: number
    totalEarningsMonth: number
    dayLabel: string
}

interface ManagerStatsProps {
    userId?: string | null
    monthLabel: string
    monthStart: string
    monthEnd: string
}

export function ManagerStats({userId, monthLabel, monthStart, monthEnd}: ManagerStatsProps) {
    const userTimezone = useMemo(() => getUserTimezone(), [])
    const [stats, setStats] = useState<Stats>({
        totalChatters: 0,
        currentlyOnline: 0,
        totalEarningsDay: 0,
        totalEarningsWeek: 0,
        totalEarningsMonth: 0,
        dayLabel: "",
    })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [retryCount, setRetryCount] = useState(0)

    const currencyFormatter = useMemo(
        () =>
            new Intl.NumberFormat("nl-NL", {
                style: "currency",
                currency: "EUR",
            }),
        [],
    )

    const dayLabelFormatter = useMemo(
        () =>
            new Intl.DateTimeFormat("nl-NL", {
                weekday: "short",
                day: "numeric",
                month: "short",
                timeZone: userTimezone,
            }),
        [userTimezone],
    )

    const dateContext = useMemo(() => {
        const startDate = parseIsoDateOnly(monthStart) ?? getStartOfDayInTimezone(new Date(), userTimezone)
        const endDate = parseIsoDateOnly(monthEnd) ?? startDate
        const todayAmsterdam = getStartOfDayInTimezone(new Date(), userTimezone)
        const todayMonthKey = `${todayAmsterdam.getUTCFullYear()}-${String(todayAmsterdam.getUTCMonth() + 1).padStart(2, "0")}`
        const selectedMonthKey = monthStart?.slice(0, 7) ?? todayMonthKey

        let focusDate = todayMonthKey === selectedMonthKey ? todayAmsterdam : endDate
        if (focusDate.getTime() < startDate.getTime()) {
            focusDate = new Date(startDate.getTime())
        }
        if (focusDate.getTime() > endDate.getTime()) {
            focusDate = new Date(endDate.getTime())
        }

        const weekStart = new Date(focusDate.getTime())
        const dayOfWeek = weekStart.getUTCDay()
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
        weekStart.setUTCDate(weekStart.getUTCDate() + diff)
        if (weekStart.getTime() < startDate.getTime()) {
            weekStart.setTime(startDate.getTime())
        }

        return {
            fromParam: isoDateString(startDate),
            toParam: isoDateString(focusDate),
            weekStartDate: weekStart,
            focusDate,
        }
    }, [monthEnd, monthStart, userTimezone])

    const weekRangeLabel = useMemo(() => {
        const startLabel = dayLabelFormatter.format(new Date(dateContext.weekStartDate))
        const endLabel = dayLabelFormatter.format(new Date(dateContext.focusDate))
        return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`
    }, [dateContext, dayLabelFormatter])

    useEffect(() => {
        let cancelled = false

        const loadStats = async () => {
            // Wait until auth is available to avoid running before login storage is ready.
            if (!userId) {
                setLoading(false)
                return
            }

            setLoading(true)
            setError(null)
            try {
                const [chatters, onlineChatters, revenueStats] = await Promise.all([
                    api.getChatters(),
                    api.getOnlineChatters(),
                    api.getRevenueStats({from: dateContext.fromParam, to: dateContext.toParam}),
                ])

                if (cancelled) return

                const resolveCount = (value: any) => {
                    if (Array.isArray(value)) return value.length
                    if (Array.isArray(value?.data)) return value.data.length
                    const maybeLength = Number(value?.length)
                    return Number.isFinite(maybeLength) ? maybeLength : 0
                }

                const statsPayload = {
                    totalChatters: resolveCount(chatters),
                    currentlyOnline: resolveCount(onlineChatters),
                    totalEarningsDay: Number(revenueStats?.daily ?? 0) || 0,
                    totalEarningsWeek: Number(revenueStats?.weekly ?? 0) || 0,
                    totalEarningsMonth: Number(revenueStats?.monthly ?? 0) || 0,
                    dayLabel: dayLabelFormatter.format(new Date()),
                }

                setStats(statsPayload)
            } catch (err) {
                console.error("Error loading manager stats:", err)
                if (!cancelled && retryCount < 1) {
                    // Retry once after a short delay to cover the case where auth just became available.
                    setTimeout(() => setRetryCount((prev) => prev + 1), 400)
                }
                if (!cancelled) {
                    setError("Kon statistieken niet laden")
                }
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }

        loadStats()

        return () => {
            cancelled = true
        }
    }, [dateContext.fromParam, dateContext.toParam, dayLabelFormatter, retryCount, userId])

    if (loading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <Card key={i}>
                        <CardContent className="p-6">
                            <div className="animate-pulse space-y-2">
                                <div className="h-4 w-1/2 rounded bg-muted"></div>
                                <div className="h-8 w-3/4 rounded bg-muted"></div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Chatters</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.totalChatters}</div>
                    <p className="text-xs text-muted-foreground">Active employees</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Currently clocked-in</CardTitle>
                    <Clock className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-600">{stats.currentlyOnline}</div>
                    <p className="text-xs text-muted-foreground">Clocked in now</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Dagomzet</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{currencyFormatter.format(stats.totalEarningsDay)}</div>
                    <p className="text-xs text-muted-foreground">voor {stats.dayLabel}</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{monthLabel}</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{currencyFormatter.format(stats.totalEarningsMonth)}</div>
                    <p className="text-xs text-muted-foreground">
                        Week ({weekRangeLabel}): {currencyFormatter.format(stats.totalEarningsWeek)}
                    </p>
                </CardContent>
            </Card>

            {error && (
                <Card className="md:col-span-2 lg:col-span-4 border-dashed border-red-300 bg-red-50/60">
                    <CardContent className="py-3 text-sm text-red-700">
                        {error}. We tonen tijdelijk 0,00; herladen of check je verbinding.
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
