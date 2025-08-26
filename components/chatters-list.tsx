"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Search, Clock, DollarSign, Trash2, UserX, UserCheck } from "lucide-react"
import { api } from "@/lib/api"

interface Chatter {
  id: string
  full_name: string
  email: string
  created_at: string
  isOnline: boolean
  todayEarnings: number
  weekEarnings: number
  currency: string
  commission_rate: number
  platform_fee: number
  status?: "active" | "inactive"
}

export function ChattersList() {
  const [chatters, setChatters] = useState<Chatter[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newChatter, setNewChatter] = useState({
    full_name: "",
    email: "",
    password: "",
    currency: "€",
    commission_rate: "8,0",
    platform_fee: "20,0",
  })

  const parseDecimalInput = (value: string | number): number => {
    if (typeof value === "number") return value
    // Replace comma with dot for parsing
    const normalizedValue = value.replace(",", ".")
    return Number.parseFloat(normalizedValue) || 0
  }

  const formatDecimalDisplay = (value: string): string => {
    // Allow both comma and dot, but display with comma
    return value.replace(".", ",")
  }

  useEffect(() => {
    fetchChatters()
  }, [])

  const fetchChatters = async () => {
    try {
      const today = new Date().toISOString().split("T")[0]
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

      const chattersWithRealEarnings = (chattersData || []).map((chatter: any) => {
        const chatterEarnings = (earningsData || []).filter((e: any) => String(e.chatter_id) === String(chatter.id))

        const todayEarnings = chatterEarnings
          .filter((e: any) => e.date === today)
          .reduce((sum: number, e: any) => sum + (e.amount || 0), 0)

        const weekEarnings = chatterEarnings
          .filter((e: any) => e.date >= oneWeekAgo)
          .reduce((sum: number, e: any) => sum + (e.amount || 0), 0)

        return {
          id: String(chatter.id),
          created_at: chatter.created_at,
          isOnline: Math.random() > 0.6,
          todayEarnings,
          weekEarnings,
          currency: chatter.currency || chatter.currency_symbol || "€",
          commission_rate: chatter.commission_rate || chatter.commissionRate || 0,
          platform_fee: chatter.platform_fee || chatter.platformFeeRate || 0,
          status: chatter.status || "active",
        }
      })

      setChatters(chattersWithRealEarnings)
    } catch (error) {
      console.error("Error fetching chatters:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddChatter = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const user = await api.createUser({
        username: newChatter.email,
        password: newChatter.password,
        role: "chatter",
        fullName: newChatter.full_name,
      })

      await api.createChatter({
        userId: user.id,
        currency: newChatter.currency,
        commissionRate: parseDecimalInput(newChatter.commission_rate),
        platformFeeRate: parseDecimalInput(newChatter.platform_fee),
      })

      setNewChatter({
        full_name: "",
        email: "",
        password: "",
        currency: "€",
        commission_rate: "8,0",
        platform_fee: "20,0",
      })
      setIsAddDialogOpen(false)
      fetchChatters()
    } catch (error) {
      console.error("Error adding chatter:", error)
    }
  }

  const handleToggleStatus = async (chatterId: string, currentStatus: string) => {
    try {
      await api.updateChatter(chatterId, {
        status: currentStatus === "active" ? "inactive" : "active",
      })
      fetchChatters()
    } catch (error) {
      console.error("Error toggling chatter status:", error)
    }
  }

  const handleDeleteChatter = async (chatterId: string, email: string) => {
    try {
      await api.deleteChatter(chatterId)
      fetchChatters()
    } catch (error) {
      console.error("Error deleting chatter:", error)
    }
  }

  const filteredChatters = chatters.filter(
    (chatter) =>
      chatter.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chatter.email.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const formatCurrency = (amount: number, currency: string) => {
    const currencyCode = currency === "€" ? "EUR" : "USD"
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: currencyCode,
    }).format(amount)
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Chatters Management</CardTitle>
            <CardDescription>Manage your team members and view their performance</CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Chatter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Chatter</DialogTitle>
                <DialogDescription>Create a new chatter account for your team</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddChatter} className="space-y-4">
                <div>
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={newChatter.full_name}
                    onChange={(e) => setNewChatter({ ...newChatter, full_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newChatter.email}
                    onChange={(e) => setNewChatter({ ...newChatter, email: e.target.value })}
                    required
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Dit email adres wordt gebruikt als gebruikersnaam voor inloggen
                  </p>
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newChatter.password}
                    onChange={(e) => setNewChatter({ ...newChatter, password: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <select
                    id="currency"
                    value={newChatter.currency}
                    onChange={(e) => setNewChatter({ ...newChatter, currency: e.target.value })}
                    className="w-full p-2 border rounded"
                  >
                    <option value="€">Euro (€)</option>
                    <option value="$">Dollar ($)</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="commission_rate">Commission Rate (%)</Label>
                  <Input
                    id="commission_rate"
                    type="text"
                    value={newChatter.commission_rate}
                    onChange={(e) => {
                      const value = e.target.value
                      // Allow numbers, comma, and dot
                      if (/^[\d,.]*$/.test(value)) {
                        setNewChatter({ ...newChatter, commission_rate: value })
                      }
                    }}
                    onBlur={(e) => {
                      // Format display with comma on blur
                      const value = e.target.value
                      if (value && !isNaN(parseDecimalInput(value))) {
                        setNewChatter({ ...newChatter, commission_rate: formatDecimalDisplay(value) })
                      }
                    }}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="platform_fee">Platform Fee (%)</Label>
                  <Input
                    id="platform_fee"
                    type="text"
                    value={newChatter.platform_fee}
                    onChange={(e) => {
                      const value = e.target.value
                      // Allow numbers, comma, and dot
                      if (/^[\d,.]*$/.test(value)) {
                        setNewChatter({ ...newChatter, platform_fee: value })
                      }
                    }}
                    onBlur={(e) => {
                      // Format display with comma on blur
                      const value = e.target.value
                      if (value && !isNaN(parseDecimalInput(value))) {
                        setNewChatter({ ...newChatter, platform_fee: formatDecimalDisplay(value) })
                      }
                    }}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  Create Chatter
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search chatters..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Today</TableHead>
              <TableHead>This Week</TableHead>
              <TableHead>Settings</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredChatters.map((chatter) => (
              <TableRow key={chatter.id} className={chatter.status === "inactive" ? "opacity-60" : ""}>
                <TableCell className="font-medium">{chatter.full_name}</TableCell>
                <TableCell>{chatter.email}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant={chatter.isOnline ? "default" : "secondary"}>
                      <Clock className="h-3 w-3 mr-1" />
                      {chatter.isOnline ? "Online" : "Offline"}
                    </Badge>
                    {chatter.status === "inactive" && <Badge variant="destructive">Inactive</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <DollarSign className="h-3 w-3 mr-1 text-muted-foreground" />
                    {formatCurrency(chatter.todayEarnings, chatter.currency)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <DollarSign className="h-3 w-3 mr-1 text-muted-foreground" />
                    {formatCurrency(chatter.weekEarnings, chatter.currency)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm text-muted-foreground">
                    {chatter.commission_rate}% comm, {chatter.platform_fee}% fee
                  </div>
                </TableCell>
                <TableCell>{new Date(chatter.created_at).toLocaleDateString("nl-NL")}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleStatus(chatter.id, chatter.status || "active")}
                    >
                      {chatter.status === "active" ? (
                        <>
                          <UserX className="h-3 w-3 mr-1" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <UserCheck className="h-3 w-3 mr-1" />
                          Activate
                        </>
                      )}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Chatter</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to permanently delete {chatter.full_name}? This will remove all their
                            data including earnings history. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteChatter(chatter.id, chatter.email)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete Permanently
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filteredChatters.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm
              ? "No chatters found matching your search."
              : "No chatters added yet. Click 'Add Chatter' to create your first team member account."}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
