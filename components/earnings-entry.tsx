"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DollarSign, Plus } from "lucide-react"

interface EarningsEntryProps {
  userId: string
  onEarningsAdded?: () => void // Added callback prop to notify parent when earnings are added
}

export function EarningsEntry({ userId, onEarningsAdded }: EarningsEntryProps) {
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [currency, setCurrency] = useState("€")

  useEffect(() => {
    const chatters = JSON.parse(localStorage.getItem("mock_chatters") || "[]")
    const currentChatter = chatters.find((c: any) => c.id === userId)
    if (currentChatter?.currency) {
      setCurrency(currentChatter.currency)
    }
  }, [userId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !amount) return

    setLoading(true)
    setSuccess(false)

    try {
      console.log("[v0] EarningsEntry: Adding earnings for user:", userId, "amount:", amount)

      const today = new Date().toISOString().split("T")[0]
      const numericAmount = Number.parseFloat(amount.replace(",", "."))

      if (isNaN(numericAmount) || numericAmount <= 0) {
        throw new Error("Please enter a valid amount")
      }

      const existingEarnings = JSON.parse(localStorage.getItem("employee_earnings") || "[]")
      const todayEarning = existingEarnings.find((e: any) => e.chatter_id === userId && e.date === today)

      if (todayEarning) {
        // Update existing earnings for today
        todayEarning.amount = Number.parseFloat(todayEarning.amount.toString()) + numericAmount
        todayEarning.description = description || todayEarning.description
        console.log("[v0] EarningsEntry: Updated existing earning:", todayEarning)
      } else {
        // Create new earnings entry
        const newEarning = {
          id: Date.now().toString(),
          chatter_id: userId,
          date: today,
          amount: numericAmount,
          description: description || null,
          created_at: new Date().toISOString(),
        }
        existingEarnings.push(newEarning)
        console.log("[v0] EarningsEntry: Created new earning:", newEarning)
      }

      localStorage.setItem("employee_earnings", JSON.stringify(existingEarnings))

      setAmount("")
      setDescription("")
      setSuccess(true)

      if (onEarningsAdded) {
        console.log("[v0] EarningsEntry: Calling onEarningsAdded callback")
        onEarningsAdded()
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      console.error("Error adding earnings:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Allow both comma and dot as decimal separator
    setAmount(value)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Log Earnings
        </CardTitle>
        <CardDescription>Add your earnings for today</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount ({currency})</Label>
            <Input id="amount" type="text" placeholder="0.00" value={amount} onChange={handleAmountChange} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Brief description of earnings..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              Earnings added successfully! Your daily total has been updated.
            </div>
          )}

          <Button type="submit" disabled={loading || !amount} className="w-full" size="lg">
            <Plus className="h-4 w-4 mr-2" />
            {loading ? "Adding..." : "Add Earnings"}
          </Button>
        </form>

        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> Multiple entries for the same day will be added together. Your commission is
            calculated based on your individual rate after platform fees.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
