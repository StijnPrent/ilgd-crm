"use client"

import {useCallback, useEffect, useRef, useState} from "react"
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card"
import {Button} from "@/components/ui/button"
import {Badge} from "@/components/ui/badge"
import {ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Clock, User, UserCircle} from "lucide-react"
import {api} from "@/lib/api"

interface Shift {
    id: string
    chatter_id: string
    chatter_name: string
    model_ids: string[]
    model_names: string[]
    date: string
    start_time: string
    end_time: string
    status: "scheduled" | "active" | "completed" | "cancelled"
}

interface WeeklyCalendarProps {
    userId?: string
    showChatterNames?: boolean
    compact?: boolean
    refreshTrigger?: number
    onShiftClick?: (shift: Shift) => void
}

/** Collapsible list for model names */
function CollapsibleNames({
                              names,
                              maxVisible = 1,
                          }: {
    names: string[]
    maxVisible?: number
}) {
    const [expanded, setExpanded] = useState(false)
    const visible = expanded ? names : names.slice(0, maxVisible)
    const remaining = Math.max(0, names.length - maxVisible)

    return (
        <div className="flex flex-col">
            {visible.map((name, idx) => (
                <span key={idx} className="truncate">
          {name}
        </span>
            ))}
            {names.length > maxVisible && (
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="mt-1 inline-flex items-center text-[11px] leading-none hover:underline"
                >
                    {expanded ? (
                        <>
                            Show less <ChevronUp className="h-3 w-3 ml-1"/>
                        </>
                    ) : (
                        <>
                            +{remaining} more <ChevronDown className="h-3 w-3 ml-1"/>
                        </>
                    )}
                </button>
            )}
        </div>
    )
}

