import { createClient } from "@supabase/supabase-js"

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type ISORequestStatus = "pending" | "approved" | "rejected"

export interface ISORequest {
  id: string
  user_id: string
  lender_id: string
  status: ISORequestStatus
  created_at: string
  notes?: string
  contact_name?: string
  contact_phone?: string
  contact_email?: string
}

// Submit an ISO signup request
export async function submitISORequest(
  userId: string,
  lenderId: string,
  contactName: string,
  contactPhone: string,
  contactEmail: string,
  notes?: string,
) {
  const { data, error } = await supabase
    .from("iso_requests")
    .insert({
      user_id: userId,
      lender_id: lenderId,
      status: "pending",
      contact_name: contactName,
      contact_phone: contactPhone,
      contact_email: contactEmail,
      notes,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Get all ISO requests for a user
export async function getUserISORequests(userId: string) {
  const { data, error } = await supabase
    .from("iso_requests")
    .select("*, lenders(name, email)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) throw error
  return data
}

// Check if a user has an ISO request for a specific lender
export async function checkISORequestStatus(userId: string, lenderId: string) {
  const { data, error } = await supabase
    .from("iso_requests")
    .select("status")
    .eq("user_id", userId)
    .eq("lender_id", lenderId)
    .single()

  if (error && error.code !== "PGRST116") {
    // PGRST116 is the error code for "no rows returned"
    throw error
  }

  return data ? (data.status as ISORequestStatus) : null
}

// Get all pending ISO requests (admin only)
export async function getPendingISORequests() {
  const { data, error } = await supabase
    .from("iso_requests")
    .select("*, lenders(name, email), user_management(email)")
    .eq("status", "pending")
    .order("created_at", { ascending: false })

  if (error) throw error
  return data
}

// Approve an ISO request (admin only)
export async function approveISORequest(requestId: string) {
  const { data, error } = await supabase
    .from("iso_requests")
    .update({ status: "approved" })
    .eq("id", requestId)
    .select("user_id, lender_id")
    .single()

  if (error) throw error

  // Add the lender to the user's network
  if (data) {
    const { error: networkError } = await supabase.from("user_lender_network").insert({
      user_id: data.user_id,
      lender_id: data.lender_id,
    })

    if (networkError) throw networkError
  }

  return true
}

// Reject an ISO request (admin only)
export async function rejectISORequest(requestId: string) {
  const { error } = await supabase.from("iso_requests").update({ status: "rejected" }).eq("id", requestId)

  if (error) throw error
  return true
}
