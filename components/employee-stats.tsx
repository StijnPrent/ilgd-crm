"use client"

import {useEffect, useState} from "react"
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card"
import {DollarSign, TrendingUp, Calendar, Award} from "lucide-react"
import {api} from "@/lib/api"

interface EmployeeStatsProps {
    userId: string
    refreshTrigger?: number
}

interface Stats {
    todayEarnings: number
    weekEarnings: number
    monthEarnings: number
    totalEarnings: number
    currentRank: number
    estimatedCommission: number
    currency: string
    commissionRate: number
    platformFee: number
}

export function EmployeeStats({userId, refreshTrigger}: EmployeeStatsProps) {
    const [stats, setStats] = useState<Stats>({
        todayEarnings: 0,
        weekEarnings: 0,
        monthEarnings: 0,
        totalEarnings: 0,
        currentRank: 0,
        estimatedCommission: 0,
        currency: "EUR",
        commissionRate: 8,
        platformFee: 20,
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!userId) return

        const fetchStats = async () => {
            try {
                const [earningsData, chatter, leaderboard] = await Promise.all([
                    api.getEmployeeEarningsByChatter(userId),
                    api.getChatter(userId).catch(() => null),
                    api.getEmployeeEarningsLeaderboard().catch(() => []),
                ])
                const TZ = "Europe/Amsterdam";
                const ymdFmt = new Intl.DateTimeFormat("en-CA", {
                    timeZone: TZ,
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                });
                const toYMD = (d: Date | string) => ymdFmt.format(new Date(d));

                const nowLocal = new Date(new Date().toLocaleString("en-US", {timeZone: TZ}));

                const weekStartLocal = new Date(nowLocal);
                weekStartLocal.setHours(0, 0, 0, 0);
                const mondayIndex = (weekStartLocal.getDay() + 6) % 7;
                weekStartLocal.setDate(weekStartLocal.getDate() - mondayIndex);

                const monthStartLocal = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), 1);
                monthStartLocal.setHours(0, 0, 0, 0);

                const today = toYMD(nowLocal);
                const weekStartYMD = toYMD(weekStartLocal);
                const monthStartYMD = toYMD(monthStartLocal);

                const normalized = (earningsData || []).map((e: any) => ({
                    ...e,
                    _ymd: toYMD(e.date || e.createdAt),
                    _amount: Number(e.amount) || 0,
                }));

                const todayTotal = normalized
                    .filter(e => e._ymd === today)
                    .reduce((sum, e) => sum + e._amount, 0);

                const weekTotal = normalized
                    .filter(e => e._ymd >= weekStartYMD)
                    .reduce((sum, e) => sum + e._amount, 0);

                const monthTotal = normalized
                    .filter(e => e._ymd >= monthStartYMD)
                    .reduce((sum, e) => sum + e._amount, 0);

                const allTimeTotal = normalized.reduce((sum, e) => sum + e._amount, 0);

                const currency = chatter?.currency || "EUR"
                const commissionRate = chatter?.commissionRate || 0
                const platformFee = chatter?.platformFee || 20
                const platformTotal = monthTotal * (platformFee / 100)

                const estimatedCommission = (monthTotal - platformTotal) * (commissionRate / 100)

                const rankEntry = (leaderboard || []).find(
                    (entry: any) => String(entry.chatterId) === String(userId),
                )
                const currentRank = rankEntry?.rank || 0

                setStats({
                    todayEarnings: todayTotal,
                    weekEarnings: weekTotal,
                    monthEarnings: monthTotal,
                    totalEarnings: allTimeTotal,
                    currentRank,
                    estimatedCommission,
                    currency,
                    commissionRate,
                    platformFee,
                })
            } catch (err) {
                console.error("Error fetching employee stats:", err)
            } finally {
                setLoading(false)
            }
        }

        fetchStats()
    }, [userId, refreshTrigger])

    const formatCurrency = (amount: number) => {
        const map: Record<string, string> = {"€": "EUR", "$": "USD", "£": "GBP", EUR: "EUR", USD: "USD", GBP: "GBP"}
        const currencyCode = map[stats.currency] || "EUR"
        return new Intl.NumberFormat("nl-NL", {style: "currency", currency: currencyCode}).format(amount)
    }

    if (loading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <Card key={i}>
                        <CardContent className="p-6">
                            <div className="animate-pulse space-y-2">
                                <div className="h-4 bg-muted rounded w-1/2"/>
                                <div className="h-8 bg-muted rounded w-3/4"/>
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
                    <CardTitle className="text-sm font-medium">Today's Earnings</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(stats.todayEarnings)}</div>
                    <p className="text-xs text-muted-foreground">Revenue generated today</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">This Week</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(stats.weekEarnings)}</div>
                    <p className="text-xs text-muted-foreground">Weekly performance</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Monthly Commission</CardTitle>
                    <Calendar className="h-4 w-4 text-green-600"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.estimatedCommission)}</div>
                    <p className="text-xs text-muted-foreground">From {formatCurrency(stats.monthEarnings)} revenue</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Current Rank</CardTitle>
                    <Award className="h-4 w-4 text-muted-foreground"/>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">#{stats.currentRank || "N/A"}</div>
                    <p className="text-xs text-muted-foreground">Team leaderboard position</p>
                </CardContent>
            </Card>
        </div>
    )
}
