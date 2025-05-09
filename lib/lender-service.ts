import { createClient } from "@supabase/supabase-js"

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Get all lenders for a specific user
export async function getLenders(userId?: string) {
  let query = supabase.from("lenders").select("*")

  // If userId is provided, filter by user_id
  if (userId) {
    query = query.eq("user_id", userId)
  }

  const { data, error } = await query.order("name")

  if (error) {
    console.error("Error fetching lenders:", error)
    throw new Error("Failed to fetch lenders")
  }

  return data || []
}

// Get lender by ID
export async function getLenderById(id: string) {
  const { data, error } = await supabase.from("lenders").select("*").eq("id", id).single()

  if (error) {
    console.error("Error fetching lender:", error)
    throw new Error("Failed to fetch lender")
  }

  return data
}

// Create a new lender
export async function createLender(lenderData: any, userId?: string) {
  // Add user_id to lenderData if provided
  if (userId) {
    lenderData.user_id = userId
  }

  // Remove iso_application_url from lenderData
  delete lenderData.iso_application_url

  const { data, error } = await supabase.from("lenders").insert([lenderData]).select()

  if (error) {
    console.error("Error creating lender:", error)
    throw new Error("Failed to create lender")
  }

  return data[0]
}

// Update a lender
export async function updateLender(id: string, lenderData: any) {
  // Remove iso_application_url from lenderData
  delete lenderData.iso_application_url

  const { data, error } = await supabase.from("lenders").update(lenderData).eq("id", id).select()

  if (error) {
    console.error("Error updating lender:", error)
    throw new Error("Failed to update lender")
  }

  return data[0]
}

// Delete a lender using the database function
export async function deleteLender(id: string) {
  try {
    console.log(`Attempting to delete lender with ID: ${id}`)

    // First, try to delete directly from the lenders table
    // This approach will work if there are no foreign key constraints or if cascading is set up in the database
    const { error: directDeleteError } = await supabase.from("lenders").delete().eq("id", id)

    if (directDeleteError) {
      console.log("Direct delete failed, trying cascade function:", directDeleteError)

      // If direct delete fails, try using the database function
      const { data, error } = await supabase.rpc("delete_lender_cascade", { lender_uuid: id })

      if (error) {
        console.error("Error deleting lender with cascade function:", error)
        throw new Error(`Failed to delete lender: ${error.message}`)
      }

      console.log("Lender deleted successfully with cascade function")
      return true
    }

    console.log("Lender deleted successfully with direct delete")
    return true
  } catch (error) {
    console.error("Error in deleteLender function:", error)
    throw error
  }
}

// Get lender criteria
export async function getLenderCriteria(lenderId: string) {
  const { data, error } = await supabase.from("lender_criteria").select("*").eq("lender_id", lenderId)

  if (error) {
    console.error("Error fetching lender criteria:", error)
    throw new Error("Failed to fetch lender criteria")
  }

  return data || []
}

// Create lender criteria
export async function createLenderCriteria(criteriaData: any) {
  try {
    // First, get the column information for the lender_criteria table
    const { data: columnInfo, error: columnError } = await supabase.from("lender_criteria").select("*").limit(1)

    if (columnError) {
      console.error("Error fetching column info:", columnError)
      throw new Error("Failed to fetch column information")
    }

    // Create a filtered object with only the columns that exist in the table
    const filteredData: any = { lender_id: criteriaData.lender_id }

    // If we have a sample row, use its keys to determine which columns exist
    if (columnInfo && columnInfo.length > 0) {
      const sampleRow = columnInfo[0]
      const existingColumns = Object.keys(sampleRow)

      // Only include fields that exist in the table
      Object.keys(criteriaData).forEach((key) => {
        if (existingColumns.includes(key)) {
          filteredData[key] = criteriaData[key]
        } else {
          console.log(`Skipping non-existent column: ${key}`)
        }
      })
    } else {
      // If we couldn't get column info, try with a more conservative approach
      // Include only the most likely columns to exist
      const commonColumns = [
        "lender_id",
        "min_credit_score",
        "max_credit_score",
        "min_monthly_revenue",
        "max_monthly_revenue",
        "min_daily_balance",
        "max_daily_balance",
        "min_time_in_business",
        "max_time_in_business",
        "min_funding_amount",
        "max_funding_amount",
        "max_negative_days",
        "cc_email",
        "states",
        "industries",
        "excluded_states",
        "excluded_industries",
      ]

      commonColumns.forEach((key) => {
        if (criteriaData[key] !== undefined) {
          filteredData[key] = criteriaData[key]
        }
      })
    }

    console.log("Inserting lender criteria with filtered data:", filteredData)

    const { data, error } = await supabase.from("lender_criteria").insert([filteredData]).select()

    if (error) {
      console.error("Error creating lender criteria:", error)
      throw new Error(`Failed to create lender criteria: ${error.message}`)
    }

    return data[0]
  } catch (error) {
    console.error("Error in createLenderCriteria:", error)
    throw error
  }
}

