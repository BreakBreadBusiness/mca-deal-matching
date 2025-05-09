"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, AlertTriangle, LogOut } from "lucide-react"
import { useMobile } from "@/hooks/use-mobile"

export default function PendingApprovalPage() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const isMobile = useMobile()

  useEffect(() => {
    // If user is approved, redirect to dashboard
    if (user?.status === "approved") {
      router.push("/")
    }

    // If user is rejected, redirect to login with message
    if (user?.status === "rejected") {
      router.push("/login?status=rejected")
    }
  }, [user, router])

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
          <CardHeader className="text-center pb-3">
            <div className="mx-auto mb-4 bg-amber-100 p-3 rounded-full w-16 h-16 flex items-center justify-center">
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
            <CardTitle className={isMobile ? "text-xl" : "text-2xl"}>Account Pending Approval</CardTitle>
            <CardDescription>Your account is waiting for administrator approval</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-amber-50 p-4 rounded-md border border-amber-200">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-800">
                    Your account has been created but requires administrator approval before you can access the system.
                    Please check back later or contact your administrator.
                  </p>
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-600">
              <p>Email: {user?.email}</p>
              <p>Status: {user?.status === "pending" ? "Pending Approval" : "Checking status..."}</p>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" onClick={signOut} size={isMobile ? "lg" : "default"}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
