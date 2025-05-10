import { createClient } from "@supabase/supabase-js"

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
  },
})

export type UserStatus = "pending" | "approved" | "rejected"
export type UserRole = "user" | "admin"

export interface UserManagement {
  id: string
  email: string
  role: UserRole
  status: UserStatus
  created_at: string
  updated_at: string
}

// Create a record in the user_management table when a new user registers
export async function registerUserForApproval(userId: string, email: string) {
  try {
    const response = await fetch("/api/user-management", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "register",
        userId,
        email,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to register user for approval")
    }

    return true
  } catch (error) {
    console.error("Error registering for approval:", error)
    throw error
  }
}

// Add better error handling in the checkUserApprovalStatus function

// Check if a user is approved
export async function checkUserApprovalStatus(userId: string): Promise<UserStatus | null> {
  try {
    // Add retry logic with exponential backoff
    const maxRetries = 3
    let retryCount = 0
    let lastError: any = null

    while (retryCount < maxRetries) {
      try {
        const response = await fetch("/api/user-management", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "check-status",
            userId,
          }),
        })

        // If we get a 429 status code, retry after a delay
        if (response.status === 429) {
          retryCount++
          const delay = Math.pow(2, retryCount) * 1000 // Exponential backoff: 2s, 4s, 8s
          console.log(`Rate limited, retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`)
          await new Promise((resolve) => setTimeout(resolve, delay))
          continue
        }

        if (!response.ok) {
          const errorText = await response.text()
          let errorObj
          try {
            // Try to parse as JSON, but don't fail if it's not valid JSON
            errorObj = JSON.parse(errorText)
          } catch (e) {
            // If it's not valid JSON, create an error object with the text
            errorObj = { error: errorText }
          }
          throw new Error(errorObj.error || "Failed to check user approval status")
        }

        const data = await response.json()
        return data.status as UserStatus
      } catch (error) {
        lastError = error
        if (retryCount >= maxRetries - 1) break
        retryCount++
        const delay = Math.pow(2, retryCount) * 1000
        console.log(`Error, retrying in ${delay}ms (attempt ${retryCount}/${maxRetries}):`, error)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    if (lastError) {
      console.error("Error checking user approval status after retries:", lastError)
    }
    return null
  } catch (error) {
    console.error("Error checking user approval status:", error)
    return null
  }
}

// Get all pending users (admin only)
export async function getPendingUsers(): Promise<UserManagement[]> {
  try {
    const response = await fetch("/api/user-management", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "get-pending-users",
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to fetch pending users")
    }

    return await response.json()
  } catch (error) {
    console.error("Error fetching pending users:", error)
    throw error
  }
}

// Get all users (admin only)
export async function getAllUsers(): Promise<UserManagement[]> {
  try {
    const response = await fetch("/api/user-management", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "get-all-users",
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to fetch all users")
    }

    return await response.json()
  } catch (error) {
    console.error("Error fetching all users:", error)
    throw error
  }
}

// Approve a user (admin only)
export async function approveUser(userId: string): Promise<boolean> {
  try {
    const response = await fetch("/api/user-management", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "approve-user",
        userId,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to approve user")
    }

    return true
  } catch (error) {
    console.error("Error approving user:", error)
    throw error
  }
}

// Reject a user (admin only)
export async function rejectUser(userId: string): Promise<boolean> {
  try {
    const response = await fetch("/api/user-management", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "reject-user",
        userId,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to reject user")
    }

    return true
  } catch (error) {
    console.error("Error rejecting user:", error)
    throw error
  }
}

// Promote a user to admin (admin only)
export async function promoteToAdmin(userId: string): Promise<boolean> {
  try {
    const response = await fetch("/api/user-management", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "promote-to-admin",
        userId,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to promote user to admin")
    }

    return true
  } catch (error) {
    console.error("Error promoting user to admin:", error)
    throw error
  }
}

// Demote an admin to user (admin only)
export async function demoteToUser(userId: string): Promise<boolean> {
  try {
    const response = await fetch("/api/user-management", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "demote-to-user",
        userId,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to demote admin to user")
    }

    return true
  } catch (error) {
    console.error("Error demoting admin to user:", error)
    throw error
  }
}

// Add better error handling in the isCurrentUserAdmin function

// Check if current user is an admin - Using API endpoint to avoid RLS issues
export async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    // Get the current user from the session
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return false

    // Add retry logic with exponential backoff
    const maxRetries = 3
    let retryCount = 0
    let lastError: any = null

    while (retryCount < maxRetries) {
      try {
        const response = await fetch("/api/user-management", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "get-user-role",
            userId: user.id,
          }),
        })

        // If we get a 429 status code, retry after a delay
        if (response.status === 429) {
          retryCount++
          const delay = Math.pow(2, retryCount) * 1000 // Exponential backoff: 2s, 4s, 8s
          console.log(`Rate limited, retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`)
          await new Promise((resolve) => setTimeout(resolve, delay))
          continue
        }

        if (!response.ok) {
          const errorText = await response.text()
          let errorObj
          try {
            // Try to parse as JSON, but don't fail if it's not valid JSON
            errorObj = JSON.parse(errorText)
          } catch (e) {
            // If it's not valid JSON, create an error object with the text
            errorObj = { error: errorText }
          }
          console.error("Error checking admin status:", errorObj)
          return false
        }

        const data = await response.json()
        return data.role === "admin"
      } catch (error) {
        lastError = error
        if (retryCount >= maxRetries - 1) break
        retryCount++
        const delay = Math.pow(2, retryCount) * 1000
        console.log(`Error, retrying in ${delay}ms (attempt ${retryCount}/${maxRetries}):`, error)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    if (lastError) {
      console.error("Error checking if user is admin after retries:", lastError)
    }
    return false
  } catch (error) {
    console.error("Error checking if user is admin:", error)
    return false
  }
}

// Manually make the first user an admin (run this after registering the first account)
export async function makeFirstUserAdmin(email: string): Promise<boolean> {
  try {
    const response = await fetch("/api/user-management", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "make-first-admin",
        email,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to make first user admin")
    }

    return true
  } catch (error) {
    console.error("Error making first user admin:", error)
    throw error
  }
}

// Create a new user (admin only)
export async function createUser(
  email: string,
  password: string,
  role: UserRole = "user",
  status: UserStatus = "approved",
): Promise<boolean> {
  try {
    const response = await fetch("/api/user-management", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "create-user",
        email,
        password,
        role,
        status,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to create user")
    }

    return true
  } catch (error) {
    console.error("Error creating user:", error)
    throw error
  }
}
