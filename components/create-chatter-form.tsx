"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"

export function CreateChatterForm() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [currency, setCurrency] = useState("€")
  const [commissionRate, setCommissionRate] = useState("8,00")
  const [platformFeeRate, setPlatformFeeRate] = useState("20,00")
  const [isLoading, setIsLoading] = useState(false)

  const parseDecimalInput = (value: string): number => {
    // Replace comma with dot for parsing
    const normalizedValue = value.replace(",", ".")
    return Number.parseFloat(normalizedValue) || 0
  }

  const formatDecimalDisplay = (value: string): string => {
    // Allow both comma and dot, but display with comma
    return value.replace(".", ",")
  }

  const handleCreateChatter = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch("/api/create-chatter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
          currency,
          commissionRate: parseDecimalInput(commissionRate),
          platformFeeRate: parseDecimalInput(platformFeeRate),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create chatter account")
      }

      toast({
        title: "Success",
        description: `Chatter account created for ${username}`,
      })

      // Reset form
      setUsername("")
      setPassword("")
      setCurrency("€")
      setCommissionRate("8,00")
      setPlatformFeeRate("20,00")
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create account",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Chatter Account</CardTitle>
        <CardDescription>Create a new account for a chatter with custom settings</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCreateChatter} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-username">Username</Label>
              <Input
                id="new-username"
                type="text"
                placeholder="Enter username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Enter password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="€">Euro (€)</SelectItem>
                  <SelectItem value="$">Dollar ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="commission-rate">Commission Rate (%)</Label>
              <Input
                id="commission-rate"
                type="text"
                placeholder="8,00"
                value={commissionRate}
                onChange={(e) => {
                  const value = e.target.value
                  // Allow numbers, comma, and dot
                  if (/^[\d,.]*$/.test(value)) {
                    setCommissionRate(value)
                  }
                }}
                onBlur={(e) => {
                  // Format display with comma on blur
                  const value = e.target.value
                  if (value && !isNaN(parseDecimalInput(value))) {
                    setCommissionRate(formatDecimalDisplay(value))
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform-fee">Platform Fee (%)</Label>
              <Input
                id="platform-fee"
                type="text"
                placeholder="20,00"
                value={platformFeeRate}
                onChange={(e) => {
                  const value = e.target.value
                  // Allow numbers, comma, and dot
                  if (/^[\d,.]*$/.test(value)) {
                    setPlatformFeeRate(value)
                  }
                }}
                onBlur={(e) => {
                  // Format display with comma on blur
                  const value = e.target.value
                  if (value && !isNaN(parseDecimalInput(value))) {
                    setPlatformFeeRate(formatDecimalDisplay(value))
                  }
                }}
              />
            </div>
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Creating..." : "Create Chatter Account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
