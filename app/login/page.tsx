"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useAuth } from "@/context/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, RefreshCw } from "lucide-react"
import { LoadingSkeleton } from "@/components/loading-skeleton"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const { signIn, isLoading, authError, resetAuthError } = useAuth()
  const [isMobile, setIsMobile] = useState(false)
  const [loginAttempted, setLoginAttempted] = useState(false)
  const [pageLoaded, setPageLoaded] = useState(false)

  // Mark page as loaded after initial render
  useEffect(() => {
    // Use requestAnimationFrame for smoother loading
    const raf = requestAnimationFrame(() => {
      setPageLoaded(true)
    })

    return () => cancelAnimationFrame(raf)
  }, [])

  // Check for mobile on client side only
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    // Initial check
    checkMobile()

    // Add event listener for resize
    window.addEventListener("resize", checkMobile)

    // Cleanup
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Update error message if auth context has an error
  useEffect(() => {
    if (authError && loginAttempted) {
      setError(authError)
    }
  }, [authError, loginAttempted])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    resetAuthError()
    setLoginAttempted(true)

    try {
      const { error: signInError } = await signIn(email, password)

      if (signInError) {
        setError(signInError.message || "Failed to sign in")
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred")
      console.error(err)
    }
  }

  const handleRefresh = () => {
    window.location.reload()
  }

  // Render a lightweight initial UI
  if (!pageLoaded) {
    return <LoadingSkeleton />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className={`font-bold text-navy-700 ${isMobile ? "text-xl" : "text-2xl"}`}>
            Break Bread <span className="text-amber-600">Business Group</span>
          </h1>
          <p className="text-gray-600 mt-2 text-sm">MCA Deal Matching Platform</p>
        </div>

        <Card className="shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className={isMobile ? "text-xl" : "text-2xl"}>Sign In</CardTitle>
            <CardDescription>Enter your credentials to access your account</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex justify-between items-center">
                  <span>{error}</span>
                  <Button variant="ghost" size="sm" onClick={handleRefresh} className="p-0 h-6 w-6">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  inputMode="email"
                  className="h-10"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" className="text-xs text-amber-600 hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-10"
                  disabled={isLoading}
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                disabled={isLoading}
                size={isMobile ? "lg" : "default"}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-t-white border-white/30 rounded-full animate-spin mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center pt-0">
            <p className="text-sm text-gray-600">
              Don't have an account?{" "}
              <Link href="/register" className="text-amber-600 hover:underline">
                Sign up
              </Link>
            </p>
          </CardFooter>
        </Card>

        {/* Refresh button for users experiencing issues */}
        <div className="mt-4 text-center">
          <Button variant="outline" size="sm" onClick={handleRefresh} className="text-xs">
            <RefreshCw className="h-3 w-3 mr-1" /> Having trouble? Click to refresh
          </Button>
        </div>
      </div>
    </div>
  )
}
