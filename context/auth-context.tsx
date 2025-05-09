"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { createClient } from "@supabase/supabase-js"
import { useRouter, usePathname } from "next/navigation"
import {
  checkUserApprovalStatus,
  registerUserForApproval,
  isCurrentUserAdmin,
  type UserStatus,
} from "@/lib/user-service"

// Initialize Supabase client with minimal options
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create a single instance of the supabase client with minimal configuration
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

type User = {
  id: string
  email: string
  isAdmin: boolean
  status: UserStatus | null
}

type AuthContextType = {
  user: User | null
  isLoading: boolean
  authError: string | null
  signIn: (email: string, password: string) => Promise<{ error: any; message?: string }>
  signUp: (email: string, password: string) => Promise<{ error: any; data: any; message?: string }>
  signOut: () => Promise<void>
  resetAuthError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false) // Start with false to avoid blocking initial render
  const [authError, setAuthError] = useState<string | null>(null)
  const [authInitialized, setAuthInitialized] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const resetAuthError = () => setAuthError(null)

  // Add better error handling in the checkUserStatusAndSetState function

  // Helper function to check user status and set user state
  const checkUserStatusAndSetState = async (sessionUser: any) => {
    try {
      if (!sessionUser) {
        setUser(null)
        return false
      }

      // Add delay to avoid rate limiting
      const addDelay = async () => {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }

      // Check approval status first with retry logic
      let status = null
      let retryCount = 0
      const maxRetries = 3

      while (status === null && retryCount < maxRetries) {
        if (retryCount > 0) {
          // Add exponential backoff
          const delay = Math.pow(2, retryCount) * 1000
          console.log(`Retrying status check in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }

        status = await checkUserApprovalStatus(sessionUser.id)
        retryCount++
      }

      // If we couldn't get a status, the user might not be in the user_management table yet
      if (status === null) {
        // Try to register the user for approval
        try {
          await addDelay() // Add delay before registration
          await registerUserForApproval(sessionUser.id, sessionUser.email)

          // Set user with pending status
          setUser({
            id: sessionUser.id,
            email: sessionUser.email || "",
            isAdmin: false,
            status: "pending",
          })

          return false // Not approved
        } catch (regError) {
          console.error("Error registering user for approval:", regError)
          setUser(null)
          setAuthError("Failed to register for approval. Please try again.")
          return false
        }
      } else {
        // Only check admin status if the user is approved
        let isAdmin = false
        if (status === "approved") {
          await addDelay() // Add delay before admin check
          isAdmin = await isCurrentUserAdmin()
        }

        // User exists in user_management table
        setUser({
          id: sessionUser.id,
          email: sessionUser.email || "",
          isAdmin,
          status,
        })

        return status === "approved"
      }
    } catch (error) {
      console.error("Error checking user status:", error)
      setUser(null)
      setAuthError("Error checking user status. Please try again.")
      return false
    }
  }

  // Defer auth initialization to avoid blocking initial render
  useEffect(() => {
    // Only initialize auth on pages that need it
    const publicPages = ["/login", "/register", "/pending-approval", "/admin-setup"]
    const isPublicPage = publicPages.includes(pathname || "")

    // Don't block initial render on public pages
    if (isPublicPage && !authInitialized) {
      setAuthInitialized(true)
      return
    }

    let isMounted = true

    const initializeAuth = async () => {
      if (authInitialized) return

      try {
        setIsLoading(true)

        // Get session with a lightweight call
        const { data } = await supabase.auth.getSession()

        if (isMounted) {
          if (data.session) {
            await checkUserStatusAndSetState(data.session.user)
          } else {
            setUser(null)

            // Redirect non-public pages if not logged in
            if (!isPublicPage) {
              router.push("/login")
            }
          }

          setAuthInitialized(true)
        }
      } catch (error) {
        console.error("Error initializing auth:", error)
        if (isMounted) {
          setAuthError("Failed to initialize authentication.")
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    // Initialize auth after a short delay to allow initial render
    const timeoutId = setTimeout(() => {
      initializeAuth()
    }, 100)

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
    }
  }, [pathname, router, authInitialized])

  // Set up auth state change listener after initialization
  useEffect(() => {
    if (!authInitialized) return

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (session) {
          await checkUserStatusAndSetState(session.user)
        } else {
          setUser(null)

          // Only redirect on non-public pages
          const publicPages = ["/login", "/register", "/pending-approval", "/admin-setup"]
          const isPublicPage = publicPages.includes(pathname || "")

          if (!isPublicPage) {
            router.push("/login")
          }
        }
      } catch (error) {
        console.error("Error in auth state change:", error)
        setAuthError("Authentication error. Please refresh and try again.")
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [authInitialized, pathname, router])

  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true)
      setAuthError(null)

      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setAuthError(error.message)
        return { error }
      }

      try {
        // Check if user is approved
        const status = await checkUserApprovalStatus(data.user.id)

        if (status === null) {
          // User not in user_management table, register them
          await registerUserForApproval(data.user.id, data.user.email || "")
          router.push("/pending-approval")
          return { error: null, message: "Your account is pending approval." }
        } else if (status !== "approved") {
          // User exists but not approved
          if (status === "pending") {
            router.push("/pending-approval")
            return { error: null, message: "Your account is pending approval." }
          } else if (status === "rejected") {
            await supabase.auth.signOut()
            return { error: { message: "Your account has been rejected." } }
          }
        } else {
          // If approved, proceed to dashboard
          router.push("/dashboard")
        }

        return { error: null }
      } catch (statusError) {
        console.error("Error checking user status:", statusError)
        setAuthError("Error checking account status. Please try again.")
        return { error: { message: "Error checking account status. Please try again." } }
      }
    } catch (error: any) {
      console.error("Error signing in:", error)
      setAuthError(error.message || "An unexpected error occurred. Please try again.")
      return { error: { message: error.message || "An unexpected error occurred" } }
    } finally {
      setIsLoading(false)
    }
  }

  const signUp = async (email: string, password: string) => {
    try {
      setIsLoading(true)
      setAuthError(null)

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        setAuthError(error.message)
        return { data: null, error }
      }

      // Register user for approval in our custom table
      if (data.user) {
        try {
          await registerUserForApproval(data.user.id, email)
          router.push("/pending-approval")
          return {
            data,
            error: null,
            message: "Account created. Please wait for admin approval.",
          }
        } catch (regError) {
          console.error("Error registering for approval:", regError)
          // Don't fail the signup if the user_management entry fails
          // The admin can still manually approve the user
          router.push("/pending-approval")
          return {
            data,
            error: null,
            message: "Account created. Please wait for admin approval.",
          }
        }
      }

      return { data, error: null }
    } catch (error: any) {
      console.error("Error signing up:", error)
      setAuthError(error.message || "An unexpected error occurred. Please try again.")
      return { data: null, error: { message: error.message || "An unexpected error occurred" } }
    } finally {
      setIsLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setIsLoading(true)
      await supabase.auth.signOut()
      setUser(null)
      router.push("/login")
    } catch (error) {
      console.error("Error signing out:", error)
      setAuthError("Failed to sign out. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, authError, signIn, signUp, signOut, resetAuthError }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
