"use client"

import { useEffect, useMemo, useState } from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Calendar,
  User,
  MessageSquare,
  Gift,
  Repeat,
  FileText,
  X,
} from "lucide-react"
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { api } from "@/lib/api"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination"

interface EarningsOverviewProps {
  limit?: number
}

interface EarningsData {
  id: string
  date: string
  amount: number
  description: string | null
  type: string
  chatterId: string | null
  chatter: {
    full_name: string
  } | null
}

export function EarningsOverview({ limit }: EarningsOverviewProps) {
  const [earnings, setEarnings] = useState<EarningsData[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [monthlyEarnings, setMonthlyEarnings] = useState<any[]>([])
  const [chatters, setChatters] = useState<{ id: string; full_name: string }[]>([])
  const [chatterMap, setChatterMap] = useState<Map<string, string>>(new Map())
  const [chatterFilter, setChatterFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [hoveredBar, setHoveredBar] = useState<number | null>(null)
  const [syncOpen, setSyncOpen] = useState(false)
  const [syncFrom, setSyncFrom] = useState("")
  const [syncTo, setSyncTo] = useState("")
  const [page, setPage] = useState(1)
  const pageSize = 20

  const mapEarning = (earning: any): EarningsData => {
    const chatterId = earning.chatterId ? String(earning.chatterId) : null
    const full_name = earning.chatterId
      ? chatterMap.get(String(earning.chatterId)) || "Wolf"
      : "Wolf"
    return {
      id: String(earning.id),
      date: earning.date,
      amount: Number(earning.amount),
      description: earning.description,
      type: earning.type,
      chatterId,
      chatter: earning.chatterId ? { full_name } : null,
    }
  }

  const fetchMonthly = async () => {
    try {
      const res = await api.getEmployeeEarningsPaginated({ limit: 1000, offset: 0 })
      const monthData = (res.data || []).filter((e: any) =>
        e.date?.startsWith(monthKey),
      )
      setMonthlyEarnings(monthData)
    } catch (error) {
      console.error("Error loading monthly earnings:", error)
    }
  }

  const fetchPage = async () => {
    try {
      setLoading(true)
      const params: any = {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }
      if (chatterFilter !== "all") params.chatterId = chatterFilter
      if (typeFilter !== "all") params.type = typeFilter
      const res = await api.getEmployeeEarningsPaginated(params)
      let data = res.data || []
      if (selectedDate) {
        data = data.filter((e: any) => e.date.startsWith(selectedDate))
      }
      setEarnings(data.map(mapEarning))
      setTotal(selectedDate ? data.length : res.total)
    } catch (error) {
      console.error("Error loading earnings:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const loadChatters = async () => {
      try {
        const [chattersData, usersData] = await Promise.all([
          api.getChatters(),
          api.getUsers(),
        ])
        const userMap = new Map(
          (usersData || []).map((u: any) => [String(u.id), u.fullName || ""]),
        )
        const activeChatters = (chattersData || []).filter(
          (ch: any) => ch.status !== "inactive",
        )
        const activeChattersMap = new Map(
          activeChatters.map((ch: any) => [String(ch.id), userMap.get(String(ch.id))]),
        )
        setChatterMap(activeChattersMap)
        setChatters([
          { id: "unknown", full_name: "Wolf" },
          ...activeChatters.map((ch: any) => ({
            id: String(ch.id),
            full_name: userMap.get(String(ch.id)) || "",
          })),
        ])
      } catch (error) {
        console.error("Error loading chatters:", error)
      }
    }
    loadChatters()
  }, [])

  useEffect(() => {
    if (limit) {
      const loadLimited = async () => {
        try {
          setLoading(true)
          const res = await api.getEmployeeEarningsPaginated({ limit, offset: 0 })
          setEarnings(res.data.map(mapEarning))
          setTotal(res.total)
        } catch (error) {
          console.error("Error loading earnings:", error)
        } finally {
          setLoading(false)
        }
      }
      loadLimited()
    } else {
      fetchMonthly()
    }
  }, [limit, monthKey])

  useEffect(() => {
    if (!limit) {
      fetchPage()
    }
  }, [page, chatterFilter, typeFilter, selectedDate, limit])

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`

  const chartData = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1
      const fullDate = `${monthKey}-${String(day).padStart(2, "0")}`
      const dayEntries = monthlyEarnings.filter((e: any) =>
        e.date.startsWith(fullDate),
      )
      const total = dayEntries.reduce(
        (sum: number, e: any) => sum + Number(e.amount ?? 0),
        0,
      )
      return { day, total, fullDate }
    })
  }, [monthlyEarnings, monthKey])

  const pageCount = Math.ceil(total / pageSize)

  const paginationNumbers = useMemo(() => {
    if (pageCount <= 5) {
      return Array.from({ length: pageCount }, (_, i) => i + 1)
    }

    if (page <= 4) {
      return [1, 2, 3, 4, "ellipsis", pageCount]
    }

    if (page >= pageCount - 3) {
      return [
        1,
        "ellipsis",
        pageCount - 3,
        pageCount - 2,
        pageCount - 1,
        pageCount,
      ]
    }

    return [1, "ellipsis", page - 1, page, page + 1, "ellipsis", pageCount]
  }, [page, pageCount])

  useEffect(() => {
    setPage(1)
  }, [selectedDate, chatterFilter, typeFilter])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
    }).format(amount)
  }

  const formatDate = (s: string) => {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return s; // fallback
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[+m[2] - 1]} ${+m[3]}`; // e.g. "Sep 9"
  };


  const handleChatterChange = async (earningId: string, chatterId: string) => {
    try {
      await api.updateEmployeeEarning(earningId, {
        chatterId: chatterId === "unknown" ? null : chatterId,
      })
      await fetchPage()
      await fetchMonthly()
    } catch (error) {
      console.error("Error updating earning:", error)
    }
  }

  const handleSync = async () => {
    try {
      if (!syncFrom || !syncTo) return
      await api.syncEarnings(new Date(syncFrom), new Date(syncTo))
      await fetchPage()
      await fetchMonthly()
    } catch (error) {
      console.error("Error syncing earnings:", error)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(limit || 10)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (limit) {
    const limited = earnings.slice(0, limit)
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Earnings Overview
          </CardTitle>
          <CardDescription>
            Latest {limit} earnings entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Chatter</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {limited.map((earning) => (
                <TableRow key={earning.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {formatDate(earning.date)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const iconMap: Record<string, JSX.Element> = {
                        paypermessage: (
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        ),
                        tip: <Gift className="h-4 w-4 text-muted-foreground" />,
                        subscriptionperiod: (
                          <Repeat className="h-4 w-4 text-muted-foreground" />
                        ),
                        payperpost: (
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        ),
                      }
                      return iconMap[earning.type] || null
                    })()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {earning.chatter?.full_name ?? "Wolf"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 font-semibold">
                      {formatCurrency(earning.amount)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">
                      {earning.description || "No description"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    )
  }

  const chartConfig = {
    total: {
      label: "Earnings",
      color: "#6CE8F2",
    },
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Earnings Overview
        </CardTitle>
        <CardDescription>
          {now.toLocaleDateString("nl-NL", { month: "long", year: "numeric" })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <BarChart data={chartData}>
            <defs>
              <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6CE8F2" />
                <stop offset="100%" stopColor="#FFA6FF" />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={40} />
            <Bar dataKey="total">
              {chartData.map((d, idx) => (
                <Cell
                  key={d.day}
                  cursor="pointer"
                  fill="url(#earningsGradient)"
                  fillOpacity={hoveredBar === idx ? 0 : 1}
                  onMouseEnter={() => setHoveredBar(idx)}
                  onMouseLeave={() => setHoveredBar(null)}
                  onClick={() => {
                    setSelectedDate(d.fullDate)
                    setHoveredBar(null)
                  }}
                />
              ))}
            </Bar>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatCurrency(value as number)}
                />
              }
            />
          </BarChart>
        </ChartContainer>

        {selectedDate && (
          <div className="flex items-center justify-between">
            <h3 className="font-medium">
              {new Date(selectedDate).toLocaleDateString("nl-NL", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(null)}
            >
              <X className="h-4 w-4 mr-1" /> Back to month
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <Select value={chatterFilter} onValueChange={setChatterFilter}>
            <SelectTrigger className="w-[200px]">
              <User className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All chatters" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All chatters</SelectItem>
              {chatters.map((chatter) => (
                <SelectItem key={chatter.id} value={chatter.id}>
                  {chatter.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="paypermessage">Pay per message</SelectItem>
              <SelectItem value="tip">Tip</SelectItem>
              <SelectItem value="subscriptionperiod">
                Subscription period
              </SelectItem>
              <SelectItem value="payperpost">Pay per post</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={syncOpen} onOpenChange={setSyncOpen}>
            <DialogTrigger asChild>
              <Button className="md:ml-auto">Sync Earnings</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Sync Earnings</DialogTitle>
                <DialogDescription>
                  Select the start and end date times.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="sync-from">From</Label>
                  <Input
                    id="sync-from"
                    type="datetime-local"
                    value={syncFrom}
                    onChange={(e) => setSyncFrom(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="sync-to">To</Label>
                  <Input
                    id="sync-to"
                    type="datetime-local"
                    value={syncTo}
                    onChange={(e) => setSyncTo(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setSyncOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    await handleSync()
                    setSyncOpen(false)
                  }}
                >
                  Sync
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Chatter</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {earnings.map((earning) => (
              <TableRow key={earning.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {formatDate(earning.date)}
                  </div>
                </TableCell>
                <TableCell>
                  {(() => {
                    const iconMap: Record<string, JSX.Element> = {
                      paypermessage: (
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      ),
                      tip: <Gift className="h-4 w-4 text-muted-foreground" />,
                      subscriptionperiod: (
                        <Repeat className="h-4 w-4 text-muted-foreground" />
                      ),
                      payperpost: (
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      ),
                    }
                    return iconMap[earning.type] || null
                  })()}
                </TableCell>
                <TableCell>
                  {['paypermessage','tip'].includes(earning.type) ? (
                    <Select
                      value={earning.chatterId ?? "unknown"}
                      onValueChange={(value) =>
                        handleChatterChange(earning.id, value)
                      }
                    >
                      <SelectTrigger className="w-[200px]">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {chatters.map((chatter) => (
                          <SelectItem key={chatter.id} value={chatter.id}>
                            {chatter.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 font-semibold">
                    {formatCurrency(earning.amount)}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-muted-foreground">
                    {earning.description || "No description"}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {pageCount > 1 && (
          <Pagination className="pt-4">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setPage((p) => Math.max(1, p - 1))
                  }}
                />
              </PaginationItem>
              {paginationNumbers.map((p, i) => (
                <PaginationItem key={i}>
                  {p === "ellipsis" ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink
                      href="#"
                      isActive={page === p}
                      onClick={(e) => {
                        e.preventDefault()
                        setPage(p)
                      }}
                    >
                      {p}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setPage((p) => Math.min(pageCount, p + 1))
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}

        {earnings.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No earnings recorded yet.</p>
            <p className="text-sm">
              Earnings will appear here once chatters start logging them.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

