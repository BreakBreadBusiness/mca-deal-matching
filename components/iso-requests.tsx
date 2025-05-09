"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { getPendingISORequests, approveISORequest, rejectISORequest, type ISORequest } from "@/lib/iso-service"
import { useAuth } from "@/context/auth-context"

export function ISORequests() {
  const [isoRequests, setIsoRequests] = useState<ISORequest[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<ISORequest | null>(null)
  const [notes, setNotes] = useState("")
  const { toast } = useToast()
  const { user } = useAuth()

  useEffect(() => {
    fetchISORequests()
  }, [])

  const fetchISORequests = async () => {
    try {
      setLoading(true)
      const fetchedRequests = await getPendingISORequests()
      setIsoRequests(fetchedRequests)
    } catch (error) {
      console.error("Error fetching ISO requests:", error)
      toast({
        title: "Error",
        description: "Failed to fetch ISO requests. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (requestId: string) => {
    try {
      await approveISORequest(requestId)
      toast({
        title: "Success",
        description: "ISO request approved successfully.",
      })
      fetchISORequests()
    } catch (error) {
      console.error("Error approving ISO request:", error)
      toast({
        title: "Error",
        description: "Failed to approve ISO request. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleReject = async (requestId: string) => {
    try {
      await rejectISORequest(requestId)
      toast({
        title: "Success",
        description: "ISO request rejected successfully.",
      })
      fetchISORequests()
    } catch (error) {
      console.error("Error rejecting ISO request:", error)
      toast({
        title: "Error",
        description: "Failed to reject ISO request. Please try again.",
        variant: "destructive",
      })
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (loading) {
    return <div className="container py-10">Loading ISO requests...</div>
  }

  return (
    <div className="container py-10">
      <h1 className="text-2xl font-bold mb-4">ISO Requests</h1>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User Email</TableHead>
              <TableHead>Lender Name</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isoRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  No ISO requests found
                </TableCell>
              </TableRow>
            ) : (
              isoRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>{request.user_management?.email}</TableCell>
                  <TableCell>{request.lenders?.name}</TableCell>
                  <TableCell>{formatDate(request.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline" onClick={() => handleApprove(request.id)}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleReject(request.id)}>
                        Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
