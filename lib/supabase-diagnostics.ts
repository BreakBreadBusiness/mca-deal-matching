import { supabase } from "./supabase-client"

export async function runSupabaseDiagnostics() {
  console.log("Running Supabase diagnostics...")

  try {
    // 1. Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    console.log("Environment variables check:", {
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? "✓" : "✗",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey ? "✓" : "✗",
    })

    // 2. Test Supabase connection
    const { data: authData, error: authError } = await supabase.auth.getSession()

    if (authError) {
      console.error("Supabase connection error:", authError)
    } else {
      console.log("Supabase connection successful")
    }

    // 3. List all buckets
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()

    if (bucketsError) {
      console.error("Error listing buckets:", bucketsError)
    } else {
      console.log(
        "Available buckets:",
        buckets.map((b) => b.name),
      )

      // 4. Check each bucket
      for (const bucket of buckets) {
        try {
          const { data: files, error: filesError } = await supabase.storage.from(bucket.name).list()

          if (filesError) {
            console.error(`Error listing files in bucket "${bucket.name}":`, filesError)
          } else {
            console.log(`Bucket "${bucket.name}" contains ${files.length} files/folders`)
          }
        } catch (e) {
          console.error(`Error checking bucket "${bucket.name}":`, e)
        }
      }
    }

    // 5. Check for "applications" bucket specifically
    if (buckets && !buckets.some((b) => b.name === "applications")) {
      console.error('The "applications" bucket does not exist!')
    } else {
      console.log('The "applications" bucket exists')

      // Test listing files in the applications bucket
      const { data: files, error: filesError } = await supabase.storage.from("applications").list()

      if (filesError) {
        console.error('Error listing files in "applications" bucket:', filesError)
      } else {
        console.log(`"applications" bucket contains ${files.length} files/folders`)
      }
    }

    return {
      success: true,
      message: "Diagnostics completed. Check console for details.",
    }
  } catch (error) {
    console.error("Diagnostics failed:", error)
    return {
      success: false,
      message: `Diagnostics failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}
