"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { getAllUsers, approveUser, rejectUser, promoteToAdmin, demoteToUser, createUser } from "@/lib/user-service"
import type { UserManagement } from "@/lib/user-service"
import { useAuth } from "@/context/auth-context"
import { ProtectedRoute } from "@/components/protected-route"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, X, RefreshCw } from "lucide-react"

export default function UsersPage() {
  const [users, setUsers] = useState<UserManagement[]>([])
  const [loading, setLoading] = useState(true)
  const [newUserEmail, setNewUserEmail] = useState("")
  const [newUserPassword, setNewUserPassword] = useState("")
  const { toast } = useToast()
  const router = useRouter()
  const { user } = useAuth()
  const [isMobile, setIsMobile] = useState(false)

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

  useEffect(() => {
    if (!user?.isAdmin) {
      router.push("/")
      return
    }

    fetchUsers()
  }, [user, router])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const fetchedUsers = await getAllUsers()
      setUsers(fetchedUsers)
    } catch (error) {
      console.error("Error fetching users:", error)
      toast({
        title: "Error",
        description: "Failed to fetch users. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (userId: string) => {
    try {
      await approveUser(userId)
      toast({
        title: "Success",
        description: "User approved successfully.",
      })
      fetchUsers()
    } catch (error) {
      console.error("Error approving user:", error)
      toast({
        title: "Error",
        description: "Failed to approve user. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleReject = async (userId: string) => {
    try {
      await rejectUser(userId)
      toast({
        title: "Success",
        description: "User rejected successfully.",
      })
      fetchUsers()
    } catch (error) {
      console.error("Error rejecting user:", error)
      toast({
        title: "Error",
        description: "Failed to reject user. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handlePromote = async (userId: string) => {
    try {
      await promoteToAdmin(userId)
      toast({
        title: "Success",
        description: "User promoted to admin successfully.",
      })
      fetchUsers()
    } catch (error) {
      console.error("Error promoting user:", error)
      toast({
        title: "Error",
        description: "Failed to promote user. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDemote = async (userId: string) => {
    try {
      await demoteToUser(userId)
      toast({
        title: "Success",
        description: "Admin demoted to user successfully.",
      })
      fetchUsers()
    } catch (error) {
      console.error("Error demoting admin:", error)
      toast({
        title: "Error",
        description: "Failed to demote admin. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleAddUser = async () => {
    try {
      if (!newUserEmail || !newUserPassword) {
        toast({
          title: "Error",
          description: "Email and password are required.",
          variant: "destructive",
        })
        return
      }

      await createUser(newUserEmail, newUserPassword, "user", "approved")
      toast({
        title: "Success",
        description: "User created successfully.",
      })
      setNewUserEmail("")
      setNewUserPassword("")
      fetchUsers()
    } catch (error) {
      console.error("Error creating user:", error)
      toast({
        title: "Error",
        description: `Failed to create user: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      })
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <ProtectedRoute adminRequired>
      <div className="container py-6 px-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-xl sm:text-2xl font-bold">User Management</h1>
          <Button variant="outline" onClick={fetchUsers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Add User Form */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleAddUser} className="w-full">
                  Add User
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center items-center py-10">
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="h-8 w-8 animate-spin text-amber-600" />
              <p>Loading users...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop view */}
            <div className="hidden md:block rounded-md border overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((userData) => (
                        <TableRow key={userData.id}>
                          <TableCell className="font-medium">{userData.email}</TableCell>
                          <TableCell>
                            <Badge variant={userData.role === "admin" ? "secondary" : "outline"}>{userData.role}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                userData.status === "approved"
                                  ? "success"
                                  : userData.status === "pending"
                                    ? "warning"
                                    : "destructive"
                              }
                            >
                              {userData.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(userData.created_at)}</TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              {userData.status === "pending" && (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => handleApprove(userData.id)}>
                                    <Check className="h-4 w-4 mr-1" />
                                    Approve
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => handleReject(userData.id)}>
                                    <X className="h-4 w-4 mr-1" />
                                    Reject
                                  </Button>
                                </>
                              )}
                              {userData.role === "user" && userData.status === "approved" && (
                                <Button size="sm" variant="outline" onClick={() => handlePromote(userData.id)}>
                                  Promote
                                </Button>
                              )}
                              {userData.role === "admin" && userData.id !== user?.id && (
                                <Button size="sm" variant="outline" onClick={() => handleDemote(userData.id)}>
                                  Demote
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Mobile view */}
            <div className="md:hidden space-y-4">
              {users.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center">No users found</CardContent>
                </Card>
              ) : (
                users.map((userData) => (
                  <Card key={userData.id}>
                    <CardContent className="pt-6">
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <div className="font-medium">{userData.email}</div>
                          <div className="flex gap-1">
                            <Badge variant={userData.role === "admin" ? "secondary" : "outline"}>{userData.role}</Badge>
                            <Badge
                              variant={
                                userData.status === "approved"
                                  ? "success"
                                  : userData.status === "pending"
                                    ? "warning"
                                    : "destructive"
                              }
                            >
                              {userData.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-sm text-gray-500">Created: {formatDate(userData.created_at)}</div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {userData.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={() => handleApprove(userData.id)}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={() => handleReject(userData.id)}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                          {userData.role === "user" && userData.status === "approved" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              onClick={() => handlePromote(userData.id)}
                            >
                              Promote to Admin
                            </Button>
                          )}
                          {userData.role === "admin" && userData.id !== user?.id && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              onClick={() => handleDemote(userData.id)}
                            >
                              Demote to User
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  )
}
