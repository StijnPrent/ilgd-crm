"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DollarSign, Calendar, User, MessageSquare, Gift, Repeat, FileText } from "lucide-react"
import { api } from "@/lib/api"
import { useEmployeeEarnings } from "@/hooks/use-employee-earnings"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [chatters, setChatters] = useState<{ id: string; full_name: string }[]>([])
  const [chatterFilter, setChatterFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [hasMore, setHasMore] = useState(true)
  const offsetRef = useRef(0)
  const [chatterMap, setChatterMap] = useState<Map<string, string>>(new Map())
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const { refresh } = useEmployeeEarnings()

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

  const loadEarnings = useCallback(
    async (reset = false) => {
      if (reset) {
        setLoading(true)
        offsetRef.current = 0
        setHasMore(true)
      } else {
        setLoadingMore(true)
      }
      try {
        const params: any = {
          limit: limit ?? 20,
          offset: offsetRef.current,
        }
        if (chatterFilter !== "all") params.chatterId = chatterFilter
        if (typeFilter !== "all") params.type = typeFilter
        const data = await api.getEmployeeEarnings(params)
        const formatted = (data || [])
          .map((earning: any) => {
            const chatterId = earning.chatterId
              ? String(earning.chatterId)
              : null
            const full_name = earning.chatterId
              ? chatterMap.get(String(earning.chatterId)) || "Wolf"
              : "Unknown chatter"
            return {
              id: String(earning.id),
              date: earning.date,
              amount: earning.amount,
              description: earning.description,
              type: earning.type,
              chatterId,
              chatter: earning.chatterId ? { full_name } : null,
            }
          })
          .sort(
            (a: any, b: any) =>
              new Date(b.date).getTime() - new Date(a.date).getTime(),
          )
        setEarnings((prev) => (reset ? formatted : [...prev, ...formatted]))
        offsetRef.current = reset
          ? formatted.length
          : offsetRef.current + formatted.length
        if (!data || data.length < (limit ?? 20)) setHasMore(false)
      } catch (error) {
        console.error("Error fetching earnings:", error)
      } finally {
        if (reset) setLoading(false)
        setLoadingMore(false)
      }
    },
    [limit, chatterFilter, typeFilter, chatterMap],
  )

  useEffect(() => {
    if (chatterMap.size === 0) return
    loadEarnings(true)
  }, [chatterFilter, typeFilter, chatterMap, loadEarnings])

  useEffect(() => {
    if (limit) return
    const node = loadMoreRef.current
    if (!node) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        loadEarnings()
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [limit, loadEarnings, hasMore, loadingMore])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("nl-NL", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  }

  const handleChatterChange = async (earningId: string, chatterId: string) => {
    try {
      await api.updateEmployeeEarning(earningId, {
        chatterId: chatterId === "unknown" ? null : chatterId,
      })
      const selected = chatters.find((c) => c.id === chatterId)
      setEarnings((prev) =>
        prev.map((e) =>
          e.id === earningId
            ? {
                ...e,
                chatterId: chatterId === "unknown" ? null : chatterId,
                chatter:
                  chatterId === "unknown"
                    ? null
                    : { full_name: selected?.full_name || "" },
              }
            : e,
        ),
      )
      await refresh()
    } catch (error) {
      console.error("Error updating earning:", error)
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Earnings Overview
        </CardTitle>
        <CardDescription>{limit ? `Latest ${limit} earnings entries` : "All earnings entries"}</CardDescription>
        {!limit && (
          <div className="flex flex-col gap-4 mt-4 md:flex-row">
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
                <SelectItem value="subscriptionperiod">Subscription period</SelectItem>
                <SelectItem value="payperpost">Pay per post</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
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
                      paypermessage: <MessageSquare className="h-4 w-4 text-muted-foreground" />,
                      tip: <Gift className="h-4 w-4 text-muted-foreground" />,
                      subscriptionperiod: <Repeat className="h-4 w-4 text-muted-foreground" />,
                      payperpost: <FileText className="h-4 w-4 text-muted-foreground" />,
                    }
                    return iconMap[earning.type] || null
                  })()}
                </TableCell>
                <TableCell>
                  {['paypermessage','tip'].includes(earning.type) ? (
                    limit ? (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {earning.chatter?.full_name ?? "Unknown chatter"}
                      </div>
                    ) : (
                      <Select
                        value={earning.chatterId ?? "unknown"}
                        onValueChange={(value) => handleChatterChange(earning.id, value)}
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
                    )
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 font-semibold">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    {formatCurrency(earning.amount)}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-muted-foreground">{earning.description || "No description"}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!limit && hasMore && <div ref={loadMoreRef} className="h-10" />}
        {loadingMore && (
          <p className="text-center py-2 text-sm text-muted-foreground">Loading...</p>
        )}
        {earnings.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No earnings recorded yet.</p>
            <p className="text-sm">Earnings will appear here once chatters start logging them.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
