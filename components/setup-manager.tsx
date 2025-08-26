"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useState } from "react"
import { api } from "@/lib/api"

export function SetupManager() {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const createManagerAccount = async () => {
    setIsLoading(true)
    setError(null)
    setMessage(null)

    try {
      await api.createUser({
        username: "WolfMas",
        password: "WolfMas0904",
        fullName: "WolfMas",
        role: "manager",
      })

      setMessage(
        "Manager account created successfully! You can now login with username: WolfMas and password: WolfMas0904",
      )
    } catch (error: any) {
      setError(error?.message || "Failed to create manager account")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Setup Manager Account</CardTitle>
        <CardDescription>Create the initial manager account to get started</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          <p>
            <strong>Username:</strong> WolfMas
          </p>
          <p>
            <strong>Password:</strong> WolfMas0904
          </p>
        </div>

        {message && <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md">{message}</div>}

        {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>}

        <Button onClick={createManagerAccount} disabled={isLoading} className="w-full">
          {isLoading ? "Creating Account..." : "Create Manager Account"}
        </Button>
      </CardContent>
    </Card>
  )
}
