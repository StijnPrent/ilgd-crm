"use client"

import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react"

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {Button} from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {
    Calendar,
    User,
    UserCircle,
    MessageSquare,
    Gift,
    Repeat,
    FileText,
    X,
    Filter,
    Clock,
    Loader2,
} from "lucide-react"
import {Bar, BarChart, Cell, XAxis, YAxis} from "recharts"

import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart"
import {api} from "@/lib/api"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
    PaginationEllipsis,
} from "@/components/ui/pagination"
import {Badge} from "@/components/ui/badge"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel, DropdownMenuPortal,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const DEFAULT_PAGE_SIZE = 10
const DEFAULT_ITEM_TYPES = [
    "paypermessage",
    "tip",
    "subscriptionperiod",
    "payperpost",
] as const

const ITEM_LABELS: Record<string, string> = {
    paypermessage: "Pay per message",
    tip: "Tip",
    subscriptionperiod: "Subscription period",
    payperpost: "Pay per post",
}

const formatItemLabel = (value: string) => {
    const fromMap = ITEM_LABELS[value]
    if (fromMap) return fromMap

    return value
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[\-_]/g, " ")
        .split(" ")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
}

const parseTotalCount = (value: any) => {
    if (typeof value === "number") return value
    if (typeof value === "string") {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : 0
    }
    if (value && typeof value === "object") {
        const possible = value.total ?? value.count ?? value.data ?? 0
        const parsed = Number(possible)
        return Number.isFinite(parsed) ? parsed : 0
    }
    return 0
}

const buildShiftLabel = (
    shift: any,
    chatterLookup: Map<undefined, undefined>,
) => {
    if (!shift) return `Shift #${shift?.id ?? ""}`

    const start = shift.startTime ? new Date(shift.startTime) : shift.date ? new Date(shift.date) : null
    const end = shift.endTime ? new Date(shift.endTime) : null

    const dateLabel = start
        ? start.toLocaleDateString("nl-NL", {
            month: "short",
            day: "numeric",
        })
        : `Shift #${shift.id}`

    const timeParts: string[] = []
    if (start) {
        timeParts.push(
            start.toLocaleTimeString("nl-NL", {hour: "2-digit", minute: "2-digit"}),
        )
    }
    if (end) {
        timeParts.push(
            end.toLocaleTimeString("nl-NL", {hour: "2-digit", minute: "2-digit"}),
        )
    }
    const timeLabel = timeParts.join(" - ")

    const chatterName = chatterLookup.get(shift.chatterId)

    return [dateLabel, timeLabel, chatterName].filter(Boolean).join(" · ")
}

interface EarningsOverviewProps {
    limit?: number
}

interface EarningsData {
    id: string
    date: string
    amount: number
    description: string | null
    type: string
    chatterId: string | null
    chatter: {
        full_name: string
    } | null
    modelId: string | null
    model: {
        display_name: string
    } | null
    shiftId: string | null
    shift: {
        label: string
    } | null
}

interface FilterState {
    shiftId: string | null
    modelId: string | null
    chatterId: string | null
    items: string[]
}

