"use client"

import type React from "react"
import {useCallback, useEffect, useMemo, useState} from "react"
import {useRouter, useSearchParams} from "next/navigation"

import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card"
import {Badge} from "@/components/ui/badge"
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {LogoutButton} from "@/components/logout-button"
import {ManagerStats} from "@/components/manager-stats"
import {ChattersList} from "@/components/chatters-list"
import {ModelsList} from "@/components/models-list"
import {ModelsEarningsLeaderboard} from "@/components/models-earnings-leaderboard"
import {EarningsOverview} from "@/components/earnings-overview"
import {ShiftManager} from "@/components/shift-manager"
import {CommissionCalculator} from "@/components/commission-calculator"
import {Leaderboard} from "@/components/leaderboard"
import {CreateChatterForm} from "@/components/create-chatter-form"
import {WeeklyCalendar} from "@/components/weekly-calendar"
import {EmployeeEarningsProvider} from "@/hooks/use-employee-earnings"
import {RevenueOverview} from "@/components/revenue-overview"
import {
    Users,
    Calendar,
    TrendingUp,
    Award,
    Settings,
    UserPlus,
    RotateCcw,
    Shield,
    User,
    PieChart,
    Euro,
    Percent,
    ChevronLeft,
    ChevronRight,
} from "lucide-react"
import Image from "next/image"

import {api} from "@/lib/api"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"

/** Tiny JWT decoder so we can recover userId if localStorage is stale */
function decodeJwtPayload<T = any>(token: string): T | null {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    try {
        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
        const json = typeof window === "undefined"
            ? Buffer.from(base64, "base64").toString("utf8")
            : atob(base64)
        return JSON.parse(json) as T
    } catch {
        return null
    }
}

const formatMonthKey = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    return `${year}-${month}`
}

const formatMonthLabel = (date: Date) =>
    date.toLocaleDateString("nl-NL", {month: "long", year: "numeric"})

