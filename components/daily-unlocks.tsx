"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { User, Clock, DollarSign } from "lucide-react"
import { api } from "@/lib/api"

interface UnlockData {
  chatterId: string | number
  total: number
}

interface ShiftInfo {
  chatterId: string
  startTime: string
  endTime: string
}

export function DailyUnlocks() {
  const today = new Date().toISOString().split("T")[0]
  const [date, setDate] = useState(today)
  const [unlocks, setUnlocks] = useState<UnlockData[]>([])
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map())
  const [shiftMap, setShiftMap] = useState<Map<string, ShiftInfo>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [unlockData, usersData, shiftsData] = await Promise.all([
          api.getUnlocksPerChatter(date),
          api.getUsers(),
          api.getShifts(),
        ])

        const userMap = new Map(
          (usersData || []).map((u: any) => [String(u.id), u.fullName || u.username || ""]),
        )

        const shiftMap = new Map<string, ShiftInfo>()
        ;(shiftsData || []).forEach((s: any) => {
          const shiftDate = (s.startTime || "").split("T")[0]
          if (shiftDate === date) {
            shiftMap.set(String(s.chatterId), {
              chatterId: String(s.chatterId),
              startTime: s.startTime,
              endTime: s.endTime,
            })
          }
        })

        setUnlocks(unlockData || [])
        setUserMap(userMap)
        setShiftMap(shiftMap)
      } catch (err) {
        console.error("Error fetching daily unlocks:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [date])

  const formatTime = (iso: string) => {
    if (!iso) return "-"
    return new Date(iso).toLocaleTimeString("nl-NL", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(amount)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Daily Unlocks</CardTitle>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-auto"
        />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chatter</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Earnings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unlocks.map((u) => {
                const chatterId = String(u.chatterId)
                const shift = shiftMap.get(chatterId)
                return (
                  <TableRow key={chatterId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {userMap.get(chatterId) || `Chatter ${chatterId}`}
                      </div>
                    </TableCell>
                    <TableCell>
                      {shift ? (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No shift</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 font-semibold">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        {formatCurrency(u.total)}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
        {!loading && unlocks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No unlocks for this date.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