export function EarningsOverview({limit}: EarningsOverviewProps) {
    const isCompact = typeof limit === "number"
    const [rawTableEarnings, setRawTableEarnings] = useState<any[]>([])
    const [rawMonthlyEarnings, setRawMonthlyEarnings] = useState<any[]>([])
    const [chatters, setChatters] = useState<{ id: string; full_name: string }[]>([])
    const [models, setModels] = useState<{ id: string; display_name: string }[]>([])
    const [shifts, setShifts] = useState<{ id: string; label: string }[]>([])
    const [chatterMap, setChatterMap] = useState<Map<unknown, unknown>>(new Map())
    const [modelMap, setModelMap] = useState<Map<string, string>>(new Map())
    const [shiftMap, setShiftMap] = useState<Map<unknown, unknown>>(new Map())
    const [filters, setFilters] = useState<FilterState>({
        shiftId: null,
        modelId: null,
        chatterId: null,
        items: [],
    })
    const [selectedDate, setSelectedDate] = useState<string | null>(null)
    const [hoveredBar, setHoveredBar] = useState<number | null>(null)
    const [syncOpen, setSyncOpen] = useState(false)
    const [syncLoading, setSyncLoading] = useState(false)
    const [syncFrom, setSyncFrom] = useState("")
    const [syncTo, setSyncTo] = useState("")
    const [page, setPage] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const [tableLoading, setTableLoading] = useState(true)
    const [chartLoading, setChartLoading] = useState(!isCompact)
    const pageSize = DEFAULT_PAGE_SIZE
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`
    const monthStart = `${monthKey}-01`
    const monthEnd = new Date(year, month + 1, 0)
        .toISOString()
        .split("T")[0]

    const mapEarning = useCallback(
        (earning: any): EarningsData => {
            const chatterId = earning.chatterId ? String(earning.chatterId) : null
            const chatterName = chatterId
                ? chatterMap.get(chatterId) ?? "Wolf"
                : "Wolf"
            const modelId = earning.modelId ? String(earning.modelId) : null
            const modelName = modelId
                ? modelMap.get(modelId) ?? "Unknown"
                : "Unknown"
            const shiftId = earning.shiftId ? String(earning.shiftId) : null
            const shiftLabel = shiftId ? shiftMap.get(shiftId) ?? "" : ""

            return {
                id: String(earning.id),
                date: earning.date,
                amount: Number(earning.amount),
                description: earning.description,
                type: earning.type,
                chatterId,
                chatter: chatterId ? {full_name: chatterName} : null,
                modelId,
                model: modelId ? {display_name: modelName} : null,
                shiftId,
                shift: shiftId && shiftLabel ? {label: shiftLabel} : null,
            } as EarningsData
        },
        [chatterMap, modelMap, shiftMap],
    )

    const earnings = useMemo(
        () => rawTableEarnings.map(mapEarning),
        [rawTableEarnings, mapEarning],
    )
    const monthlyEarnings = useMemo(
        () => rawMonthlyEarnings.map(mapEarning),
        [rawMonthlyEarnings, mapEarning],
    )

    const itemOptions = useMemo(() => {
        const unique = new Set<string>(DEFAULT_ITEM_TYPES)
        rawTableEarnings.forEach((entry) => {
            if (entry?.type) unique.add(String(entry.type))
        })
        rawMonthlyEarnings.forEach((entry) => {
            if (entry?.type) unique.add(String(entry.type))
        })
        return Array.from(unique).map((value) => ({
            value,
            label: formatItemLabel(value),
        }))
    }, [rawTableEarnings, rawMonthlyEarnings])

    const formatCurrency = useCallback((amount: number) => {
        return new Intl.NumberFormat("nl-NL", {
            style: "currency",
            currency: "EUR",
        }).format(amount)
    }, [])

    const formatDate = useCallback((value: string) => {
        const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
        if (!match) return value
        const months = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
        ]
        return `${months[Number(match[2]) - 1]} ${Number(match[3])}`
    }, [])

    useEffect(() => {
        let cancelled = false

        const loadMetadata = async () => {
            try {
                const [chattersData, usersData, modelsData, shiftsData] = await Promise.all([
                    api.getChatters(),
                    api.getUsers(),
                    api.getModels(),
                    api.getShifts(),
                ])

                if (cancelled) return

                const userMap = new Map(
                    (usersData || []).map((user: any) => [String(user.id), user.fullName || user.full_name || ""]),
                )

                const activeChatters = (chattersData || []).filter(
                    (chatter: any) => chatter.status !== "inactive",
                )

                const chatterEntries = [
                    {id: "unknown", full_name: "Wolf"},
                    ...activeChatters.map((chatter: any) => ({
                        id: String(chatter.id),
                        full_name: userMap.get(String(chatter.id)) || "",
                    })),
                ]
                const chatterLookup = new Map(
                    chatterEntries.map((entry) => [entry.id, entry.full_name]),
                )

                setChatters(chatterEntries)
                setChatterMap(chatterLookup)

                const modelEntries = (modelsData || []).map((model: any) => ({
                    id: String(model.id),
                    display_name: model.displayName || model.name || "Unknown",
                }))
                const modelLookup: Map<string, string> = new Map(
                    modelEntries.map((entry) => [entry.id, entry.display_name]),
                )
                setModels(modelEntries)
                setModelMap(modelLookup)

                const shiftsList = (shiftsData || []).map((shift: any) => ({
                    id: String(shift.id),
                    label: buildShiftLabel(shift, chatterLookup),
                }))
                setShifts(shiftsList)
                setShiftMap(new Map(shiftsList.map((entry) => [entry.id, entry.label])))
            } catch (error) {
                console.error("Error loading metadata:", error)
                setChatters([{id: "unknown", full_name: "Wolf"}])
            }
        }

        loadMetadata()
        return () => {
            cancelled = true
        }
    }, [])

    const buildQueryFilters = useCallback(
        (options?: { includeDate?: boolean }) => {
            const params: {
                chatterId?: string
                modelId?: string
                shiftId?: string
                types?: string[]
                date?: string
            } = {}

            if (filters.chatterId) {
                params.chatterId = filters.chatterId
            }
            if (filters.modelId) {
                params.modelId = filters.modelId
            }
            if (filters.shiftId) {
                params.shiftId = filters.shiftId
            }
            if (filters.items.length > 0) {
                params.types = filters.items
            }
            if (options?.includeDate && selectedDate) {
                params.date = selectedDate
            }

            return params
        },
        [filters, selectedDate],
    )

    const fetchChartData = useCallback(async () => {
        if (isCompact) return
        setChartLoading(true)
        try {
            const response = await api.getEmployeeEarningsPaginated({
                limit: 1000,
                offset: 0,
                from: monthStart,
                to: monthEnd,
                ...buildQueryFilters(),
            })
            const items = Array.isArray(response) ? response : response?.data || []
            const monthData = items.filter((item: any) => item.date?.startsWith(monthKey))
            setRawMonthlyEarnings(monthData)
        } catch (error) {
            console.error("Error loading chart data:", error)
            setRawMonthlyEarnings([])
        } finally {
            setChartLoading(false)
        }
    }, [buildQueryFilters, isCompact, monthEnd, monthKey, monthStart])

    const fetchTableData = useCallback(async () => {
        setTableLoading(true)
        try {
            if (isCompact && typeof limit === "number") {
                const [listResponse, totalResponse] = await Promise.all([
                    api.getEmployeeEarningsPaginated({limit, offset: 0}),
                    api.getTotalCount(),
                ])
                const listItems = Array.isArray(listResponse)
                    ? listResponse
                    : listResponse?.data || []
                setRawTableEarnings(listItems)
                setTotalCount(parseTotalCount(totalResponse))
                return
            }

            const [listResponse, totalResponse] = await Promise.all([
                api.getEmployeeEarningsPaginated({
                    limit: pageSize,
                    offset: (page - 1) * pageSize,
                    ...buildQueryFilters({includeDate: true}),
                }),
                api.getTotalCount(buildQueryFilters({includeDate: true})),
            ])
            const listItems = Array.isArray(listResponse)
                ? listResponse
                : listResponse?.data || []
            setRawTableEarnings(listItems)
            setTotalCount(parseTotalCount(totalResponse))
        } catch (error) {
            console.error("Error loading earnings:", error)
            setRawTableEarnings([])
            setTotalCount(0)
        } finally {
            setTableLoading(false)
        }
    }, [buildQueryFilters, isCompact, limit, page, pageSize])

    useEffect(() => {
        fetchTableData()
    }, [fetchTableData])

    useEffect(() => {
        if (!isCompact) {
            fetchChartData()
        }
    }, [fetchChartData, isCompact])

    useEffect(() => {
        setPage(1)
    }, [
        filters.chatterId,
        filters.modelId,
        filters.shiftId,
        filters.items.join("|"),
        selectedDate,
    ])

    const chartData = useMemo(() => {
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        return Array.from({length: daysInMonth}, (_, index) => {
            const day = index + 1
            const fullDate = `${monthKey}-${String(day).padStart(2, "0")}`
            const dayEntries = monthlyEarnings.filter((entry) =>
                entry.date.startsWith(fullDate),
            )
            const total = dayEntries.reduce(
                (sum, entry) => sum + Number(entry.amount ?? 0),
                0,
            )
            return {day, total, fullDate}
        })
    }, [month, monthKey, monthlyEarnings, year])

    const pageCount = Math.ceil(totalCount / pageSize)

    const paginationNumbers = useMemo(() => {
        if (pageCount <= 5) {
            return Array.from({length: pageCount}, (_, index) => index + 1)
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

    const activeFilterCount = useMemo(() => {
        let count = 0
        if (filters.shiftId) count += 1
        if (filters.modelId) count += 1
        if (filters.chatterId) count += 1
        if (filters.items.length > 0) count += 1
        return count
    }, [filters])

    const filterSummary = useMemo(() => {
        const items: { key: string; label: string }[] = []
        if (filters.shiftId) {
            const label = shiftMap.get(filters.shiftId)
            if (label) items.push({key: `shift-${filters.shiftId}`, label: `Shift: ${label}`})
        }
        if (filters.modelId) {
            const label = modelMap.get(filters.modelId)
            if (label) items.push({key: `model-${filters.modelId}`, label: `Model: ${label}`})
        }
        if (filters.chatterId) {
            const label = chatterMap.get(filters.chatterId)
            if (label) items.push({key: `chatter-${filters.chatterId}`, label: `Chatter: ${label}`})
        }
        if (filters.items.length > 0) {
            const labels = filters.items
                .map((value) => formatItemLabel(value))
                .join(", ")
            items.push({key: "items", label: `Items: ${labels}`})
        }
        return items
    }, [chatterMap, filters, modelMap, shiftMap])

    const handleChatterChange = useCallback(
        async (earningId: string, chatterId: string) => {
            try {
                await api.updateEmployeeEarning(earningId, {
                    chatterId: chatterId === "unknown" ? null : chatterId,
                })
                await Promise.all([fetchTableData(), fetchChartData()])
            } catch (error) {
                console.error("Error updating earning:", error)
            }
        },
        [fetchChartData, fetchTableData],
    )

    const handleSync = useCallback(async () => {
        if (!syncFrom || !syncTo || syncLoading) return false

        setSyncLoading(true)

        try {
            await api.syncEarnings(new Date(syncFrom), new Date(syncTo))
            await Promise.all([fetchTableData(), fetchChartData()])
            return true
        } catch (error) {
            console.error("Error syncing earnings:", error)
            return false
        } finally {
            setSyncLoading(false)
        }
    }, [fetchChartData, fetchTableData, syncFrom, syncTo, syncLoading])

    if (isCompact) {
        if (tableLoading) {
            return (
                <Card>
                    <CardContent className="p-6">
                        <div className="animate-pulse space-y-4">
                            {[...Array(limit || 5)].map((_, index) => (
                                <div key={index} className="h-12 rounded bg-muted"/>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )
        }

        const limited = earnings.slice(0, limit)

        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        Earnings Overview
                    </CardTitle>
                    <CardDescription>
                        Latest {limit} earnings entries
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Shift</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Model</TableHead>
                                <TableHead>Chatter</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Description</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {limited.map((earning) => (
                                <TableRow key={earning.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-muted-foreground"/>
                                            {formatDate(earning.date)}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {earning.shift?.label ? (
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-muted-foreground"/>
                                                <span>{earning.shift.label}</span>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {(() => {
                                            const iconMap: Record<string, JSX.Element> = {
                                                paypermessage: (
                                                    <MessageSquare className="h-4 w-4 text-muted-foreground"/>
                                                ),
                                                tip: <Gift className="h-4 w-4 text-muted-foreground"/>,
                                                subscriptionperiod: (
                                                    <Repeat className="h-4 w-4 text-muted-foreground"/>
                                                ),
                                                payperpost: (
                                                    <FileText className="h-4 w-4 text-muted-foreground"/>
                                                ),
                                            }
                                            return iconMap[earning.type] || null
                                        })()}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <UserCircle className="h-4 w-4 text-muted-foreground"/>
                                            {earning.model?.display_name ?? "Unknown"}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-muted-foreground"/>
                                            {earning.chatter?.full_name ?? "Wolf"}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1 font-semibold">
                                            {formatCurrency(earning.amount)}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                    <span className="text-muted-foreground">
                      {earning.description || "No description"}
                    </span>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    Earnings Overview
                </CardTitle>
                <CardDescription>
                    {now.toLocaleDateString("nl-NL", {month: "long", year: "numeric"})}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                className="flex w-full items-center justify-between gap-2 md:w-auto md:justify-start"
                            >
                <span className="flex items-center gap-2">
                  <Filter className="h-4 w-4"/>
                  Filters
                </span>
                                {activeFilterCount > 0 && (
                                    <Badge variant="secondary" className="ml-auto">
                                        {activeFilterCount}
                                    </Badge>
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64">
                            <DropdownMenuLabel>Filter earnings</DropdownMenuLabel>
                            <DropdownMenuSeparator/>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>Shift</DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                    <DropdownMenuSubContent className="w-64">
                                        <DropdownMenuRadioGroup
                                            value={filters.shiftId ?? "all"}
                                            onValueChange={(value) =>
                                                setFilters((current) => ({
                                                    ...current,
                                                    shiftId: value === "all" ? null : value,
                                                }))
                                            }
                                        >
                                            <DropdownMenuRadioItem value="all">
                                                All shifts
                                            </DropdownMenuRadioItem>
                                            {shifts.map((shift) => (
                                                <DropdownMenuRadioItem key={shift.id} value={shift.id}>
                                                    {shift.label || `Shift #${shift.id}`}
                                                </DropdownMenuRadioItem>
                                            ))}
                                        </DropdownMenuRadioGroup>
                                    </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                            </DropdownMenuSub>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>Model</DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                    <DropdownMenuSubContent className="w-64">
                                        <DropdownMenuRadioGroup
                                            value={filters.modelId ?? "all"}
                                            onValueChange={(value) =>
                                                setFilters((current) => ({
                                                    ...current,
                                                    modelId: value === "all" ? null : value,
                                                }))
                                            }
                                        >
                                            <DropdownMenuRadioItem value="all">
                                                All models
                                            </DropdownMenuRadioItem>
                                            {models.map((model) => (
                                                <DropdownMenuRadioItem key={model.id} value={model.id}>
                                                    {model.display_name}
                                                </DropdownMenuRadioItem>
                                            ))}
                                        </DropdownMenuRadioGroup>
                                    </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                            </DropdownMenuSub>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>Chatter</DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                    <DropdownMenuSubContent className="w-64">
                                        <DropdownMenuRadioGroup
                                            value={filters.chatterId ?? "all"}
                                            onValueChange={(value) =>
                                                setFilters((current) => ({
                                                    ...current,
                                                    chatterId: value === "all" ? null : value,
                                                }))
                                            }
                                        >
                                            <DropdownMenuRadioItem value="all">
                                                All chatters
                                            </DropdownMenuRadioItem>
                                            {chatters.map((chatter) => (
                                                <DropdownMenuRadioItem key={chatter.id} value={chatter.id}>
                                                    {chatter.full_name || "Unnamed"}
                                                </DropdownMenuRadioItem>
                                            ))}
                                        </DropdownMenuRadioGroup>
                                    </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                            </DropdownMenuSub>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>Items</DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                    <DropdownMenuSubContent className="w-64">
                                        <DropdownMenuItem
                                            onSelect={(event) => {
                                                event.preventDefault()
                                                setFilters((current) => ({...current, items: []}))
                                            }}
                                        >
                                            Clear selection
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator/>
                                        {itemOptions.map((item) => (
                                            <DropdownMenuCheckboxItem
                                                key={item.value}
                                                checked={filters.items.includes(item.value)}
                                                onCheckedChange={(checked) =>
                                                    setFilters((current) => ({
                                                        ...current,
                                                        items: checked
                                                            ? [...current.items, item.value]
                                                            : current.items.filter((value) => value !== item.value),
                                                    }))
                                                }
                                            >
                                                {item.label}
                                            </DropdownMenuCheckboxItem>
                                        ))}
                                    </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                            </DropdownMenuSub>
                            <DropdownMenuSeparator/>
                            <DropdownMenuItem
                                onSelect={(event) => {
                                    event.preventDefault()
                                    setFilters({shiftId: null, modelId: null, chatterId: null, items: []})
                                }}
                            >
                                Clear all filters
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <div className="flex flex-wrap gap-2">
                        {filterSummary.map((item) => (
                            <Badge key={item.key} variant="secondary" className="whitespace-nowrap">
                                {item.label}
                            </Badge>
                        ))}
                    </div>
                    <Dialog
                        open={syncOpen}
                        onOpenChange={(open) => {
                            if (syncLoading) return
                            setSyncOpen(open)
                        }}
                    >
                        <DialogTrigger asChild>
                            <Button className="md:ml-auto">Sync Earnings</Button>
                        </DialogTrigger>
                        <DialogContent aria-busy={syncLoading}>
                            {syncLoading && (
                                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/80">
                                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                    <p className="text-sm font-medium">Syncing earnings...</p>
                                </div>
                            )}
                            <DialogHeader>
                                <DialogTitle>Sync Earnings</DialogTitle>
                                <DialogDescription>
                                    Select the start and end date times.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="sync-from">From</Label>
                                    <Input
                                        id="sync-from"
                                        type="datetime-local"
                                        value={syncFrom}
                                        onChange={(event) => setSyncFrom(event.target.value)}
                                        disabled={syncLoading}
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="sync-to">To</Label>
                                    <Input
                                        id="sync-to"
                                        type="datetime-local"
                                        value={syncTo}
                                        onChange={(event) => setSyncTo(event.target.value)}
                                        disabled={syncLoading}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button
                                    variant="secondary"
                                    onClick={() => setSyncOpen(false)}
                                    disabled={syncLoading}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    disabled={syncLoading || !syncFrom || !syncTo}
                                    onClick={async () => {
                                        const success = await handleSync()
                                        if (success) {
                                            setSyncOpen(false)
                                        }
                                    }}
                                >
                                    {syncLoading ? (
                                        <span className="flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Syncing...
                                        </span>
                                    ) : (
                                        "Sync"
                                    )}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                {chartLoading ? (
                    <div className="h-64 w-full animate-pulse rounded-lg bg-muted"/>
                ) : (
                    <ChartContainer config={{total: {label: "Earnings", color: "#6CE8F2"}}} className="h-64 w-full">
                        <BarChart data={chartData}>
                            <defs>
                                <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#6CE8F2"/>
                                    <stop offset="100%" stopColor="#FFA6FF"/>
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="day" tickLine={false} axisLine={false}/>
                            <YAxis tickLine={false} axisLine={false} width={40}/>
                            <Bar dataKey="total">
                                {chartData.map((dataPoint, index) => {
                                    const isSelected = selectedDate === dataPoint.fullDate
                                    const isDimmed = selectedDate && !isSelected
                                    const opacity = isSelected ? 1 : isDimmed ? 0.35 : hoveredBar === index ? 0.75 : 1

                                    return (
                                        <Cell
                                            key={dataPoint.day}
                                            cursor="pointer"
                                            fill="url(#earningsGradient)"
                                            fillOpacity={opacity}
                                            onMouseEnter={() => setHoveredBar(index)}
                                            onMouseLeave={() => setHoveredBar(null)}
                                            onClick={() => {
                                                setSelectedDate((previous) =>
                                                    previous === dataPoint.fullDate ? null : dataPoint.fullDate,
                                                )
                                                setHoveredBar(null)
                                            }}
                                        />
                                    )
                                })}
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
                )}

                {selectedDate && (
                    <div className="flex items-center justify-between">
                        <h3 className="font-medium">
                            {new Date(selectedDate).toLocaleDateString("nl-NL", {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                            })}
                        </h3>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedDate(null)}
                        >
                            <X className="mr-1 h-4 w-4"/> Back to month
                        </Button>
                    </div>
                )}

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Shift</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Model</TableHead>
                            <TableHead>Chatter</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Description</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tableLoading ? (
                            <TableRow>
                                <TableCell colSpan={7}>
                                    <div className="space-y-3 py-4">
                                        {[...Array(3)].map((_, index) => (
                                            <div key={index} className="h-10 animate-pulse rounded bg-muted"/>
                                        ))}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            earnings.map((earning) => (
                                <TableRow key={earning.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-muted-foreground"/>
                                            {formatDate(earning.date)}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {earning.shift?.label ? (
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-muted-foreground"/>
                                                <span>{earning.shift.label}</span>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {(() => {
                                            const iconMap: Record<string, JSX.Element> = {
                                                paypermessage: (
                                                    <MessageSquare className="h-4 w-4 text-muted-foreground"/>
                                                ),
                                                tip: <Gift className="h-4 w-4 text-muted-foreground"/>,
                                                subscriptionperiod: (
                                                    <Repeat className="h-4 w-4 text-muted-foreground"/>
                                                ),
                                                payperpost: (
                                                    <FileText className="h-4 w-4 text-muted-foreground"/>
                                                ),
                                            }
                                            return iconMap[earning.type] || null
                                        })()}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <UserCircle className="h-4 w-4 text-muted-foreground"/>
                                            {earning.model?.display_name ?? "Unknown"}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {['paypermessage', 'tip'].includes(earning.type) ? (
                                            <Select
                                                value={earning.chatterId ?? "unknown"}
                                                onValueChange={(value) =>
                                                    handleChatterChange(earning.id, value)
                                                }
                                            >
                                                <SelectTrigger className="w-[200px]">
                                                    <User className="h-4 w-4 text-muted-foreground"/>
                                                    <SelectValue/>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {chatters.map((chatter) => (
                                                        <SelectItem key={chatter.id} value={chatter.id}>
                                                            {chatter.full_name || "Unnamed"}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-muted-foreground"/>
                                                {earning.chatter?.full_name ?? "Wolf"}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1 font-semibold">
                                            {formatCurrency(earning.amount)}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                    <span className="text-muted-foreground">
                      {earning.description || "No description"}
                    </span>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                {!tableLoading && earnings.length === 0 && (
                    <div className="py-8 text-center text-muted-foreground">
                        <p>No earnings recorded yet.</p>
                        <p className="text-sm">
                            Earnings will appear here once chatters start logging them.
                        </p>
                    </div>
                )}

                {pageCount > 1 && (
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
                                        <PaginationEllipsis/>
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
            </CardContent>
        </Card>
    )
}

