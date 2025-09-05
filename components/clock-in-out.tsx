"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, Play, Square, Timer } from "lucide-react"
import { api } from "@/lib/api"
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
  const [currentShift, setCurrentShift] = useState<any>(null)
  const [showEarlyClockOut, setShowEarlyClockOut] = useState(false)

  useEffect(() => {
    if (!userId) return

    checkActiveEntry()
    fetchCurrentShift()

    // Update current time every second
    const timeTimer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    // Refresh shift and active entry info periodically
    const syncTimer = setInterval(() => {
      fetchCurrentShift()
      checkActiveEntry()
    }, 60000)

    return () => {
      clearInterval(timeTimer)
      clearInterval(syncTimer)
    }
  }, [userId])

  const checkActiveEntry = async () => {
    try {
      const entry = await api.getActiveTimeEntry(userId)
      const now = new Date()
      if (entry && entry.startTime && new Date(entry.startTime) <= now) {
        setActiveEntry(entry)
      } else {
        setActiveEntry(null)
      }
    } catch (error) {
      setActiveEntry(null)
    } finally {
      setLoading(false)
    }
  }

  const fetchCurrentShift = async () => {
    try {
      const shifts = await api.getShifts()
      const now = new Date()
      const shift = (shifts || []).find(
        (s: any) =>
          String(s.chatterId) === String(userId) &&
          new Date(s.startTime) <= now &&
          new Date(s.endTime) >= now,
      )
      setCurrentShift(shift || null)
      return shift || null
    } catch (error) {
      setCurrentShift(null)
      return null
    }
  }

  const handleClockIn = async () => {
    setActionLoading(true)
    try {
      const shift = await fetchCurrentShift()
      const now = new Date()
      if (!shift || new Date(shift.startTime) > now) {
        alert("You can only clock in when your shift has started.")
        return
      }
      await api.clockIn(userId)
      await checkActiveEntry()
    } catch (error) {
      console.error("Error clocking in:", error)
    } finally {
      setActionLoading(false)
    }
  }

  const performClockOut = async () => {
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

  const handleClockOut = () => {
    if (!activeEntry) return
    const now = new Date()
    if (
      currentShift &&
      new Date(currentShift.endTime).getTime() - now.getTime() > 60 * 60 * 1000
    ) {
      setShowEarlyClockOut(true)
      return
    }
    void performClockOut()
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
              disabled={
                actionLoading ||
                (currentShift && new Date(currentShift.startTime) > currentTime)
              }
              className="w-full bg-green-600 hover:bg-green-700"
              size="lg"
            >
              <Play className="h-4 w-4 mr-2" />
              {actionLoading ? "Clocking In..." : "Clock In"}
            </Button>
          )}
        </div>
      </CardContent>
      <AlertDialog open={showEarlyClockOut} onOpenChange={setShowEarlyClockOut}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clock out early?</AlertDialogTitle>
            <AlertDialogDescription>
              You are attempting to clock out more than an hour before your shift ends. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowEarlyClockOut(false)
                void performClockOut()
              }}
            >
              Clock Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
