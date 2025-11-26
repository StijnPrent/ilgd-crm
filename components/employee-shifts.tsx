"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Calendar, Clock, MoreHorizontal, RotateCcw, ArrowLeftRight } from "lucide-react"
import { api } from "@/lib/api"
import { formatUserDateTime, formatUserTime, getUserTimezone, toUtcISOString } from "@/lib/timezone"
import { useToast } from "@/hooks/use-toast"

interface EmployeeShiftsProps {
  userId: string
}

type ShiftAction = "cancel" | "trade"

type ShiftRequestStatus = "pending" | "approved" | "declined" | "cancelled" | "resolved"

interface ShiftRequest {
  id: string
  shiftId: string
  chatterId: string
  type: ShiftAction
  status: ShiftRequestStatus
  note?: string | null
  managerNote?: string | null
  createdAt?: string | null
}

interface ShiftRequestState {
  cancel?: ShiftRequest
  trade?: ShiftRequest
}

interface RawShift {
  id: string | number
  chatterId?: string | number
  chatter_id?: string | number
  startTime?: string
  start_time?: string
  start?: string
  date?: string
  endTime?: string
  end_time?: string
  end?: string
  status?: string
}

interface Shift {
  id: string
  start: string
  end: string | null
  status: string
}

export function EmployeeShifts({ userId }: EmployeeShiftsProps) {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<Record<string, ShiftRequestState>>({})
  const [pendingActions, setPendingActions] = useState<Record<string, ShiftAction | null>>({})
  const timezone = useMemo(() => getUserTimezone(), [])
  const { toast } = useToast()

  const normalizeShiftRequest = useCallback((raw: any): ShiftRequest | null => {
    if (!raw) return null

    const id = raw.id ?? raw.requestId
    const typeValue = (raw.type ?? raw.action)?.toString().toLowerCase()
    if (!id || (typeValue !== "cancel" && typeValue !== "trade")) {
      return null
    }

    const statusValue = (raw.status ?? "pending").toString().toLowerCase()
    const normalizedStatus: ShiftRequestStatus = [
      "pending",
      "approved",
      "declined",
      "cancelled",
      "resolved",
    ].includes(statusValue)
      ? (statusValue as ShiftRequestStatus)
      : "pending"

    const type = typeValue as ShiftAction

    const shiftId = String(
      raw.shiftId ?? raw.shift_id ?? raw.shift?.id ?? raw.shift?.shiftId ?? "",
    )
    const chatterId = String(
      raw.chatterId ?? raw.chatter_id ?? raw.chatter?.id ?? raw.chatter?.chatterId ?? "",
    )

    if (!shiftId || !chatterId) return null

    return {
      id: String(id),
      shiftId,
      chatterId,
      type,
      status: normalizedStatus,
      note: raw.note ?? raw.message ?? null,
      managerNote: raw.managerNote ?? raw.response ?? null,
      createdAt: raw.createdAt ?? raw.created_at ?? null,
    }
  }, [])

  const fetchRequests = useCallback(async () => {
    if (!userId) return

    try {
      const data = await api.getShiftRequests({
        chatterId: String(userId),
        includeResolved: true,
      })

      const grouped: Record<string, ShiftRequestState> = {}

      ;(data || []).forEach((item: any) => {
        const normalized = normalizeShiftRequest(item)
        if (!normalized) return

        const existing = grouped[normalized.shiftId] ?? {}
        grouped[normalized.shiftId] = {
          ...existing,
          [normalized.type]: normalized,
        }
      })

      setRequests(grouped)
    } catch (error) {
      console.error("Error loading shift requests:", error)
    }
  }, [normalizeShiftRequest, userId])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  useEffect(() => {
    if (!userId) return

    const fetchShifts = async () => {
      try {
        const now = new Date()
        now.setHours(0, 0, 0, 0)
        const endRange = new Date(now)
        endRange.setMonth(endRange.getMonth() + 1)

        const formatRange = (date: Date) => {
          const year = date.getFullYear()
          const month = String(date.getMonth() + 1).padStart(2, "0")
          const day = String(date.getDate()).padStart(2, "0")
          return `${year}-${month}-${day}`
        }

        const fromKey = formatRange(now)
        const toKey = formatRange(endRange)
        const from =
          toUtcISOString(fromKey, "00:00:00", timezone) ??
          new Date(now).toISOString()
        const to =
          toUtcISOString(toKey, "23:59:59", timezone) ??
          new Date(endRange).toISOString()

        const shiftsData: RawShift[] = await api.getShifts({
          chatterId: String(userId),
          from,
          to,
        })

        const reference = new Date()

        const normalized = (shiftsData || [])
          .map((shift) => {
            const id = String(shift.id)
            const startValue =
              shift.startTime || shift.start_time || shift.start || shift.date
            const endValue = shift.endTime || shift.end_time || shift.end || null

            if (!startValue) {
              return null
            }

            const statusValue = (shift.status || "scheduled").toString().toLowerCase()

            return {
              id,
              start: startValue,
              end: endValue,
              status: statusValue,
            }
          })
          .filter((shift): shift is Shift => Boolean(shift))
          .filter((shift) => {
            const startDate = new Date(shift.start)
            const endDate = shift.end ? new Date(shift.end) : null
            if (shift.status === "active") {
              return true
            }

            return endDate ? endDate >= reference : startDate >= reference
          })
          .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

        setShifts(normalized)
      } catch (error) {
        console.error("Error fetching shifts:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchShifts()
  }, [timezone, userId])

  const formatDateTime = (dateTime: string) =>
    formatUserDateTime(dateTime, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })

  const requestMessages: Record<
    ShiftAction,
    { title: string; description: string }
  > = {
    cancel: {
      title: "Annuleringsverzoek verzonden",
      description:
        "Je verzoek is opgeslagen. Een manager neemt contact met je op om de annulering te bevestigen.",
    },
    trade: {
      title: "Shift aangeboden voor ruil",
      description:
        "Je shift staat nu als ruilbaar gemarkeerd. Laat het je team weten dat je wilt ruilen!",
    },
  }

  const handleRequest = async (shift: Shift, action: ShiftAction) => {
    setPendingActions((current) => ({
      ...current,
      [shift.id]: action,
    }))

    try {
      const response = await api.createShiftRequest({
        shiftId: shift.id,
        chatterId: String(userId),
        type: action,
      })

      const normalizedResponse = normalizeShiftRequest(response)
      if (normalizedResponse) {
        setRequests((current) => {
          const existing = current[shift.id] ?? {}
          return {
            ...current,
            [shift.id]: {
              ...existing,
              [action]: normalizedResponse,
            },
          }
        })
      } else {
        setRequests((current) => {
          const existing = current[shift.id] ?? {}
          return {
            ...current,
            [shift.id]: {
              ...existing,
              [action]: {
                id: `${shift.id}-${action}`,
                shiftId: shift.id,
                chatterId: String(userId),
                type: action,
                status: "pending",
                note: null,
                managerNote: null,
                createdAt: new Date().toISOString(),
              },
            },
          }
        })
      }

      await fetchRequests()

      const message = requestMessages[action]
      toast({
        title: message.title,
        description: message.description,
      })
    } catch (error) {
      console.error("Error submitting shift request:", error)
      toast({
        title: "Request could not be sent",
        description: "Please try again later or contact your manager.",
        variant: "destructive",
      })
    } finally {
      setPendingActions((current) => {
        const { [shift.id]: _removed, ...rest } = current
        return rest
      })
    }
  }

  const shouldDisableAction = (shiftId: string, action: ShiftAction) => {
    const existing = requests[shiftId]?.[action]
    if (!existing) return false

    return ["pending", "approved", "resolved"].includes(existing.status)
  }

  const getRequestBadge = (request: ShiftRequest) => {
    if (!request) return null

    if (request.type === "cancel") {
      switch (request.status) {
        case "approved":
        case "resolved":
          return <Badge variant="destructive">Annulering bevestigd</Badge>
        case "declined":
          return <Badge variant="outline">Annuleringsverzoek geweigerd</Badge>
        case "cancelled":
          return <Badge variant="outline">Annuleringsverzoek ingetrokken</Badge>
        case "pending":
        default:
          return <Badge variant="secondary">Annuleringsverzoek in behandeling</Badge>
      }
    }

    switch (request.status) {
      case "approved":
      case "resolved":
        return <Badge variant="secondary">Ruilverzoek goedgekeurd</Badge>
      case "declined":
        return <Badge variant="outline">Ruilverzoek afgewezen</Badge>
      case "cancelled":
        return <Badge variant="outline">Ruilverzoek ingetrokken</Badge>
      case "pending":
      default:
        return (
          <Badge className="bg-blue-100 text-blue-800" variant="outline">
            Ruilverzoek in behandeling
          </Badge>
        )
    }
  }

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

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          My Upcoming Shifts
        </CardTitle>
        <CardDescription>Your scheduled work shifts</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {shifts.map((shift) => {
            const shiftRequests = requests[shift.id] ?? {}
            const activeAction = pendingActions[shift.id]
            const cancelBadge = shiftRequests.cancel
              ? getRequestBadge(shiftRequests.cancel)
              : null
            const tradeBadge = shiftRequests.trade
              ? getRequestBadge(shiftRequests.trade)
              : null

            return (
              <div
                key={shift.id}
                className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex flex-1 items-center gap-4">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div className="space-y-1">
                    <div className="font-medium">{formatDateTime(shift.start)}</div>
                    <div className="text-sm text-muted-foreground">
                      {shift.end ? (
                        <>
                          Tot {" "}
                          {formatUserTime(shift.end, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </>
                      ) : (
                        "Eindtijd nog niet ingepland"
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {getStatusBadge(shift.status)}
                      {cancelBadge}
                      {tradeBadge}
                    </div>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-auto h-8 w-8 shrink-0"
                      disabled={Boolean(activeAction)}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Open shift actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={
                        shouldDisableAction(shift.id, "cancel") || activeAction === "cancel"
                      }
                      onSelect={(event) => {
                        event.preventDefault()
                        handleRequest(shift, "cancel")
                      }}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" /> Annulering aanvragen
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={
                        shouldDisableAction(shift.id, "trade") || activeAction === "trade"
                      }
                      onSelect={(event) => {
                        event.preventDefault()
                        handleRequest(shift, "trade")
                      }}
                    >
                      <ArrowLeftRight className="mr-2 h-4 w-4" /> Aanbieden voor ruil
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          })}
        </div>

        {shifts.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No upcoming shifts scheduled.</p>
            <p className="text-sm">Check with your manager for your schedule.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

