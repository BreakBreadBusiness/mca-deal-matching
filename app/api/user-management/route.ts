import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// Initialize Supabase client with service role key for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Initialize regular Supabase client for user operations
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Add these helper functions at the top of the file, after the supabase client initialization
// Delay function for rate limiting
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Function to handle Supabase requests with retry logic
async function safeSupabaseRequest<T>(requestFn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let retries = 0
  let lastError: any

  while (retries < maxRetries) {
    try {
      // Add increasing delay between retries
      if (retries > 0) {
        await delay(Math.pow(2, retries) * 500) // Exponential backoff: 500ms, 1s, 2s
      }

      return await requestFn()
    } catch (error: any) {
      lastError = error
      console.error(`Supabase request failed (attempt ${retries + 1}/${maxRetries}):`, error)

      // If this is a rate limit error, retry after a delay
      if (error.message?.includes("Too Many Requests") || error.code === 429) {
        retries++
        continue
      }

      // For other errors, throw immediately
      throw error
    }
  }

  // If we've exhausted retries, throw the last error
  throw lastError
}

export async function POST(request: Request) {
  try {
    const { action, userId, email, password, role, status } = await request.json()

    // Actions that don't require authentication or admin check
    if (
      action === "register" ||
      action === "check-status" ||
      action === "make-first-admin" ||
      action === "get-user-role"
    ) {
      switch (action) {
        case "register":
          // Register a new user for approval
          const { error: registerError } = await safeSupabaseRequest(() =>
            supabaseAdmin.from("user_management").insert({
              id: userId,
              email: email,
              role: "user",
              status: "pending",
            }),
          )

          if (registerError) {
            console.error("Error registering user for approval:", registerError)
            return NextResponse.json({ error: "Failed to register for approval" }, { status: 500 })
          }

          return NextResponse.json({ success: true })

        case "check-status":
          // Check a user's approval status
          try {
            const { data: statusData, error: statusError } = await safeSupabaseRequest(() =>
              supabaseAdmin.from("user_management").select("status").eq("id", userId).maybeSingle(),
            )

            if (statusError) {
              console.error("Error checking user status:", statusError)
              return NextResponse.json({ error: "Failed to check user status" }, { status: 500 })
            }

            return NextResponse.json({ status: statusData?.status || null })
          } catch (error) {
            console.error("Error checking user status:", error)
            return NextResponse.json(
              { error: "Failed to check user status due to rate limiting or server error" },
              { status: 429 },
            )
          }

        case "get-user-role":
          // Get a user's role - used by isCurrentUserAdmin function
          try {
            const { data: roleData, error: roleError } = await safeSupabaseRequest(() =>
              supabaseAdmin.from("user_management").select("role").eq("id", userId).maybeSingle(),
            )

            if (roleError) {
              console.error("Error getting user role:", roleError)
              return NextResponse.json({ error: "Failed to get user role" }, { status: 500 })
            }

            return NextResponse.json({ role: roleData?.role || "user" })
          } catch (error) {
            console.error("Error getting user role:", error)
            return NextResponse.json(
              { error: "Failed to get user role due to rate limiting or server error" },
              { status: 429 },
            )
          }

        case "make-first-admin":
          // Make the first user an admin (used during initial setup)
          const { data: existingAdmins, error: existingAdminsError } = await safeSupabaseRequest(() =>
            supabaseAdmin.from("user_management").select("id").eq("role", "admin"),
          )

          if (existingAdminsError) {
            console.error("Error checking existing admins:", existingAdminsError)
            return NextResponse.json({ error: "Failed to check existing admins" }, { status: 500 })
          }

          // Only allow this if there are no admins yet
          if (existingAdmins.length > 0) {
            return NextResponse.json({ error: "Cannot make first admin: Admin users already exist" }, { status: 400 })
          }

          // Find the user by email
          const { data: userByEmail, error: userByEmailError } = await safeSupabaseRequest(() =>
            supabaseAdmin.from("user_management").select("id").eq("email", email).single(),
          )

          if (userByEmailError) {
            console.error("Error finding user by email:", userByEmailError)
            return NextResponse.json({ error: "Failed to find user by email" }, { status: 500 })
          }

          if (!userByEmail) {
            return NextResponse.json({ error: "User not found" }, { status: 404 })
          }

          // Update the user to be an admin and approved
          const { error: makeAdminError } = await safeSupabaseRequest(() =>
            supabaseAdmin
              .from("user_management")
              .update({ role: "admin", status: "approved" })
              .eq("id", userByEmail.id),
          )

          if (makeAdminError) {
            console.error("Error making user admin:", makeAdminError)
            return NextResponse.json({ error: "Failed to make user admin" }, { status: 500 })
          }

          return NextResponse.json({ success: true })
      }
    }

    // For all other actions, check authentication
    const {
      data: { session },
    } = await safeSupabaseRequest(() => supabase.auth.getSession())

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const currentUserId = session.user.id

    // Check if the current user is an admin for admin-only actions
    const { data: adminData, error: adminError } = await safeSupabaseRequest(() =>
      supabaseAdmin.from("user_management").select("role").eq("id", currentUserId).single(),
    )

    if (adminError) {
      console.error("Error checking admin status:", adminError)
      return NextResponse.json({ error: "Failed to verify admin status" }, { status: 500 })
    }

    const isAdmin = adminData?.role === "admin"

    // Handle different actions
    switch (action) {
      case "get-pending-users":
        // Get all pending users (admin only)
        if (!isAdmin) {
          return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 })
        }

        const { data: pendingUsers, error: pendingError } = await safeSupabaseRequest(() =>
          supabaseAdmin
            .from("user_management")
            .select("*")
            .eq("status", "pending")
            .order("created_at", { ascending: false }),
        )

        if (pendingError) {
          console.error("Error fetching pending users:", pendingError)
          return NextResponse.json({ error: "Failed to fetch pending users" }, { status: 500 })
        }

        return NextResponse.json(pendingUsers)

      case "get-all-users":
        // Get all users (admin only)
        if (!isAdmin) {
          return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 })
        }

        const { data: allUsers, error: allUsersError } = await safeSupabaseRequest(() =>
          supabaseAdmin.from("user_management").select("*").order("created_at", { ascending: false }),
        )

        if (allUsersError) {
          console.error("Error fetching all users:", allUsersError)
          return NextResponse.json({ error: "Failed to fetch all users" }, { status: 500 })
        }

        return NextResponse.json(allUsers)

      case "approve-user":
        // Approve a user (admin only)
        if (!isAdmin) {
          return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 })
        }

        const { error: approveError } = await safeSupabaseRequest(() =>
          supabaseAdmin.from("user_management").update({ status: "approved" }).eq("id", userId),
        )

        if (approveError) {
          console.error("Error approving user:", approveError)
          return NextResponse.json({ error: "Failed to approve user" }, { status: 500 })
        }

        return NextResponse.json({ success: true })

      case "reject-user":
        // Reject a user (admin only)
        if (!isAdmin) {
          return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 })
        }

        const { error: rejectError } = await safeSupabaseRequest(() =>
          supabaseAdmin.from("user_management").update({ status: "rejected" }).eq("id", userId),
        )

        if (rejectError) {
          console.error("Error rejecting user:", rejectError)
          return NextResponse.json({ error: "Failed to reject user" }, { status: 500 })
        }

        return NextResponse.json({ success: true })

      case "promote-to-admin":
        // Promote a user to admin (admin only)
        if (!isAdmin) {
          return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 })
        }

        const { error: promoteError } = await safeSupabaseRequest(() =>
          supabaseAdmin.from("user_management").update({ role: "admin" }).eq("id", userId),
        )

        if (promoteError) {
          console.error("Error promoting user to admin:", promoteError)
          return NextResponse.json({ error: "Failed to promote user to admin" }, { status: 500 })
        }

        return NextResponse.json({ success: true })

      case "demote-to-user":
        // Demote an admin to user (admin only)
        if (!isAdmin) {
          return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 })
        }

        const { error: demoteError } = await safeSupabaseRequest(() =>
          supabaseAdmin.from("user_management").update({ role: "user" }).eq("id", userId),
        )

        if (demoteError) {
          console.error("Error demoting admin to user:", demoteError)
          return NextResponse.json({ error: "Failed to demote admin to user" }, { status: 500 })
        }

        return NextResponse.json({ success: true })

      case "create-user":
        // Create a new user (admin only)
        if (!isAdmin) {
          return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 })
        }

        // First create the auth user
        const { data: authUser, error: authError } = await safeSupabaseRequest(() =>
          supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
          }),
        )

        if (authError) {
          console.error("Error creating auth user:", authError)
          return NextResponse.json({ error: "Failed to create user: " + authError.message }, { status: 500 })
        }

        // Then create the user management record
        const { error: userMgmtError } = await safeSupabaseRequest(() =>
          supabaseAdmin.from("user_management").insert({
            id: authUser.user.id,
            email: email,
            role: role || "user",
            status: status || "approved",
          }),
        )

        if (userMgmtError) {
          console.error("Error creating user management record:", userMgmtError)
          // Try to clean up the auth user if the management record fails
          await safeSupabaseRequest(() => supabaseAdmin.auth.admin.deleteUser(authUser.user.id))
          return NextResponse.json({ error: "Failed to create user management record" }, { status: 500 })
        }

        return NextResponse.json({ success: true })

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error in user management API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
