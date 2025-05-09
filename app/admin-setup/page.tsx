"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle } from "lucide-react"
import { makeFirstUserAdmin } from "@/lib/user-service"
import Link from "next/link"

export default function AdminSetupPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setIsLoading(true)

    try {
      await makeFirstUserAdmin(email)
      setSuccess(`Success! User ${email} has been made an admin.`)
      setEmail("")
    } catch (err) {
      setError("Failed to set admin user. Make sure the email exists in the system.")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-navy-700">
            Break Bread <span className="text-amber-600">Business Group</span>
          </h1>
          <p className="text-gray-600 mt-2">Admin Setup</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create First Admin</CardTitle>
            <CardDescription>
              To get started, you need to create your first admin user. Enter the email of a registered user to make
              them an admin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="mb-4 bg-green-50 border-green-200 text-green-800">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter user email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-500">
                  This user should already be registered in the system. They will be given admin privileges and marked
                  as approved.
                </p>
              </div>
              <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white" disabled={isLoading}>
                {isLoading ? "Processing..." : "Make Admin"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center">
            <p className="text-sm text-gray-600">
              Already have an admin account?{" "}
              <Link href="/login" className="text-amber-600 hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