export function ManagerDashboard() {
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const searchParams = useSearchParams()
    const initialTab = searchParams.get('tab') ?? 'overview'
    const [activeTab, setActiveTab] = useState<string>(initialTab)

    const [selectedMonth, setSelectedMonth] = useState<Date>(() => {
        const now = new Date()
        return new Date(now.getFullYear(), now.getMonth(), 1)
    })

    const monthKey = useMemo(() => formatMonthKey(selectedMonth), [selectedMonth])
    const monthStart = useMemo(() => `${monthKey}-01`, [monthKey])
    const monthEnd = useMemo(() => {
        const end = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0)
        return end.toISOString().split("T")[0]
    }, [selectedMonth])
    const monthLabel = useMemo(() => formatMonthLabel(selectedMonth), [selectedMonth])

    const monthOptions = useMemo(() => {
        const reference = new Date()
        reference.setDate(1)
        return Array.from({length: 12}, (_, index) => {
            const date = new Date(reference.getFullYear(), reference.getMonth() - index, 1)
            return {
                value: formatMonthKey(date),
                label: formatMonthLabel(date),
            }
        })
    }, [])

    const earliestMonthValue = monthOptions[monthOptions.length - 1]?.value ?? monthKey
    const latestMonthValue = monthOptions[0]?.value ?? monthKey

    const goToPreviousMonth = useCallback(() => {
        setSelectedMonth((current) => {
            const candidate = new Date(current.getFullYear(), current.getMonth() - 1, 1)
            if (formatMonthKey(candidate) < earliestMonthValue) {
                return current
            }
            return candidate
        })
    }, [earliestMonthValue])

    const goToNextMonth = useCallback(() => {
        setSelectedMonth((current) => {
            const candidate = new Date(current.getFullYear(), current.getMonth() + 1, 1)
            if (formatMonthKey(candidate) > latestMonthValue) {
                return current
            }
            return candidate
        })
    }, [latestMonthValue])

    const handleMonthSelect = useCallback((value: string) => {
        const [yearStr, monthStr] = value.split("-")
        const year = Number(yearStr)
        const monthIndex = Number(monthStr) - 1
        if (Number.isNaN(year) || Number.isNaN(monthIndex)) return
        setSelectedMonth(new Date(year, monthIndex, 1))
    }, [])

    const [managerForm, setManagerForm] = useState({username: "", password: "", fullName: ""})
    const [isCreatingManager, setIsCreatingManager] = useState(false)
    const router = useRouter()

    useEffect(() => {
        let cancelled = false

        const bootstrap = async () => {
            if (typeof window === "undefined") return
            try {
                console.log("[manager] bootstrap start")

                // 1) Require token
                const token = localStorage.getItem("auth_token")
                if (!token) {
                    console.warn("[manager] no token -> login")
                    router.replace("/auth/login")
                    return
                }

                // 2) Resolve user id from localStorage OR JWT payload
                const storedUserRaw = localStorage.getItem("user")
                let storedUser: any = null
                try {
                    storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null
                } catch {
                }
                let userId: string | null = storedUser?.id ? String(storedUser.id) : null

                if (!userId) {
                    const payload = decodeJwtPayload<{ sub?: string; userId?: string; id?: string }>(token)
                    userId = payload?.sub || payload?.userId || payload?.id || null
                }
                if (!userId) {
                    console.warn("[manager] cannot resolve userId from storage or token -> login")
                    localStorage.removeItem("auth_token")
                    localStorage.removeItem("user")
                    router.replace("/auth/login")
                    return
                }

                // 3) Verify session with API and fetch user
                console.log("[manager] fetching user", userId)
                const baseUser = await api.getUser(userId) // GET /users/:id

                // 4) Authorize role
                const role = (baseUser?.role ?? "").toString().toLowerCase()
                console.log("[manager] api role =", role)
                if (role !== "manager") {
                    console.warn("[manager] role != manager -> login")
                    router.replace("/auth/login")
                    return
                }

                // 5) Normalize for header/UI
                const normalized = {
                    id: String(baseUser.id),
                    profile: {
                        full_name:
                            baseUser.fullName ??
                            baseUser.full_name ??
                            baseUser.name ??
                            baseUser.username ??
                            "Manager",
                        username: baseUser.username ?? storedUser?.username ?? "",
                        role: "manager",
                    },
                }

                // 6) Refresh localStorage (keeps other pages happy)
                localStorage.setItem(
                    "user",
                    JSON.stringify({
                        id: normalized.id,
                        username: normalized.profile.username,
                        fullName: normalized.profile.full_name,
                        role: "manager",
                    })
                )

                if (!cancelled) {
                    setUser(normalized)
                    setLoading(false)
                    console.log("[manager] bootstrap ok")
                }
            } catch (err: any) {
                console.error("[manager] bootstrap error:", err)
                localStorage.removeItem("auth_token")
                localStorage.removeItem("user")
                router.replace("/auth/login")
            }
        }

        bootstrap()
        return () => {
            cancelled = true
        }
    }, [router])

    useEffect(() => {
        // only push if it actually changed
        if ((searchParams.get('tab') ?? 'overview') !== activeTab) {
            const url = new URL(window.location.href)
            url.searchParams.set('tab', activeTab)
            router.replace(url.pathname + url.search)
        }
    }, [activeTab, router, searchParams])

    const createManagerAccount = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsCreatingManager(true)
        try {
            const payload = {
                username: managerForm.username.trim(),
                password: managerForm.password, // backend hashes
                fullName: managerForm.fullName.trim(),
                role: "manager",
            }
            const created = await api.createUser(payload) // POST /users
            setManagerForm({username: "", password: "", fullName: ""})
        } catch (error: any) {
            console.error("[manager] create manager error:", error)
        } finally {
            setIsCreatingManager(false)
        }
    }

    const resetSystem = async () => {
        if (!confirm("Dit wist alle chatter data (accounts, shifts, earnings). Doorgaan?")) return
        if (!confirm("LAATSTE WAARSCHUWING: permanent wissen. Weet je het zeker?")) return

        try {
            const [chatters, earnings, shifts] = await Promise.all([
                api.getChatters(),
                api.getEmployeeEarnings(),
                api.getShifts(),
            ])

            await Promise.all([
                Promise.allSettled((chatters ?? []).map((c: any) => api.deleteChatter(String(c.id)))),
                Promise.allSettled((earnings ?? []).map((e: any) => api.deleteEmployeeEarning(String(e.id)))),
                Promise.allSettled((shifts ?? []).map((s: any) => api.deleteShift(String(s.id)))),
            ])

            alert("Systeem gereset! Alle chatter data is gewist.")
            window.location.reload()
        } catch (err) {
            console.error("[manager] resetSystem error:", err)
            alert("Reset mislukt. Controleer de serverlogs en probeer opnieuw.")
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b bg-card">
                <div className="container mx-auto px-4 p2-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <Image src="/logo.png" alt="Logo" width={90} height={90}/>
                            <div className="ml-4">
                                <h1 className="text-2xl font-bold text-foreground">Manager Dashboard</h1>
                                <p className="text-muted-foreground">Welcome back, {user?.profile?.full_name}</p>
                            </div>
                        </div>
                        <div className="md:flex items-center gap-4 hidden">
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                                <Settings className="h-3 w-3 mr-1"/>
                                Manager
                            </Badge>
                            <LogoutButton/>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-6">
                <EmployeeEarningsProvider from={monthStart} to={monthEnd}>
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
                        <div>
                            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                                Data range
                            </p>
                            <h2 className="text-2xl font-semibold text-foreground">{monthLabel}</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={goToPreviousMonth}
                                disabled={monthKey === earliestMonthValue}
                                aria-label="Vorige maand"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Select value={monthKey} onValueChange={handleMonthSelect}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Kies maand" />
                                </SelectTrigger>
                                <SelectContent>
                                    {monthOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={goToNextMonth}
                                disabled={monthKey === latestMonthValue}
                                aria-label="Volgende maand"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    {/* Stats Overview */}
                    <div className="mb-8">
                        <ManagerStats monthLabel={monthLabel} monthStart={monthStart} monthEnd={monthEnd}/>
                    </div>

                    {/* Tabs */}
                    <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="overview" className="space-y-6">
                        <TabsList className="grid w-full grid-cols-7">
                            <TabsTrigger value="overview" className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4"/>
                                <span className="hidden sm:inline">Overview</span>
                            </TabsTrigger>
                            <TabsTrigger value="accounts" className="flex items-center gap-2">
                                <UserPlus className="h-4 w-4"/>
                                <span className="hidden sm:inline">Accounts</span>
                            </TabsTrigger>
                            <TabsTrigger value="models" className="flex items-center gap-2">
                                <User className="h-4 w-4"/>
                                <span className="hidden sm:inline">Models</span>
                            </TabsTrigger>

                            <TabsTrigger value="earnings" className="flex items-center gap-2">
                                <Euro className="h-4 w-4"/> {/* fixed size */}
                                <span className="hidden sm:inline">Earnings</span>
                            </TabsTrigger>
                            <TabsTrigger value="shifts" className="flex items-center gap-2">
                                <Calendar className="h-4 w-4"/>
                                <span className="hidden sm:inline">Shifts</span>
                            </TabsTrigger>
                            <TabsTrigger value="commissions" className="flex items-center gap-2">
                                <Percent className="h-4 w-4"/>
                                <span className="hidden sm:inline">Commissions</span>
                            </TabsTrigger>
                            <TabsTrigger value="revenue" className="flex items-center gap-2">
                                <PieChart className="h-4 w-4"/>
                                <span className="hidden sm:inline">Profit</span>
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="overview" className="space-y-6">
                            <div className="mb-6">
                                <WeeklyCalendar showChatterNames compact/>
                            </div>
                            <div className="grid gap-6 md:grid-cols-3">
                                <div className="md:col-span-2">
                                    <EarningsOverview
                                        limit={5}
                                        monthLabel={monthLabel}
                                        monthStart={monthStart}
                                        monthEnd={monthEnd}
                                    />
                                </div>
                                <div className="md:col-span-1">
                                    <Leaderboard
                                        limit={3}
                                        monthLabel={monthLabel}
                                        monthStart={monthStart}
                                        monthEnd={monthEnd}
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="accounts">
                            <div className="grid gap-6 md:grid-cols-2">
                                <CreateChatterForm/>
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Shield className="h-5 w-5"/>
                                            Create Manager Account
                                        </CardTitle>
                                        <CardDescription>Create new manager accounts with full dashboard
                                            access</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <form onSubmit={createManagerAccount} className="space-y-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="manager-username">Username</Label>
                                                <Input
                                                    id="manager-username"
                                                    type="text"
                                                    placeholder="Enter manager username"
                                                    value={managerForm.username}
                                                    onChange={(e) => setManagerForm({
                                                        ...managerForm,
                                                        username: e.target.value
                                                    })}
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="manager-fullname">Full Name</Label>
                                                <Input
                                                    id="manager-fullname"
                                                    type="text"
                                                    placeholder="Enter full name"
                                                    value={managerForm.fullName}
                                                    onChange={(e) => setManagerForm({
                                                        ...managerForm,
                                                        fullName: e.target.value
                                                    })}
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="manager-password">Password</Label>
                                                <Input
                                                    id="manager-password"
                                                    type="password"
                                                    placeholder="Enter password"
                                                    value={managerForm.password}
                                                    onChange={(e) => setManagerForm({
                                                        ...managerForm,
                                                        password: e.target.value
                                                    })}
                                                    required
                                                />
                                            </div>
                                            <Button type="submit" className="w-full" disabled={isCreatingManager}>
                                                {isCreatingManager ? "Creating..." : "Create Manager Account"}
                                            </Button>
                                        </form>
                                    </CardContent>
                                </Card>
                            </div>
                            <div className="mt-6">
                                <ChattersList/>
                            </div>
                        </TabsContent>

                        <TabsContent value="models">
                            <div className="grid md:grid-cols-3 gap-6">
                                <div className="md:col-span-2">
                                    <ModelsList/>
                                </div>
                                <div className="md:col-span-1">
                                    <ModelsEarningsLeaderboard monthStart={monthStart} monthEnd={monthEnd} monthLabel={monthLabel}/>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="earnings">
                            <EarningsOverview monthLabel={monthLabel} monthStart={monthStart} monthEnd={monthEnd}/>
                        </TabsContent>

                        <TabsContent value="shifts">
                            <ShiftManager/>
                        </TabsContent>

                        <TabsContent value="commissions">
                            <CommissionCalculator/>
                        </TabsContent>
                        <TabsContent value="revenue">
                            <RevenueOverview monthLabel={monthLabel} monthStart={monthStart} monthEnd={monthEnd}/>
                        </TabsContent>
                    </Tabs>
                </EmployeeEarningsProvider>
            </main>
        </div>
    )
}