// Update lender criteria
export async function updateLenderCriteria(id: string, criteriaData: any) {
  try {
    // First, get the column information for the lender_criteria table
    const { data: columnInfo, error: columnError } = await supabase
      .from("lender_criteria")
      .select("*")
      .eq("id", id)
      .single()

    if (columnError) {
      console.error("Error fetching column info:", columnError)
      throw new Error("Failed to fetch column information")
    }

    // Create a filtered object with only the columns that exist in the table
    const filteredData: any = {}

    // If we have the row, use its keys to determine which columns exist
    if (columnInfo) {
      const existingColumns = Object.keys(columnInfo)

      // Only include fields that exist in the table
      Object.keys(criteriaData).forEach((key) => {
        if (existingColumns.includes(key)) {
          filteredData[key] = criteriaData[key]
        } else {
          console.log(`Skipping non-existent column: ${key}`)
        }
      })
    } else {
      // If we couldn't get column info, try with a more conservative approach
      // Include only the most likely columns to exist
      const commonColumns = [
        "min_credit_score",
        "max_credit_score",
        "min_monthly_revenue",
        "max_monthly_revenue",
        "min_daily_balance",
        "max_daily_balance",
        "min_time_in_business",
        "max_time_in_business",
        "min_funding_amount",
        "max_funding_amount",
        "max_negative_days",
        "cc_email",
        "states",
        "industries",
        "excluded_states",
        "excluded_industries",
      ]

      commonColumns.forEach((key) => {
        if (criteriaData[key] !== undefined) {
          filteredData[key] = criteriaData[key]
        }
      })
    }

    console.log("Updating lender criteria with filtered data:", filteredData)

    const { data, error } = await supabase.from("lender_criteria").update(filteredData).eq("id", id).select()

    if (error) {
      console.error("Error updating lender criteria:", error)
      throw new Error(`Failed to update lender criteria: ${error.message}`)
    }

    return data[0]
  } catch (error) {
    console.error("Error in updateLenderCriteria:", error)
    throw error
  }
}

// Get lenders in user's network
export async function getUserLenderNetwork(userId: string) {
  const { data, error } = await supabase
    .from("user_lender_network")
    .select(`
      id,
      lenders (
        id,
        name,
        email,
        description
      )
    `)
    .eq("user_id", userId)

  if (error) {
    console.error("Error fetching user lender network:", error)
    throw new Error("Failed to fetch user lender network")
  }

  // Transform the data to a more usable format
  return (
    data?.map((item) => ({
      id: item.id,
      ...item.lenders,
    })) || []
  )
}

// Add lender to user's network
export async function addLenderToNetwork(userId: string, lenderId: string) {
  const { data, error } = await supabase
    .from("user_lender_network")
    .insert([{ user_id: userId, lender_id: lenderId }])
    .select()

  if (error) {
    console.error("Error adding lender to network:", error)
    throw new Error("Failed to add lender to network")
  }

  return data[0]
}

// Remove lender from user's network
export async function removeLenderFromNetwork(networkId: string) {
  const { error } = await supabase.from("user_lender_network").delete().eq("id", networkId)

  if (error) {
    console.error("Error removing lender from network:", error)
    throw new Error("Failed to remove lender from network")
  }

  return true
}

// Get lender owner (user who added the lender)
/**
 * Gets the user ID of the first user who added this lender to their network
 * This is considered the "owner" of the lender
 */
export async function getLenderOwner(lenderId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("user_lender_network")
      .select("user_id")
      .eq("lender_id", lenderId)
      .order("created_at", { ascending: true })
      .limit(1)

    if (error) throw error

    return data && data.length > 0 ? data[0].user_id : null
  } catch (error) {
    console.error("Error getting lender owner:", error)
    return null
  }
}

// Get all lenders with their owners
export async function getLendersWithOwners() {
  // First get all lenders
  const { data: lenders, error: lendersError } = await supabase.from("lenders").select("*").order("name")

  if (lendersError) throw lendersError
  if (!lenders || lenders.length === 0) return []

  // For each lender, find the first user who added it to their network
  const lendersWithOwners = await Promise.all(
    lenders.map(async (lender) => {
      const ownerId = await getLenderOwner(lender.id)
      return {
        ...lender,
        owner_id: ownerId,
      }
    }),
  )

  return lendersWithOwners
}
