"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api" // make sure this path matches where you export your ApiClient

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      // Calls /users/login and (per your ApiClient) stores token + user in localStorage
      const result = await api.login(username.trim(), password)

      // Optional: lightweight non-sensitive cookie for your existing middleware
      document.cookie = "user-session=logged-in; path=/; max-age=86400; samesite=lax"

      // Use returned user (preferred) or fall back to what ApiClient stored
      const user = result?.user ?? JSON.parse(localStorage.getItem("user") || "null")

      if (user?.role === "manager") {
        router.push("/manager")
      } else if (user?.role === "chatter") {
        router.push("/dashboard")
      } else {
        // Unknown role → safe default
        router.push("/")
      }
    } catch (err: any) {
      const msg = typeof err?.message === "string" ? err.message : "Login failed"
      // ApiClient throws "API Error: <status> <statusText>"
      setError(msg.includes("401") ? "Invalid username or password" : msg)
    } finally {
      setIsLoading(false)
    }
  }

  const canSubmit = username.trim().length > 0 && password.length > 0

  return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold">Employee Dashboard</CardTitle>
              <CardDescription>Sign in to access your dashboard</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username or email</Label>
                  <Input
                      id="username"
                      type="text"
                      placeholder="Enter your username or email"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                  />
                  <p className="text-xs text-muted-foreground">
                    Chatters: gebruik je e-mailadres als gebruikersnaam
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                  />
                </div>

                {error && (
                    <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                      {error}
                    </div>
                )}

                <Button type="submit" className="w-full" disabled={!canSubmit || isLoading}>
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
  )
}
