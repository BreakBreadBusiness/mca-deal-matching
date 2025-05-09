import { createClient } from "@supabase/supabase-js"

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Get all lenders in a user's network
export async function getUserNetworkLenders(userId: string) {
  const { data, error } = await supabase.from("user_lender_network").select("lender_id").eq("user_id", userId)

  if (error) throw error
  return data.map((item) => item.lender_id)
}

// Add a lender to a user's network
export async function addLenderToNetwork(userId: string, lenderId: string) {
  const { error } = await supabase.from("user_lender_network").insert({ user_id: userId, lender_id: lenderId })

  if (error) throw error
  return true
}

// Remove a lender from a user's network
export async function removeLenderFromNetwork(userId: string, lenderId: string) {
  const { error } = await supabase.from("user_lender_network").delete().eq("user_id", userId).eq("lender_id", lenderId)

  if (error) throw error
  return true
}

// Check if a lender is in a user's network
export async function isLenderInNetwork(userId: string, lenderId: string) {
  const { data, error } = await supabase
    .from("user_lender_network")
    .select("id")
    .eq("user_id", userId)
    .eq("lender_id", lenderId)
    .single()

  if (error && error.code !== "PGRST116") {
    // PGRST116 is the error code for "no rows returned"
    throw error
  }

  return !!data
}
