"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, Clock, User, UserCircle } from "lucide-react"
import { api } from "@/lib/api"

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
  userId?: string // If provided, only show shifts for this user
  showChatterNames?: boolean // Whether to show chatter names (for manager view)
  compact?: boolean // Compact view for overview pages
  refreshTrigger?: number;
  onShiftClick?: (shift: Shift) => void
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

  const getWeekDates = (date: Date) => {
    const week = []
    const startOfWeek = new Date(date)
    const day = startOfWeek.getDay()
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1) // Monday as first day
    startOfWeek.setDate(diff)

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek)
      day.setDate(startOfWeek.getDate() + i)
      week.push(day)
    }
    return week
  }

  const fetchShifts = async () => {
    try {
      const [shiftsData, chattersData, usersData, modelsData] = await Promise.all([
        api.getShifts(),
        api.getChatters(),
        api.getUsers(),
        api.getModels(),
      ])
      console.log("Fetched shifts data:", shiftsData)

      const userMap = new Map(
          (usersData || []).map((u: any) => [
            String(u.id),
            u.fullName || "",
          ]),
      )

      const chatterMap: Record<string, string> = {}
      ;(chattersData || []).forEach((chatter: any) => {
        const name: any = userMap.get(String(chatter.id)) || "Unknown Chatter"
        chatterMap[String(chatter.id)] = name
      })

      const modelMap: Record<string, string> = {}
      ;(modelsData || []).forEach((model: any) => {
        modelMap[String(model.id)] = model.displayName || "Unknown Model"
      })

      const formattedShifts = (shiftsData || []).map((shift: any) => {
        const startDate = shift.startTime
          ? String(shift.startTime).slice(0, 10)
          : String(shift.date)
        const startTime = shift.startTime
          ? String(shift.startTime).slice(11, 16)
          : ""
        const endTime = shift.endTime
          ? String(shift.endTime).slice(11, 16)
          : ""

        return {
          id: String(shift.id),
          chatter_id: String(shift.chatterId),
          chatter_name: chatterMap[String(shift.chatterId)] || "Unknown Chatter",
          model_ids: (shift.modelIds || []).map((id: any) => String(id)),
          model_names: (shift.modelIds || []).map(
            (id: any) => modelMap[String(id)] || "Unknown Model",
          ),
          date: startDate,
          start_time: startTime,
          end_time: endTime,
          status: shift.status,
        }
      })

      console.log("Formatted shifts:", formattedShifts)

      const filteredShifts = userId
          ? formattedShifts.filter((shift: Shift) => shift.chatter_id === String(userId))
          : formattedShifts

      setShifts(filteredShifts)
    } catch (error) {
      console.error("[v0] WeeklyCalendar: Error loading shifts:", error)
      setShifts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchShifts()
  }, [userId, refreshTrigger])

  const weekDates = getWeekDates(currentWeek)
  const today = new Date()

  const getShiftsForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0]
    return shifts.filter((shift) => shift.date === dateStr)
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
          <CardTitle className={compact ? "text-lg" : ""}>{userId ? "My Schedule" : "Team Schedule"}</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigateWeek("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigateWeek("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className={compact ? "pt-0" : ""}>
        <div className="grid grid-cols-7 gap-2">
          {weekDates.map((date, index) => {
            const dayShifts = getShiftsForDate(date)
            const isToday = date.toDateString() === today.toDateString()
            const dayName = date.toLocaleDateString("en", { weekday: "short" })
            const dayNumber = date.getDate()

            return (
              <div key={index} className="space-y-2">
                <div
                  className={`text-center p-2 rounded-lg ${isToday ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  <div className="text-xs font-medium">{dayName}</div>
                  <div className="text-sm">{dayNumber}</div>
                </div>
                <div className="space-y-1 min-h-[100px]">
                  {dayShifts.map((shift) => (
                    <div
                      key={shift.id}
                      className={`p-2 rounded text-white text-xs cursor-pointer transition-colors ${getStatusColor(shift.status)}`}
                      onClick={() => onShiftClick?.(shift)}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <Clock className="h-3 w-3" />
                        <span>{shift.start_time} - {shift.end_time}</span>
                      </div>
                      <div className="flex items-start gap-1">
                        <UserCircle className="h-3 w-3 mt-0.5" />
                        <div className="flex flex-col">
                          {shift.model_names.map((name: string, idx: number) => (
                            <span key={idx} className="truncate">
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                      {showChatterNames && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
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