export function WeeklyCalendar({
                                   userId,
                                   showChatterNames = false,
                                   compact = false,
                                   refreshTrigger,
                                   onShiftClick,
                               }: WeeklyCalendarProps) {
    const [shifts, setShifts] = useState<Shift[]>([])
    const [currentWeek, setCurrentWeek] = useState(new Date())
    const [loading, setLoading] = useState(true)
    const [chatterNames, setChatterNames] = useState<Record<string, string>>({})
    const [modelNames, setModelNames] = useState<Record<string, string>>({})
    const [metaLoaded, setMetaLoaded] = useState(false)
    const loadedRangeKeysRef = useRef<Set<string>>(new Set())

    const formatDate = useCallback((date: Date) => {
        return date.toISOString().split("T")[0]
    }, [])

    const getStartOfWeek = useCallback((date: Date) => {
        const start = new Date(date)
        const day = start.getDay()
        const diff = start.getDate() - day + (day === 0 ? -6 : 1)
        start.setDate(diff)
        start.setHours(0, 0, 0, 0)
        return start
    }, [])

    const getWeekDates = useCallback((date: Date) => {
        const week = []
        const startOfWeek = getStartOfWeek(date)

        for (let i = 0; i < 7; i++) {
            const day = new Date(startOfWeek)
            day.setDate(startOfWeek.getDate() + i)
            week.push(day)
        }
        return week
    }, [getStartOfWeek])

    const fetchMeta = useCallback(async () => {
        try {
            const [chattersData, usersData, modelsData] = await Promise.all([
                api.getChatters(),
                api.getUsers(),
                api.getModels(),
            ])

            const userMap = new Map(
                (usersData || []).map((u: any) => [String(u.id), u.fullName || ""])
            )

            const chatterMap: Record<string, string> = {}
            ;(chattersData || []).forEach((chatter: any) => {
                const chatterId = String(chatter.id)
                chatterMap[chatterId] = userMap.get(chatterId) || "Unknown Chatter"
            })

            const modelMap: Record<string, string> = {}
            ;(modelsData || []).forEach((model: any) => {
                modelMap[String(model.id)] = model.displayName || "Unknown Model"
            })

            setChatterNames(chatterMap)
            setModelNames(modelMap)
        } catch (error) {
            console.error("[v0] WeeklyCalendar: Error loading metadata:", error)
            setChatterNames({})
            setModelNames({})
        } finally {
            setMetaLoaded(true)
        }
    }, [])

    const loadWeek = useCallback(
        async (targetDate: Date, options?: { prefetch?: boolean; force?: boolean }) => {
            const { prefetch = false, force = false } = options || {}
            const weekStart = getStartOfWeek(targetDate)
            const rangeStart = new Date(weekStart)
            const rangeEnd = new Date(weekStart)
            rangeEnd.setDate(rangeEnd.getDate() + 13)

            const from = formatDate(rangeStart)
            const to = formatDate(rangeEnd)
            const rangeKey = `${from}_${to}_${userId ? String(userId) : "all"}`

            if (!force && loadedRangeKeysRef.current.has(rangeKey)) {
                if (!prefetch) {
                    setLoading(false)
                    const nextWeek = new Date(weekStart)
                    nextWeek.setDate(nextWeek.getDate() + 7)
                    void loadWeek(nextWeek, { prefetch: true })
                }
                return
            }

            if (!prefetch) {
                setLoading(true)
            }

            try {
                const shiftsData = await api.getShifts({
                    from,
                    to,
                    chatterId: userId ? String(userId) : undefined,
                })

                const formattedShifts = (shiftsData || []).map((shift: any) => {
                    const startDate = shift.startTime
                        ? String(shift.startTime).slice(0, 10)
                        : String(shift.date)
                    const startTime = shift.startTime ? String(shift.startTime).slice(11, 16) : ""
                    const endTime = shift.endTime ? String(shift.endTime).slice(11, 16) : ""
                    const chatterId = String(shift.chatterId || shift.chatter_id || "")
                    const modelIds = (shift.modelIds || []).map((id: any) => String(id))

                    return {
                        id: String(shift.id),
                        chatter_id: chatterId,
                        chatter_name: chatterNames[chatterId] || "Unknown Chatter",
                        model_ids: modelIds,
                        model_names: modelIds.map((id) => modelNames[id] || "Unknown Model"),
                        date: startDate,
                        start_time: startTime,
                        end_time: endTime,
                        status: shift.status || "scheduled",
                    }
                })

                setShifts((prev) => {
                    const base = force
                        ? prev.filter((shift) => shift.date < from || shift.date > to)
                        : prev
                    const merged = new Map(base.map((shift) => [shift.id, shift]))
                    formattedShifts.forEach((shift) => merged.set(shift.id, shift))
                    return Array.from(merged.values())
                })

                loadedRangeKeysRef.current.add(rangeKey)

                if (!prefetch) {
                    setLoading(false)
                    const nextWeek = new Date(weekStart)
                    nextWeek.setDate(nextWeek.getDate() + 7)
                    void loadWeek(nextWeek, { prefetch: true })
                }
            } catch (error) {
                if (!prefetch) {
                    console.error("[v0] WeeklyCalendar: Error loading shifts:", error)
                    setLoading(false)
                }
            }
        },
        [chatterNames, formatDate, getStartOfWeek, modelNames, userId]
    )

    useEffect(() => {
        setLoading(true)
        void fetchMeta()
    }, [fetchMeta])

    useEffect(() => {
        if (!metaLoaded) return
        loadedRangeKeysRef.current.clear()
        setShifts([])
        setLoading(true)
        void loadWeek(currentWeek, { force: true })
    }, [metaLoaded, userId, refreshTrigger, loadWeek])

    useEffect(() => {
        if (!metaLoaded) return
        void loadWeek(currentWeek)
    }, [currentWeek, metaLoaded, loadWeek])

    const weekDates = getWeekDates(currentWeek)
    const today = new Date()

    const getShiftsForDate = (date: Date) => {
        const dateStr = date.toISOString().split("T")[0]
        return shifts
            .filter(
                (shift) =>
                    shift.date === dateStr && (!userId || shift.chatter_id === String(userId))
            )
            .slice()
            .sort((a, b) => a.start_time.localeCompare(b.start_time))
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case "scheduled":
                return "bg-orange-500 hover:bg-orange-600"
            case "active":
                return "bg-green-500 hover:bg-green-600"
            case "completed":
                return "bg-blue-500 hover:bg-blue-600"
            case "cancelled":
                return "bg-gray-400 hover:bg-gray-500"
            default:
                return "bg-gray-400 hover:bg-gray-500"
        }
    }

    const navigateWeek = (direction: "prev" | "next") => {
        const newWeek = new Date(currentWeek)
        newWeek.setDate(currentWeek.getDate() + (direction === "next" ? 7 : -7))
        setCurrentWeek(newWeek)
    }

    const goToCurrentWeek = () => {
        setCurrentWeek(new Date())
    }

    if (loading) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader className={compact ? "pb-3" : ""}>
                <div className="flex items-center justify-between">
                    <CardTitle className={compact ? "text-lg" : ""}>
                        {userId ? "My Schedule" : "Team Schedule"}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => navigateWeek("prev")}>
                            <ChevronLeft className="h-4 w-4"/>
                        </Button>
                        <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
                            Today
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => navigateWeek("next")}>
                            <ChevronRight className="h-4 w-4"/>
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className={compact ? "pt-0" : ""}>
                <div className="grid grid-cols-7 gap-2">
                    {weekDates.map((date, index) => {
                        const dayShifts = getShiftsForDate(date)
                        const isToday = date.toDateString() === today.toDateString()
                        const dayName = date.toLocaleDateString("en", {weekday: "short"})
                        const dayNumber = date.getDate()

                        return (
                            <div key={index} className="space-y-2">
                                <div
                                    className={`text-center p-2 rounded-lg ${
                                        isToday ? "bg-primary text-primary-foreground" : "bg-muted"
                                    }`}
                                >
                                    <div className="text-xs font-medium">{dayName}</div>
                                    <div className="text-sm">{dayNumber}</div>
                                </div>
                                <div className="space-y-1 min-h-[100px]">
                                    {dayShifts.map((shift) => (
                                        <div
                                            key={shift.id}
                                            className={`p-2 rounded text-white text-xs cursor-pointer transition-colors ${getStatusColor(
                                                shift.status
                                            )}`}
                                            onClick={() => onShiftClick?.(shift)}
                                        >
                                            <div className="flex items-center gap-1 mb-1">
                                                <Clock className="h-3 w-3"/>
                                                <span>
                          {shift.start_time} - {shift.end_time}
                        </span>
                                            </div>

                                            <div className="flex items-start gap-1">
                                                <UserCircle className="h-3 w-3 mt-0.5"/>
                                                {/* Collapsible names here */}
                                                <CollapsibleNames names={shift.model_names} maxVisible={1}/>
                                            </div>

                                            {showChatterNames && (
                                                <div className="flex items-center gap-1 mt-1">
                                                    <User className="h-3 w-3"/>
                                                    <span className="truncate">{shift.chatter_name}</span>
                                                </div>
                                            )}

                                            {compact && (
                                                <Badge variant="secondary" className="text-xs mt-1">
                                                    {shift.status}
                                                </Badge>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
                {!compact && (
                    <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-orange-500 rounded"></div>
                            <span>Scheduled</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded"></div>
                            <span>Active</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-blue-500 rounded"></div>
                            <span>Completed</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-gray-400 rounded"></div>
                            <span>Cancelled</span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
