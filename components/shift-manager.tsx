"use client"

import type React from "react"

import { useEffect, useState } from "react"
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
import { Calendar, Clock, Plus, User, ChevronLeft, ChevronRight, Trash2 } from "lucide-react"
import { api } from "@/lib/api"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";

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
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [newShift, setNewShift] = useState({
    model_id: "",
    chatter_id: "",
    date: "",
    start_hour: "",
    start_minute: "",
    end_hour: "",
    end_minute: "",
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [shiftsData, chattersData, usersData, modelsData] = await Promise.all([
        api.getShifts(),
        api.getChatters(),
        api.getUsers(),
        api.getModels(),
      ])

      const userMap = new Map(
          (usersData || []).map((u: any) => [
            String(u.id),
            u.fullName || "",
          ]),
      )

      const chattersWithNames = (chattersData || []).map((c: any) => ({
        ...c,
        full_name: userMap.get(String(c.id)) || "",
      }))

      const chatterMap = new Map(
          (chattersWithNames || []).map((c: any) => [String(c.id), c.full_name])
      )

      const formattedShifts = (shiftsData || []).map((shift: any) => ({
        id: String(shift.id),
        chatter_id: String(shift.chatterId),
        start_time: shift.startTime,
        end_time: shift.endTime,
        status: shift.status,
        created_at: shift.createdAt,
        chatter: { full_name: chatterMap.get(String(shift.chatterId)) || "Unknown" },
      }))

      setShifts(formattedShifts)
      setChatters(
        (chattersData || []).map((c: any) => ({
          id: String(c.id),
          full_name: userMap.get(String(c.id)) || "",
        }))
      )
      setModels(
        (modelsData || []).map((m: any) => ({
          id: String(m.id),
          display_name: m.displayName || m.display_name || "",
        }))
      )
    } catch (error) {
      console.error("Error fetching shifts:", error)
    } finally {
      setLoading(false)
    }
  }

  const getWeekDays = (date: Date) => {
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

  const getShiftsForDay = (date: Date) => {
    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(date)
    dayEnd.setHours(23, 59, 59, 999)

    return shifts.filter((shift) => {
      const shiftStart = new Date(shift.start_time)
      return shiftStart >= dayStart && shiftStart <= dayEnd
    })
  }

  const navigateWeek = (direction: "prev" | "next") => {
    const newWeek = new Date(currentWeek)
    newWeek.setDate(currentWeek.getDate() + (direction === "next" ? 7 : -7))
    setCurrentWeek(newWeek)
  }

  const handleAddShift = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const startDateTime = `${newShift.date}T${newShift.start_hour}:${newShift.start_minute}:00`
      const endDateTime = `${newShift.date}T${newShift.end_hour}:${newShift.end_minute}:00`

      await api.createShift({
        chatterId: newShift.chatter_id,
        modelId: newShift.model_id,
        start_time: startDateTime,
        end_time: endDateTime,
        date: newShift.date,
        status: "scheduled",
      })

      setNewShift({
        model_id: "",
        chatter_id: "",
        date: "",
        start_hour: "",
        start_minute: "",
        end_hour: "",
        end_minute: "",
      })
      setIsAddDialogOpen(false)
      fetchData()
    } catch (error) {
      console.error("Error adding shift:", error)
    }
  }

  const updateShiftStatus = async (shiftId: string, newStatus: string) => {
    try {
      await api.updateShift(shiftId, { status: newStatus })
      fetchData()
    } catch (error) {
      console.error("Error updating shift status:", error)
    }
  }

  const confirmDeleteShift = (shiftId: string) => setConfirmDeleteId(shiftId)

  const performDeleteShift = async () => {
    if (!confirmDeleteId) return
    const shiftId = confirmDeleteId

    setDeletingIds(prev => new Set(prev).add(shiftId))
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
      setDeletingIds(prev => {
        const next = new Set(prev)
        next.delete(shiftId)
        return next
      })
      setConfirmDeleteId(null)
    }
  }

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

  const weekDays = getWeekDays(currentWeek)
  const dayNames = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"]

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
                Week {weekDays[0].toLocaleDateString("nl-NL", { day: "numeric", month: "short" })} -{" "}
                {weekDays[6].toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
              </span>
              <Button variant="outline" size="sm" onClick={() => navigateWeek("next")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
                        onClick={() =>
                          updateShiftStatus(shift.id, shift.status === "scheduled" ? "active" : shift.status)
                        }
                      >
                        <div className="font-medium truncate">{shift.chatter.full_name}</div>
                        <div className="text-xs opacity-75">
                          {new Date(shift.start_time).toLocaleTimeString("nl-NL", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          -
                          {new Date(shift.end_time).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
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
          {shifts.length === 0 && (
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
                    <Label htmlFor="model">Model</Label>
                    <Select
                      value={newShift.model_id}
                      onValueChange={(value) => setNewShift({ ...newShift, model_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecteer een model" />
                      </SelectTrigger>
                      <SelectContent>
                        {models.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

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

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={
                      !newShift.model_id ||
                      !newShift.chatter_id ||
                      !newShift.date ||
                      !newShift.start_hour ||
                      !newShift.start_minute ||
                      !newShift.end_hour ||
                      !newShift.end_minute
                    }
                  >
                    Shift Inplannen
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
                <TableHead>Start Tijd</TableHead>
                <TableHead>Eind Tijd</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Acties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shifts.map((shift) => (
                <TableRow key={shift.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {shift.chatter.full_name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {formatDateTime(shift.start_time)}
                    </div>
                  </TableCell>
                  <TableCell>{formatDateTime(shift.end_time)}</TableCell>
                  <TableCell>{getStatusBadge(shift.status)}</TableCell>
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

          {shifts.length === 0 && (
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
            <AlertDialogAction
                onClick={performDeleteShift}
                className="bg-red-600 text-white hover:bg-red-700"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}
