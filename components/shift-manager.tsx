"use client"

import type React from "react"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import {
    Calendar,
    Clock,
    Plus,
    User,
    ChevronLeft,
    ChevronRight,
    Trash2,
    ChevronsUpDown,
    Check,
    Pencil,
} from "lucide-react"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Switch } from "@/components/ui/switch"
import { useIsMobile } from "@/hooks/use-mobile"
import { formatUserDate, formatUserDateTime, formatUserTime } from "@/lib/timezone"

const normalizeDate = (date: Date) => {
    const normalized = new Date(date)
    normalized.setHours(0, 0, 0, 0)
    return normalized
}

interface Shift {
    id: string
    chatter_id: string
    start_time: string
    end_time: string
    status: string
    created_at: string
    chatter: {
        full_name: string
    }
    model_ids: string[]
    model_names: string[]
    date: string
}

interface Chatter {
    id: string
    full_name: string
}

interface Model {
    id: string
    display_name: string
}

export function ShiftManager() {
    const [shifts, setShifts] = useState<Shift[]>([])
    const [chatters, setChatters] = useState<Chatter[]>([])
    const [models, setModels] = useState<Model[]>([])
    const [chatterNameMap, setChatterNameMap] = useState<Record<string, string>>({})
    const [modelNameMap, setModelNameMap] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [metaLoaded, setMetaLoaded] = useState(false)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [currentWeek, setCurrentWeek] = useState<Date>(() => normalizeDate(new Date()))
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
    const [newShift, setNewShift] = useState({
        chatter_id: "",
        model_ids: [] as string[],
        date: "",
        start_hour: "",
        start_minute: "",
        end_hour: "",
        end_minute: "",
        repeatWeekly: false,
        repeatWeeks: "",
    })
    const [isModelPopoverOpen, setIsModelPopoverOpen] = useState(false)
    const [editingShift, setEditingShift] = useState<Shift | null>(null)
    const [editShiftValues, setEditShiftValues] = useState({
        chatter_id: "",
        model_ids: [] as string[],
        date: "",
        start_hour: "",
        start_minute: "",
        end_hour: "",
        end_minute: "",
    })
    const [isEditModelPopoverOpen, setIsEditModelPopoverOpen] = useState(false)
    const loadedRangeKeysRef = useRef<Set<string>>(new Set())
    const isMobile = useIsMobile()
    const [selectedDate, setSelectedDate] = useState<Date>(() => normalizeDate(new Date()))

    const formatDate = useCallback((date: Date) => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, "0")
        const day = String(date.getDate()).padStart(2, "0")
        return `${year}-${month}-${day}`
    }, [])

    const getStartOfWeek = useCallback((date: Date) => {
        const start = new Date(date)
        const day = start.getDay()
        const diff = start.getDate() - day + (day === 0 ? -6 : 1)
        start.setDate(diff)
        start.setHours(0, 0, 0, 0)
        return start
    }, [])

    const getWeekDays = useCallback(
        (date: Date) => {
            const week = []
            const startOfWeek = getStartOfWeek(date)

            for (let i = 0; i < 7; i++) {
                const day = new Date(startOfWeek)
                day.setDate(startOfWeek.getDate() + i)
                week.push(day)
            }
            return week
        },
        [getStartOfWeek]
    )

    const fetchMeta = useCallback(async () => {
        try {
            const [chattersData, usersData, modelsData] = await Promise.all([
                api.getChatters(),
                api.getUsers(),
                api.getModels(),
            ])

            const userMap = new Map((usersData || []).map((u: any) => [String(u.id), u.fullName || ""]))

            const chattersWithNames = (chattersData || []).map((c: any) => ({
                id: String(c.id),
                full_name: userMap.get(String(c.id)) || "",
            }))

            const chatterLookup: Record<string, string> = {}
            chattersWithNames.forEach((chatter) => {
                chatterLookup[chatter.id] = chatter.full_name || "Unknown"
            })

            const modelsList = (modelsData || []).map((m: any) => ({
                id: String(m.id),
                display_name: m.displayName,
            }))

            const modelLookup: Record<string, string> = {}
            modelsList.forEach((model) => {
                modelLookup[model.id] = model.display_name || "Unknown Model"
            })

            setChatters(chattersWithNames)
            setModels(modelsList)
            setChatterNameMap(chatterLookup)
            setModelNameMap(modelLookup)
        } catch (error) {
            console.error("Error loading shift metadata:", error)
            setChatters([])
            setModels([])
            setChatterNameMap({})
            setModelNameMap({})
        } finally {
            setMetaLoaded(true)
        }
    }, [])

    const loadWeek = useCallback(
        async (
            targetDate: Date,
            options?: { prefetch?: boolean; force?: boolean; silent?: boolean },
        ) => {
            const { prefetch = false, force = false, silent = false } = options || {}
            const weekStart = getStartOfWeek(targetDate)
            const rangeStart = new Date(weekStart)
            const rangeEnd = new Date(weekStart)
            rangeEnd.setDate(rangeEnd.getDate() + 13)

            const from = formatDate(rangeStart)
            const to = formatDate(rangeEnd)
            const rangeKey = `${from}_${to}`

            if (!force && loadedRangeKeysRef.current.has(rangeKey)) {
                if (!prefetch && !silent) {
                    setLoading(false)
                    const nextWeek = new Date(weekStart)
                    nextWeek.setDate(nextWeek.getDate() + 7)
                    void loadWeek(nextWeek, { prefetch: true })
                }
                return
            }

            if (!prefetch && !silent) {
                setLoading(true)
            }

            try {
                const shiftsData = await api.getShifts({
                    from,
                    to,
                })

                const formattedShifts = (shiftsData || []).map((shift: any) => {
                    const modelIds = (shift.modelIds || []).map((id: any) => String(id))
                    const startDate = shift.startTime
                        ? String(shift.startTime).slice(0, 10)
                        : String(shift.date)

                    return {
                        id: String(shift.id),
                        chatter_id: String(shift.chatterId),
                        start_time: shift.startTime,
                        end_time: shift.endTime,
                        status: shift.status,
                        created_at: shift.createdAt,
                        chatter: {
                            full_name:
                                chatterNameMap[String(shift.chatterId)] || "Unknown",
                        },
                        model_ids: modelIds,
                        model_names: modelIds.map(
                            (modelId) => modelNameMap[modelId] || "Unknown Model",
                        ),
                        date: startDate,
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

                if (!prefetch && !silent) {
                    setLoading(false)
                    const nextWeek = new Date(weekStart)
                    nextWeek.setDate(nextWeek.getDate() + 7)
                    void loadWeek(nextWeek, { prefetch: true })
                }
            } catch (error) {
                console.error("Error loading shifts:", error)
                if (!prefetch && !silent) {
                    setLoading(false)
                }
            }
        },
        [chatterNameMap, formatDate, getStartOfWeek, modelNameMap]
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
    }, [metaLoaded, loadWeek])

    useEffect(() => {
        if (!metaLoaded) return
        void loadWeek(currentWeek)
    }, [currentWeek, metaLoaded, loadWeek])

    const getShiftsForDay = (date: Date) => {
        const dateStr = formatDate(date)
        return shifts
            .filter((shift) => shift.date === dateStr)
            .slice()
            .sort(
                (a, b) =>
                    new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
            )
    }

    const currentWeekBounds = useMemo(() => {
        const start = getStartOfWeek(currentWeek)
        start.setHours(0, 0, 0, 0)
        const end = new Date(start)
        end.setDate(end.getDate() + 6)
        end.setHours(23, 59, 59, 999)
        return {
            start,
            end,
        }
    }, [currentWeek, getStartOfWeek])

    const { start: currentWeekStart, end: currentWeekEnd } = currentWeekBounds

    const currentWeekShifts = useMemo(
        () =>
            shifts
                .filter(
                    (shift) => {
                        const shiftDate = new Date(`${shift.date}T00:00:00`)
                        return (
                            shiftDate >= currentWeekStart &&
                            shiftDate <= currentWeekEnd
                        )
                    },
                )
                .slice()
                .sort(
                    (a, b) =>
                        new Date(a.start_time).getTime() -
                        new Date(b.start_time).getTime(),
                ),
        [shifts, currentWeekEnd, currentWeekStart],
    )

    const navigateWeek = (direction: "prev" | "next") => {
        const newWeek = new Date(currentWeek)
        newWeek.setDate(currentWeek.getDate() + (direction === "next" ? 7 : -7))
        setCurrentWeek(normalizeDate(newWeek))
    }

    const weekDays = useMemo(() => getWeekDays(currentWeek), [currentWeek, getWeekDays])
    const today = useMemo(() => normalizeDate(new Date()), [])

    useEffect(() => {
        const weekStart = weekDays[0]
        const weekEnd = weekDays[weekDays.length - 1]
        if (!weekStart || !weekEnd) {
            return
        }

        const weekEndBoundary = new Date(weekEnd)
        weekEndBoundary.setHours(23, 59, 59, 999)

        if (selectedDate >= weekStart && selectedDate <= weekEndBoundary) {
            return
        }

        const todayMatch = weekDays.find((day) => day.toDateString() === today.toDateString())
        if (todayMatch) {
            setSelectedDate(todayMatch)
            return
        }

        setSelectedDate(weekStart)
    }, [selectedDate, today, weekDays])

    useEffect(() => {
        if (!isMobile) {
            return
        }

        const todayMatch = weekDays.find((day) => day.toDateString() === today.toDateString())
        if (todayMatch) {
            setSelectedDate(todayMatch)
        }
    }, [isMobile, today, weekDays])

    const selectedDayShifts = useMemo(
        () => getShiftsForDay(selectedDate),
        [getShiftsForDay, selectedDate],
    )

    const navigateDay = (direction: "prev" | "next") => {
        const delta = direction === "next" ? 1 : -1
        const newDate = new Date(selectedDate)
        newDate.setDate(selectedDate.getDate() + delta)
        const normalized = normalizeDate(newDate)
        setSelectedDate(normalized)

        const weekStart = weekDays[0]
        const weekEnd = weekDays[weekDays.length - 1]
        if (weekStart && weekEnd) {
            const weekEndBoundary = new Date(weekEnd)
            weekEndBoundary.setHours(23, 59, 59, 999)
            if (normalized < weekStart || normalized > weekEndBoundary) {
                setCurrentWeek(normalized)
            }
        }
    }

    const handleAddShift = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const startDateTime = `${newShift.date}T${newShift.start_hour}:${newShift.start_minute}:00`
            let endDate = newShift.date

            if (
                parseInt(newShift.end_hour) < parseInt(newShift.start_hour) ||
                (parseInt(newShift.end_hour) === parseInt(newShift.start_hour) &&
                    parseInt(newShift.end_minute) <= parseInt(newShift.start_minute))
            ) {
                const nextDay = new Date(newShift.date)
                nextDay.setDate(nextDay.getDate() + 1)
                endDate = nextDay.toISOString().split("T")[0]
            }

            const endDateTime = `${endDate}T${newShift.end_hour}:${newShift.end_minute}:00`

            const payload: Record<string, unknown> = {
                chatterId: newShift.chatter_id,
                modelIds: newShift.model_ids,
                start_time: startDateTime,
                end_time: endDateTime,
                date: newShift.date,
                status: "scheduled",
            }

            if (newShift.repeatWeekly) {
                payload.repeatWeekly = true
                payload.repeatWeeks = Number(newShift.repeatWeeks)
            }

            await api.createShift(payload)

            const createdShiftDate = newShift.date ? new Date(newShift.date) : null

            setNewShift({
                chatter_id: "",
                model_ids: [],
                date: "",
                start_hour: "",
                start_minute: "",
                end_hour: "",
                end_minute: "",
                repeatWeekly: false,
                repeatWeeks: "",
            })
            setIsModelPopoverOpen(false)
            setIsAddDialogOpen(false)

            if (createdShiftDate) {
                await loadWeek(createdShiftDate, { force: true, silent: true })
            }
        } catch (error) {
            console.error("Error adding shift:", error)
        }
    }

    const updateShiftStatus = async (shiftId: string, newStatus: string) => {
        const targetShift = shifts.find((shift) => shift.id === shiftId)
        if (!targetShift) return

        const previousStatus = targetShift.status
        setShifts((prev) =>
            prev.map((shift) => (shift.id === shiftId ? { ...shift, status: newStatus } : shift)),
        )

        try {
            await api.updateShift(shiftId, { status: newStatus })
            const shiftDate = targetShift.date
            if (shiftDate) {
                // Clear cached weeks so a forced reload picks up the change everywhere.
                loadedRangeKeysRef.current.clear()
                await loadWeek(new Date(`${shiftDate}T00:00:00`), { force: true, silent: false })
                // Also refresh the currently viewed week in case it's different.
                await loadWeek(currentWeek, { force: true, silent: true })
            }
        } catch (error) {
            console.error("Error updating shift status:", error)
            setShifts((prev) =>
                prev.map((shift) => (shift.id === shiftId ? { ...shift, status: previousStatus } : shift)),
            )
        }
    }

    const openEditDialog = (shift: Shift) => {
        const start = new Date(shift.start_time)
        const end = new Date(shift.end_time)
        const pad = (value: number) => value.toString().padStart(2, "0")

        setEditShiftValues({
            chatter_id: shift.chatter_id,
            model_ids: [...shift.model_ids],
            date: shift.date || start.toISOString().split("T")[0],
            start_hour: pad(start.getHours()),
            start_minute: pad(start.getMinutes()),
            end_hour: pad(end.getHours()),
            end_minute: pad(end.getMinutes()),
        })
        setEditingShift(shift)
        setIsEditModelPopoverOpen(false)
    }

    const closeEditDialog = () => {
        setEditingShift(null)
        setEditShiftValues({
            chatter_id: "",
            model_ids: [],
            date: "",
            start_hour: "",
            start_minute: "",
            end_hour: "",
            end_minute: "",
        })
        setIsEditModelPopoverOpen(false)
    }

    const handleUpdateShift = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingShift) return

        try {
            const startDateTime = `${editShiftValues.date}T${editShiftValues.start_hour}:${editShiftValues.start_minute}:00`
            let endDate = editShiftValues.date

            if (
                parseInt(editShiftValues.end_hour) < parseInt(editShiftValues.start_hour) ||
                (parseInt(editShiftValues.end_hour) === parseInt(editShiftValues.start_hour) &&
                    parseInt(editShiftValues.end_minute) <= parseInt(editShiftValues.start_minute))
            ) {
                const nextDay = new Date(editShiftValues.date)
                nextDay.setDate(nextDay.getDate() + 1)
                endDate = nextDay.toISOString().split("T")[0]
            }

            const endDateTime = `${endDate}T${editShiftValues.end_hour}:${editShiftValues.end_minute}:00`

            const shiftId = editingShift.id
            const previousDate = editingShift.date

            setShifts((prev) =>
                prev.map((shift) =>
                    shift.id === shiftId
                        ? {
                              ...shift,
                              chatter_id: editShiftValues.chatter_id,
                              chatter: {
                                  full_name:
                                      chatterNameMap[editShiftValues.chatter_id] ||
                                      shift.chatter.full_name,
                              },
                              model_ids: [...editShiftValues.model_ids],
                              model_names: editShiftValues.model_ids.map(
                                  (modelId) => modelNameMap[modelId] || "Unknown Model",
                              ),
                              start_time: startDateTime,
                              end_time: endDateTime,
                              date: editShiftValues.date,
                          }
                        : shift,
                ),
            )

            await api.updateShift(shiftId, {
                chatterId: editShiftValues.chatter_id,
                modelIds: editShiftValues.model_ids,
                start_time: startDateTime,
                end_time: endDateTime,
                date: editShiftValues.date,
            })

            await loadWeek(new Date(`${editShiftValues.date}T00:00:00`), { force: true, silent: true })
            if (previousDate && previousDate !== editShiftValues.date) {
                await loadWeek(new Date(`${previousDate}T00:00:00`), { force: true, silent: true })
            }

            closeEditDialog()
        } catch (error) {
            console.error("Error updating shift:", error)
        }
    }

    const confirmDeleteShift = (shiftId: string) => setConfirmDeleteId(shiftId)

    const performDeleteShift = async () => {
        if (!confirmDeleteId) return
        const shiftId = confirmDeleteId

        setDeletingIds((prev) => new Set(prev).add(shiftId))
        const prevShifts = shifts
        setShifts((prev) => prev.filter((s) => s.id !== shiftId))

        try {
            await api.deleteShift(shiftId) // server call (204/200)
            // success: nothing else to do
        } catch (error) {
            console.error("Error deleting shift:", error)
            // rollback on failure
            setShifts(prevShifts)
        } finally {
            setDeletingIds((prev) => {
                const next = new Set(prev)
                next.delete(shiftId)
                return next
            })
            setConfirmDeleteId(null)
        }
    }

    const formatDateTime = (dateTime: string) =>
        formatUserDateTime(dateTime, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "scheduled":
                return <Badge variant="outline">Scheduled</Badge>
            case "active":
                return <Badge className="bg-green-100 text-green-800">Active</Badge>
            case "completed":
                return <Badge variant="secondary">Completed</Badge>
            case "cancelled":
                return <Badge variant="destructive">Cancelled</Badge>
            default:
                return <Badge variant="outline">{status}</Badge>
        }
    }

    const getShiftBlockColor = (status: string) => {
        switch (status) {
            case "scheduled":
                return "bg-orange-200 border-orange-400 text-orange-800"
            case "active":
                return "bg-green-200 border-green-400 text-green-800"
            case "completed":
                return "bg-gray-200 border-gray-400 text-gray-800"
            case "cancelled":
                return "bg-red-200 border-red-400 text-red-800"
            default:
                return "bg-gray-200 border-gray-400 text-gray-800"
        }
    }

    const generateTimeOptions = (type: "hour" | "minute") => {
        if (type === "hour") {
            return Array.from({ length: 24 }, (_, i) => {
                const hour = i.toString().padStart(2, "0")
                return { value: hour, label: `${hour}:00` }
            })
        } else {
            return Array.from({ length: 4 }, (_, i) => {
                const minute = (i * 15).toString().padStart(2, "0")
                return { value: minute, label: minute }
            })
        }
    }

    const dayNames = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"]

    if (loading) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="animate-pulse space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-12 bg-muted rounded"></div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="h-5 w-5" />
                                Weekagenda
                            </CardTitle>
                            <CardDescription>Overzicht van alle shifts deze week</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => navigateWeek("prev")}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm font-medium min-w-[120px] text-center">
                Week {formatUserDate(weekDays[0], {day: "numeric", month: "short"})} -{" "}
                                {formatUserDate(weekDays[6], {day: "numeric", month: "short"})}
              </span>
                            <Button variant="outline" size="sm" onClick={() => navigateWeek("next")}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isMobile ? (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Button variant="outline" size="sm" onClick={() => navigateDay("prev")}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <div className="text-center">
                                    <div className="text-sm font-medium">
                                        {formatUserDate(selectedDate, {weekday: "long"})}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {formatUserDate(selectedDate, {
                                            day: "numeric",
                                            month: "long",
                                            year: "numeric",
                                        })}
                                    </div>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => navigateDay("next")}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="space-y-2">
                                {selectedDayShifts.map((shift) => (
                                    <div
                                        key={shift.id}
                                        className={`relative rounded border p-3 text-sm cursor-pointer transition-colors group ${getShiftBlockColor(shift.status)}`}
                                        onClick={() => openEditDialog(shift)}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-semibold truncate">{shift.chatter.full_name}</span>
                                            <span className="text-xs">
                                                {formatUserTime(shift.start_time, {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}{" "}-{" "}
                                                {formatUserTime(shift.end_time, {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </span>
                                        </div>
                                        {shift.model_names.length > 0 && (
                                            <div className="text-xs text-muted-foreground mt-1 truncate">
                                                Models: {shift.model_names.join(", ")}
                                            </div>
                                        )}
                                        <button
                                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white rounded-full p-1"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                confirmDeleteShift(shift.id)
                                            }}
                                            title="Verwijder shift"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}

                                {selectedDayShifts.length === 0 && (
                                    <div className="text-center text-xs text-muted-foreground py-6">
                                        Geen shifts gepland voor deze dag.
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-7 gap-2">
                            {weekDays.map((day, index) => {
                                const dayShifts = getShiftsForDay(day)
                                const isToday = day.toDateString() === new Date().toDateString()

                                return (
                                    <div
                                        key={day.toISOString()}
                                        className={`border rounded-lg p-3 min-h-[120px] ${isToday ? "bg-blue-50 border-blue-200" : "bg-white"}`}
                                    >
                                        <div className="text-center mb-2">
                                            <div className="text-xs font-medium text-muted-foreground">{dayNames[index]}</div>
                                            <div className={`text-sm font-semibold ${isToday ? "text-blue-600" : ""}`}>{day.getDate()}</div>
                                        </div>
                                        <div className="space-y-1">
                                            {dayShifts.map((shift) => (
                                                <div
                                                    key={shift.id}
                                                    className={`text-xs p-2 rounded border-l-2 cursor-pointer relative group ${getShiftBlockColor(shift.status)}`}
                                                    onClick={() => openEditDialog(shift)}
                                                >
                                                    <div className="font-medium truncate">{shift.chatter.full_name}</div>
                                                    <div className="text-xs opacity-75">
                                                        {formatUserTime(shift.start_time, {
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })}{" "}
                                                        -{" "}
                                                        {formatUserTime(shift.end_time, {
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })}
                                                    </div>
                                                    <button
                                                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white rounded-full p-1"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            confirmDeleteShift(shift.id)
                                                        }}
                                                        title="Verwijder shift"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                    {currentWeekShifts.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>Geen shifts ingepland.</p>
                            <p className="text-sm">Gebruik de "Add Shift" knop om nieuwe shifts in te plannen.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="h-5 w-5" />
                                Shift Beheer
                            </CardTitle>
                            <CardDescription>Plan en beheer chatter shifts</CardDescription>
                        </div>
                        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Shift
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Nieuwe Shift Inplannen</DialogTitle>
                                    <DialogDescription>Maak een nieuwe shift aan voor een chatter</DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleAddShift} className="space-y-4">
                                    <div>
                                        <Label htmlFor="chatter">Chatter</Label>
                                        <Select
                                            value={newShift.chatter_id}
                                            onValueChange={(value) => setNewShift({ ...newShift, chatter_id: value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecteer een chatter" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {chatters.map((chatter) => (
                                                    <SelectItem key={chatter.id} value={chatter.id}>
                                                        {chatter.full_name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <Label htmlFor="models">Models</Label>
                                        <Popover modal open={isModelPopoverOpen} onOpenChange={setIsModelPopoverOpen}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={isModelPopoverOpen}
                                                    className="w-full justify-between bg-transparent"
                                                >
                                                    {newShift.model_ids.length > 0
                                                        ? `${newShift.model_ids.length} model${newShift.model_ids.length > 1 ? "s" : ""} geselecteerd`
                                                        : "Selecteer models..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent portalled={false} className="w-full p-0">
                                                <Command>
                                                    <CommandInput placeholder="Zoek models..." />
                                                    <CommandEmpty>Geen models gevonden.</CommandEmpty>
                                                    <CommandList>
                                                        <CommandGroup>
                                                            {models.map((model) => (
                                                                <CommandItem
                                                                    key={model.id}
                                                                    value={model.display_name}
                                                                    onSelect={() => {
                                                                        const isSelected = newShift.model_ids.includes(model.id)
                                                                        if (isSelected) {
                                                                            setNewShift({
                                                                                ...newShift,
                                                                                model_ids: newShift.model_ids.filter((id) => id !== model.id),
                                                                            })
                                                                        } else {
                                                                            setNewShift({
                                                                                ...newShift,
                                                                                model_ids: [...newShift.model_ids, model.id],
                                                                            })
                                                                        }
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4",
                                                                            newShift.model_ids.includes(model.id) ? "opacity-100" : "opacity-0",
                                                                        )}
                                                                    />
                                                                    {model.display_name}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                        {newShift.model_ids.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {newShift.model_ids.map((modelId) => {
                                                    const model = models.find((m) => m.id === modelId)
                                                    return (
                                                        <Badge key={modelId} variant="secondary" className="text-xs">
                                                            {model?.display_name}
                                                            <button
                                                                type="button"
                                                                className="ml-1 hover:bg-muted-foreground/20 rounded-full"
                                                                onClick={() => {
                                                                    setNewShift({
                                                                        ...newShift,
                                                                        model_ids: newShift.model_ids.filter((id) => id !== modelId),
                                                                    })
                                                                }}
                                                            >
                                                                ×
                                                            </button>
                                                        </Badge>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <Label htmlFor="date">Datum</Label>
                                        <Input
                                            id="date"
                                            type="date"
                                            value={newShift.date}
                                            onChange={(e) => setNewShift({ ...newShift, date: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Start Tijd</Label>
                                            <div className="flex gap-2">
                                                <Select
                                                    value={newShift.start_hour}
                                                    onValueChange={(value) => setNewShift({ ...newShift, start_hour: value })}
                                                >
                                                    <SelectTrigger className="flex-1">
                                                        <SelectValue placeholder="Uur" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {generateTimeOptions("hour").map((option) => (
                                                            <SelectItem key={option.value} value={option.value}>
                                                                {option.value}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Select
                                                    value={newShift.start_minute}
                                                    onValueChange={(value) => setNewShift({ ...newShift, start_minute: value })}
                                                >
                                                    <SelectTrigger className="flex-1">
                                                        <SelectValue placeholder="Min" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {generateTimeOptions("minute").map((option) => (
                                                            <SelectItem key={option.value} value={option.value}>
                                                                {option.value}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div>
                                            <Label>Eind Tijd</Label>
                                            <div className="flex gap-2">
                                                <Select
                                                    value={newShift.end_hour}
                                                    onValueChange={(value) => setNewShift({ ...newShift, end_hour: value })}
                                                >
                                                    <SelectTrigger className="flex-1">
                                                        <SelectValue placeholder="Uur" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {generateTimeOptions("hour").map((option) => (
                                                            <SelectItem key={option.value} value={option.value}>
                                                                {option.value}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Select
                                                    value={newShift.end_minute}
                                                    onValueChange={(value) => setNewShift({ ...newShift, end_minute: value })}
                                                >
                                                    <SelectTrigger className="flex-1">
                                                        <SelectValue placeholder="Min" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {generateTimeOptions("minute").map((option) => (
                                                            <SelectItem key={option.value} value={option.value}>
                                                                {option.value}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-start justify-between gap-4 rounded-md border p-3">
                                        <div>
                                            <p className="text-sm font-medium">Wekelijks herhalen</p>
                                            <p className="text-xs text-muted-foreground">
                                                Plan deze shift automatisch voor meerdere weken.
                                            </p>
                                        </div>
                                        <Switch
                                            checked={newShift.repeatWeekly}
                                            onCheckedChange={(checked) =>
                                                setNewShift((prev) => ({
                                                    ...prev,
                                                    repeatWeekly: checked,
                                                    repeatWeeks: checked ? prev.repeatWeeks || "1" : "",
                                                }))
                                            }
                                        />
                                    </div>

                                    {newShift.repeatWeekly && (
                                        <div>
                                            <Label htmlFor="repeat-weeks">Aantal weken</Label>
                                            <Input
                                                id="repeat-weeks"
                                                type="number"
                                                min={1}
                                                value={newShift.repeatWeeks}
                                                onChange={(e) =>
                                                    setNewShift({ ...newShift, repeatWeeks: e.target.value })
                                                }
                                                required={newShift.repeatWeekly}
                                            />
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Including this week. Specify how many consecutive weeks the shift is scheduled.
                                            </p>
                                        </div>
                                    )}

                                    <Button
                                        type="submit"
                                        className="w-full"
                                        disabled={
                                            newShift.model_ids.length === 0 ||
                                            !newShift.chatter_id ||
                                            !newShift.date ||
                                            !newShift.start_hour ||
                                            !newShift.start_minute ||
                                            !newShift.end_hour ||
                                            !newShift.end_minute ||
                                            (newShift.repeatWeekly && (!newShift.repeatWeeks || Number(newShift.repeatWeeks) < 1))
                                        }
                                    >
                                        Shift Inplannen
                                    </Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                        <Dialog open={!!editingShift} onOpenChange={(open) => (!open ? closeEditDialog() : undefined)}>
                            <DialogContent className="max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Shift bewerken</DialogTitle>
                                    <DialogDescription>Pas chatter, models en tijden aan.</DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleUpdateShift} className="space-y-4">
                                    <div>
                                        <Label htmlFor="edit-chatter">Chatter</Label>
                                        <Select
                                            value={editShiftValues.chatter_id}
                                            onValueChange={(value) =>
                                                setEditShiftValues({ ...editShiftValues, chatter_id: value })
                                            }
                                        >
                                            <SelectTrigger id="edit-chatter">
                                                <SelectValue placeholder="Selecteer een chatter" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {chatters.map((chatter) => (
                                                    <SelectItem key={chatter.id} value={chatter.id}>
                                                        {chatter.full_name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <Label htmlFor="edit-models">Models</Label>
                                        <Popover
                                            modal
                                            open={isEditModelPopoverOpen}
                                            onOpenChange={setIsEditModelPopoverOpen}
                                        >
                                            <PopoverTrigger asChild>
                                                <Button
                                                    id="edit-models"
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={isEditModelPopoverOpen}
                                                    className="w-full justify-between bg-transparent"
                                                >
                                                    {editShiftValues.model_ids.length > 0
                                                        ? `${editShiftValues.model_ids.length} model${
                                                              editShiftValues.model_ids.length > 1 ? "s" : ""
                                                          } geselecteerd`
                                                        : "Selecteer models..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent portalled={false} className="w-full p-0">
                                                <Command>
                                                    <CommandInput placeholder="Zoek models..." />
                                                    <CommandEmpty>Geen models gevonden.</CommandEmpty>
                                                    <CommandList>
                                                        <CommandGroup>
                                                            {models.map((model) => (
                                                                <CommandItem
                                                                    key={model.id}
                                                                    value={model.display_name}
                                                                    onSelect={() => {
                                                                        const isSelected = editShiftValues.model_ids.includes(model.id)
                                                                        if (isSelected) {
                                                                            setEditShiftValues({
                                                                                ...editShiftValues,
                                                                                model_ids: editShiftValues.model_ids.filter(
                                                                                    (id) => id !== model.id,
                                                                                ),
                                                                            })
                                                                        } else {
                                                                            setEditShiftValues({
                                                                                ...editShiftValues,
                                                                                model_ids: [...editShiftValues.model_ids, model.id],
                                                                            })
                                                                        }
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4",
                                                                            editShiftValues.model_ids.includes(model.id)
                                                                                ? "opacity-100"
                                                                                : "opacity-0",
                                                                        )}
                                                                    />
                                                                    {model.display_name}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                        {editShiftValues.model_ids.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {editShiftValues.model_ids.map((modelId) => {
                                                    const model = models.find((m) => m.id === modelId)
                                                    return (
                                                        <Badge key={modelId} variant="secondary" className="text-xs">
                                                            {model?.display_name}
                                                            <button
                                                                type="button"
                                                                className="ml-1 hover:bg-muted-foreground/20 rounded-full"
                                                                onClick={() =>
                                                                    setEditShiftValues({
                                                                        ...editShiftValues,
                                                                        model_ids: editShiftValues.model_ids.filter((id) => id !== modelId),
                                                                    })
                                                                }
                                                            >
                                                                ×
                                                            </button>
                                                        </Badge>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <Label htmlFor="edit-date">Datum</Label>
                                        <Input
                                            id="edit-date"
                                            type="date"
                                            value={editShiftValues.date}
                                            onChange={(e) =>
                                                setEditShiftValues({ ...editShiftValues, date: e.target.value })
                                            }
                                            required
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Start Tijd</Label>
                                            <div className="flex gap-2">
                                                <Select
                                                    value={editShiftValues.start_hour}
                                                    onValueChange={(value) =>
                                                        setEditShiftValues({ ...editShiftValues, start_hour: value })
                                                    }
                                                >
                                                    <SelectTrigger className="flex-1">
                                                        <SelectValue placeholder="Uur" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {generateTimeOptions("hour").map((option) => (
                                                            <SelectItem key={option.value} value={option.value}>
                                                                {option.value}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Select
                                                    value={editShiftValues.start_minute}
                                                    onValueChange={(value) =>
                                                        setEditShiftValues({ ...editShiftValues, start_minute: value })
                                                    }
                                                >
                                                    <SelectTrigger className="flex-1">
                                                        <SelectValue placeholder="Min" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {generateTimeOptions("minute").map((option) => (
                                                            <SelectItem key={option.value} value={option.value}>
                                                                {option.value}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div>
                                            <Label>Eind Tijd</Label>
                                            <div className="flex gap-2">
                                                <Select
                                                    value={editShiftValues.end_hour}
                                                    onValueChange={(value) =>
                                                        setEditShiftValues({ ...editShiftValues, end_hour: value })
                                                    }
                                                >
                                                    <SelectTrigger className="flex-1">
                                                        <SelectValue placeholder="Uur" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {generateTimeOptions("hour").map((option) => (
                                                            <SelectItem key={option.value} value={option.value}>
                                                                {option.value}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Select
                                                    value={editShiftValues.end_minute}
                                                    onValueChange={(value) =>
                                                        setEditShiftValues({ ...editShiftValues, end_minute: value })
                                                    }
                                                >
                                                    <SelectTrigger className="flex-1">
                                                        <SelectValue placeholder="Min" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {generateTimeOptions("minute").map((option) => (
                                                            <SelectItem key={option.value} value={option.value}>
                                                                {option.value}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>

                                    <Button
                                        type="submit"
                                        className="w-full"
                                        disabled={
                                            editShiftValues.model_ids.length === 0 ||
                                            !editShiftValues.chatter_id ||
                                            !editShiftValues.date ||
                                            !editShiftValues.start_hour ||
                                            !editShiftValues.start_minute ||
                                            !editShiftValues.end_hour ||
                                            !editShiftValues.end_minute
                                        }
                                    >
                                        Save Shift
                                    </Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>

                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Chatter</TableHead>
                                <TableHead className="hidden md:table-cell">Models</TableHead>
                                <TableHead>Start Tijd</TableHead>
                                <TableHead className="hidden md:table-cell">Eind Tijd</TableHead>
                                <TableHead className="hidden md:table-cell">Status</TableHead>
                                <TableHead>Acties</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {currentWeekShifts.map((shift) => (
                                <TableRow key={shift.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                            {shift.chatter.full_name}
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        <div className="flex flex-wrap items-center gap-1">
                                            {shift.model_names.length === 0 && (
                                                <Badge variant="outline" className="text-xs">
                                                    Geen models
                                                </Badge>
                                            )}
                                            {shift.model_names.slice(0, 2).map((name, index) => (
                                                <Badge
                                                    key={`${shift.id}-model-${index}`}
                                                    variant="secondary"
                                                    className="text-xs"
                                                >
                                                    {name}
                                                </Badge>
                                            ))}
                                            {shift.model_names.length > 2 && (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-6 px-2 text-xs"
                                                        >
                                                            +{shift.model_names.length - 2} meer
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent align="start" className="w-48 p-2">
                                                        <div className="flex flex-wrap gap-1">
                                                            {shift.model_names.map((name, index) => (
                                                                <Badge
                                                                    key={`${shift.id}-model-popover-${index}`}
                                                                    variant="secondary"
                                                                    className="text-xs"
                                                                >
                                                                    {name}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-4 w-4 text-muted-foreground" />
                                            {formatDateTime(shift.start_time)}
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">{formatDateTime(shift.end_time)}</TableCell>
                                    <TableCell className="hidden md:table-cell">{getStatusBadge(shift.status)}</TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            {shift.status === "scheduled" && (
                                                <>
                                                    <Button size="sm" onClick={() => updateShiftStatus(shift.id, "active")}>
                                                        Start
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => updateShiftStatus(shift.id, "cancelled")}
                                                    >
                                                        Cancel
                                                    </Button>
                                                </>
                                            )}
                                            {shift.status === "active" && (
                                                <Button size="sm" onClick={() => updateShiftStatus(shift.id, "completed")}>
                                                    Complete
                                                </Button>
                                            )}
                                            <Button
                                                className="hidden md:inline-flex"
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => openEditDialog(shift)}
                                            >
                                                <Pencil className="h-4 w-4 mr-1" />
                                                Edit
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => confirmDeleteShift(shift.id)}
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    {currentWeekShifts.length === 0 && (

                        <div className="text-center py-8 text-muted-foreground">
                            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>Geen komende shifts ingepland.</p>
                            <p className="text-sm">Gebruik de "Add Shift" knop om nieuwe shifts in te plannen.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
            <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Shift verwijderen?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Deze actie kan niet ongedaan worden gemaakt. De shift wordt permanent verwijderd.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuleren</AlertDialogCancel>
                        <AlertDialogAction onClick={performDeleteShift} className="bg-red-600 text-white hover:bg-red-700">
                            Verwijderen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
