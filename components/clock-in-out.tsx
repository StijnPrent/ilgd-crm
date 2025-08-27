"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, Play, Square, Timer } from "lucide-react"
import { api } from "@/lib/api"

interface ClockInOutProps {
  userId: string,
  onChange?: () => void
}

interface ActiveTimeEntry {
  id: string
  startTime: string
  shift_id: string | null
}

export function ClockInOut({ userId, onChange }: ClockInOutProps) {
  const [activeEntry, setActiveEntry] = useState<ActiveTimeEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    if (!userId) return

    checkActiveEntry()

    // Update current time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [userId])

  const checkActiveEntry = async () => {
    try {
      const entry = await api.getActiveTimeEntry(userId)
      console.log("Active entry:", entry)
      setActiveEntry(entry || null)
    } catch (error) {
      setActiveEntry(null)
    } finally {
      setLoading(false)
    }
  }

  const handleClockIn = async () => {
    setActionLoading(true)
    try {
      await api.clockIn(userId)
      await checkActiveEntry()
    } catch (error) {
      console.error("Error clocking in:", error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleClockOut = async () => {
    if (!activeEntry) return

    setActionLoading(true)
    try {
      await api.clockOut(activeEntry.id)
      setActiveEntry(null)
      onChange?.()
    } catch (error) {
      console.error("Error clocking out:", error)
    } finally {
      setActionLoading(false)
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("nl-NL", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const calculateWorkingTime = () => {
    if (!activeEntry) return "00:00:00"

    const clockInTime = new Date(activeEntry.startTime)
    const diff = currentTime.getTime() - clockInTime.getTime()

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-10 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Time Tracking
        </CardTitle>
        <CardDescription>Clock in and out to track your working hours</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Time Display */}
        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <div className="text-2xl font-mono font-bold">{formatTime(currentTime)}</div>
          <div className="text-sm text-muted-foreground">{formatDate(currentTime)}</div>
        </div>

        {/* Status and Working Time */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge
              variant={activeEntry ? "default" : "secondary"}
              className={activeEntry ? "bg-green-100 text-green-800" : ""}
            >
              {activeEntry ? (
                <>
                  <Play className="h-3 w-3 mr-1" />
                  Clocked In
                </>
              ) : (
                <>
                  <Square className="h-3 w-3 mr-1" />
                  Clocked Out
                </>
              )}
            </Badge>
          </div>
          {activeEntry && (
            <div className="flex items-center gap-2 text-sm">
              <Timer className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono font-semibold">{calculateWorkingTime()}</span>
            </div>
          )}
        </div>

        {/* Clock In Time Display */}
        {activeEntry && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm text-blue-700">
              <strong>Clocked in at:</strong> {new Date(activeEntry.startTime).toLocaleString("nl-NL")}
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2">
          {activeEntry ? (
            <Button
              onClick={handleClockOut}
              disabled={actionLoading}
              variant="destructive"
              className="w-full"
              size="lg"
            >
              <Square className="h-4 w-4 mr-2" />
              {actionLoading ? "Clocking Out..." : "Clock Out"}
            </Button>
          ) : (
            <Button
              onClick={handleClockIn}
              disabled={actionLoading}
              className="w-full bg-green-600 hover:bg-green-700"
              size="lg"
            >
              <Play className="h-4 w-4 mr-2" />
              {actionLoading ? "Clocking In..." : "Clock In"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
