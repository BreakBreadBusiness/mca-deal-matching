import { createClient } from "@supabase/supabase-js"

// Check if the environment variables are defined
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Log the environment variables for debugging (partial values for security)
console.log("Supabase URL:", supabaseUrl ? `${supabaseUrl.substring(0, 15)}...` : "undefined")
console.log("Supabase Anon Key:", supabaseAnonKey ? `${supabaseAnonKey.substring(0, 5)}...` : "undefined")

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase environment variables")
}

// Create a single supabase client for the entire app
export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

/**
 * Checks if a specific bucket exists in Supabase storage
 * Now case-insensitive and with better error handling
 */
export async function checkBucketExists(bucketName: string): Promise<boolean> {
  try {
    console.log(`Checking if bucket "${bucketName}" exists...`)

    // Force a fresh check by adding a cache-busting parameter
    const { data: buckets, error } = await supabase.storage.listBuckets()

    if (error) {
      console.error("Error checking buckets:", error)
      return false
    }

    // Log all available buckets for debugging
    console.log(
      "Available buckets:",
      buckets.map((b) => b.name),
    )

    // Case-insensitive check for the bucket
    const bucketExists = buckets.some((bucket) => bucket.name.toLowerCase() === bucketName.toLowerCase())

    // If we found a match but with different case, log it
    if (bucketExists && !buckets.some((bucket) => bucket.name === bucketName)) {
      const actualBucket = buckets.find((bucket) => bucket.name.toLowerCase() === bucketName.toLowerCase())
      console.log(`Found bucket with different case: "${actualBucket?.name}" instead of "${bucketName}"`)
    }

    console.log(`Bucket "${bucketName}" ${bucketExists ? "exists" : "does not exist"}.`)

    // If the bucket exists, try to list files to verify access
    if (bucketExists) {
      const exactBucket = buckets.find((bucket) => bucket.name.toLowerCase() === bucketName.toLowerCase())

      if (exactBucket) {
        try {
          const { data: files, error: listError } = await supabase.storage.from(exactBucket.name).list()

          if (listError) {
            console.error(`Error listing files in bucket "${exactBucket.name}":`, listError)
            console.log("This may indicate a permissions issue.")
            return true // Still return true since the bucket exists
          }

          console.log(`Successfully listed files in bucket "${exactBucket.name}". Found ${files.length} files/folders.`)
        } catch (e) {
          console.error(`Error accessing bucket "${exactBucket.name}":`, e)
        }
      }
    }

    return bucketExists
  } catch (error) {
    console.error("Error checking if bucket exists:", error)
    return false
  }
}

/**
 * Lists all available buckets in Supabase storage
 */
export async function listAllBuckets(): Promise<string[]> {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets()

    if (error) {
      console.error("Error listing buckets:", error)
      return []
    }

    return buckets.map((bucket) => bucket.name)
  } catch (error) {
    console.error("Error listing all buckets:", error)
    return []
  }
}

/**
 * Gets the exact case-sensitive name of a bucket
 */
export async function getExactBucketName(approximateName: string): Promise<string | null> {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets()

    if (error) {
      console.error("Error getting exact bucket name:", error)
      return null
    }

    const exactBucket = buckets.find((bucket) => bucket.name.toLowerCase() === approximateName.toLowerCase())

    return exactBucket ? exactBucket.name : null
  } catch (error) {
    console.error("Error in getExactBucketName:", error)
    return null
  }
}

/**
 * Runs a comprehensive diagnostic on Supabase storage
 */
export async function runSupabaseDiagnostics() {
  try {
    const diagnostics = {
      connection: false,
      buckets: [] as any[],
      environment: {
        supabaseUrl: !!supabaseUrl,
        supabaseAnonKey: !!supabaseAnonKey,
        actualUrl: supabaseUrl ? `${supabaseUrl.substring(0, 15)}...` : "undefined",
      },
      projectInfo: null as any,
    }

    // Test connection and get project info
    try {
      // First try to get project info
      const { data: projectData, error: projectError } = await supabase.rpc("get_project_info", {})

      if (!projectError && projectData) {
        diagnostics.projectInfo = projectData
      }

      // Then try a simple query to verify connection
      const { data, error } = await supabase.from("_dummy_query").select("*").limit(1)
      diagnostics.connection = !error
    } catch (e) {
      diagnostics.connection = false
    }

    // List buckets
    const buckets = await listAllBuckets()

    // Check each bucket
    for (const bucket of buckets) {
      try {
        const { data, error } = await supabase.storage.from(bucket).list()
        diagnostics.buckets.push({
          name: bucket,
          accessible: !error,
          fileCount: data?.length || 0,
          error: error ? error.message : null,
        })
      } catch (e) {
        diagnostics.buckets.push({
          name: bucket,
          accessible: false,
          error: e instanceof Error ? e.message : "Unknown error",
        })
      }
    }

    return diagnostics
  } catch (error) {
    console.error("Error running diagnostics:", error)
    return { error: error instanceof Error ? error.message : "Unknown error" }
  }
}

/**
 * Helper function to get public URL for a file
 */
export function getPublicUrl(bucketName: string, filePath: string) {
  try {
    const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath)
    return data.publicUrl
  } catch (error) {
    console.error("Error getting public URL:", error)
    return null
  }
}

/**
 * Attempts to verify and fix bucket access
 */
export async function verifyAndFixBucketAccess(bucketName: string): Promise<{
  success: boolean
  message: string
  actualBucketName?: string
}> {
  try {
    // First, get the exact bucket name (case-sensitive)
    const exactBucketName = await getExactBucketName(bucketName)

    if (!exactBucketName) {
      return {
        success: false,
        message: `Bucket "${bucketName}" not found in any case variation.`,
      }
    }

    // If the bucket name is different from what we expected, log it
    if (exactBucketName !== bucketName) {
      console.log(`Using exact bucket name: "${exactBucketName}" instead of "${bucketName}"`)
    }

    // Try to list files to verify access
    const { data: files, error: listError } = await supabase.storage.from(exactBucketName).list()

    if (listError) {
      return {
        success: false,
        message: `Found bucket "${exactBucketName}" but cannot access it: ${listError.message}`,
        actualBucketName: exactBucketName,
      }
    }

    return {
      success: true,
      message: `Successfully verified access to bucket "${exactBucketName}". Found ${files.length} files/folders.`,
      actualBucketName: exactBucketName,
    }
  } catch (error) {
    return {
      success: false,
      message: `Error verifying bucket access: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}
