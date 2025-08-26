"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock } from "lucide-react"

interface EmployeeShiftsProps {
  userId: string
}

interface Shift {
  id: string
  start_time: string
  end_time: string
  status: string
}

export function EmployeeShifts({ userId }: EmployeeShiftsProps) {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return

    const fetchShifts = async () => {
      try {
        console.log("[v0] Fetching shifts for user:", userId)

        // Generate mock shifts for the current user
        const mockShifts: Shift[] = [
          {
            id: "shift_1",
            start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
            end_time: new Date(Date.now() + 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000).toISOString(), // Tomorrow + 8 hours
            status: "scheduled",
          },
          {
            id: "shift_2",
            start_time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // Day after tomorrow
            end_time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000).toISOString(), // Day after tomorrow + 6 hours
            status: "scheduled",
          },
          {
            id: "shift_3",
            start_time: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
            end_time: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 7 * 60 * 60 * 1000).toISOString(), // 3 days from now + 7 hours
            status: "scheduled",
          },
        ]

        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 500))

        setShifts(mockShifts)
        console.log("[v0] Mock shifts loaded:", mockShifts.length)
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
              <div>{getStatusBadge(shift.status)}</div>
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
