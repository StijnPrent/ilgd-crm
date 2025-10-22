"use client"

import { useEffect, useState } from "react"
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
import { useToast } from "@/hooks/use-toast"

interface EmployeeShiftsProps {
  userId: string
}

type ShiftAction = "cancel" | "trade"

interface ShiftRequestState {
  cancelRequested?: boolean
  tradeRequested?: boolean
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
  const { toast } = useToast()

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

        const shiftsData: RawShift[] = await api.getShifts({
          chatterId: String(userId),
          from: formatRange(now),
          to: formatRange(endRange),
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
  }, [userId])

  const formatDateTime = (dateTime: string) =>
    new Date(dateTime).toLocaleString("nl-NL", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })

  const requestLabels: Record<ShiftAction, string> = {
    cancel: "Annuleringsverzoek verzonden",
    trade: "Shift aangeboden voor ruil",
  }

  const handleRequest = (shift: Shift, action: ShiftAction) => {
    setRequests((current) => {
      const existing = current[shift.id] || {}
      const updated: ShiftRequestState = {
        ...existing,
        cancelRequested: action === "cancel" ? true : existing.cancelRequested,
        tradeRequested: action === "trade" ? true : existing.tradeRequested,
      }

      return {
        ...current,
        [shift.id]: updated,
      }
    })

    toast({
      title: requestLabels[action],
      description:
        action === "cancel"
          ? "Je verzoek is opgeslagen. Een manager neemt contact met je op om de annulering te bevestigen."
          : "Je shift staat nu als ruilbaar gemarkeerd. Laat het je team weten dat je wilt ruilen!",
    })
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
          {shifts.map((shift) => (
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
                        Tot {new Date(shift.end).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
                      </>
                    ) : (
                      "Eindtijd nog niet ingepland"
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {getStatusBadge(shift.status)}
                    {requests[shift.id]?.cancelRequested && (
                      <Badge variant="secondary">Annulering aangevraagd</Badge>
                    )}
                    {requests[shift.id]?.tradeRequested && (
                      <Badge className="bg-blue-100 text-blue-800" variant="outline">
                        Ruilverzoek ingediend
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="ml-auto h-8 w-8 shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Open shift actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={requests[shift.id]?.cancelRequested}
                    onSelect={(event) => {
                      event.preventDefault()
                      handleRequest(shift, "cancel")
                    }}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" /> Annulering aanvragen
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={requests[shift.id]?.tradeRequested}
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
          ))}
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

