"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock } from "lucide-react"
import { api } from "@/lib/api"

interface EmployeeShiftsProps {
  userId: string
}

interface Shift {
  id: string
  start_time: string
  end_time: string
  status: string
  is_weekly: boolean
  recurrence_parent_id: string | null
}

export function EmployeeShifts({ userId }: EmployeeShiftsProps) {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return

    const fetchShifts = async () => {
      try {
        const shiftsData = await api.getShifts()
        const mappedShifts: Shift[] = (shiftsData || [])
          .filter((s: any) => String(s.chatterId ?? s.chatter_id) === String(userId))
          .map((s: any) => {
            const start = (s.startTime ?? s.start_time ?? "") as string
            const end = (s.endTime ?? s.end_time ?? "") as string

            return {
              id: String(s.id),
              start_time: start,
              end_time: end,
              status: s.status,
              is_weekly: Boolean(s.isWeekly ?? s.is_weekly),
              recurrence_parent_id:
                s.recurrenceParentId !== undefined && s.recurrenceParentId !== null
                  ? String(s.recurrenceParentId)
                  : s.recurrence_parent_id !== undefined && s.recurrence_parent_id !== null
                    ? String(s.recurrence_parent_id)
                    : null,
            }
          })

        const getDateKey = (value: string) => {
          const date = value ? new Date(value) : null
          if (!date || Number.isNaN(date.getTime())) return null
          return date.toISOString().split("T")[0]
        }

        const overridesByDate = new Map<string, Set<string>>()
        mappedShifts.forEach((shift) => {
          if (!shift.is_weekly && shift.recurrence_parent_id) {
            const key = getDateKey(shift.start_time)
            if (!key) return
            if (!overridesByDate.has(key)) {
              overridesByDate.set(key, new Set())
            }
            overridesByDate.get(key)!.add(shift.recurrence_parent_id)
          }
        })

        const filteredShifts = mappedShifts.filter((shift) => {
          if (!shift.is_weekly) return true
          const key = getDateKey(shift.start_time)
          if (!key) return true
          const overrides = overridesByDate.get(key)
          return !(overrides && overrides.has(shift.id))
        })

        setShifts(filteredShifts)
      } catch (error) {
        console.error("Error fetching shifts:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchShifts()
  }, [userId])

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString("nl-NL", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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

  const renderShiftTypeBadge = (shift: Shift) => {
    if (shift.is_weekly) {
      return (
        <Badge variant="outline" className="text-xs px-2 py-0.5">
          Weekly Template
        </Badge>
      )
    }

    if (shift.recurrence_parent_id) {
      return (
        <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800">
          Override
        </Badge>
      )
    }

    return null
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
            <div key={shift.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-4">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">{formatDateTime(shift.start_time)}</div>
                  <div className="text-sm text-muted-foreground">
                    Until {new Date(shift.end_time).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {getStatusBadge(shift.status)}
                {renderShiftTypeBadge(shift)}
              </div>
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

