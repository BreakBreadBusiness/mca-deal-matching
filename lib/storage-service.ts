import { supabase, listAllBuckets, verifyAndFixBucketAccess } from "@/lib/supabase-client"

// Interface for upload result
interface UploadResult {
  success: boolean
  url?: string
  storageType: "supabase" | "local" | "none"
  error?: string
  bucketUsed?: string
}

/**
 * Uploads a file to storage with fallback mechanisms
 * First tries Supabase, then falls back to local storage if Supabase fails
 */
export async function uploadFile(
  file: File,
  bucketName = "applications",
  folderPath = "client_uploads",
): Promise<UploadResult> {
  console.log(`Attempting to upload file: ${file.name} (${file.size} bytes)`)

  // First try Supabase storage
  try {
    const supabaseResult = await uploadToSupabase(file, bucketName, folderPath)
    if (supabaseResult.success) {
      return supabaseResult
    }

    console.log("Supabase upload failed, falling back to local storage:", supabaseResult.error)

    // If Supabase fails, try local storage
    const localResult = await uploadToLocalStorage(file)
    return localResult
  } catch (error) {
    console.error("Error in upload process:", error)

    // Last resort fallback to local storage
    try {
      const localResult = await uploadToLocalStorage(file)
      return localResult
    } catch (localError) {
      return {
        success: false,
        storageType: "none",
        error: `All storage methods failed. Original error: ${error instanceof Error ? error.message : "Unknown error"}`,
      }
    }
  }
}

/**
 * Attempts to upload a file to Supabase storage
 * Tries multiple buckets if the primary bucket fails
 */
async function uploadToSupabase(
  file: File,
  preferredBucketName = "applications",
  folderPath = "client_uploads",
): Promise<UploadResult> {
  try {
    // First, try to verify and fix access to the preferred bucket
    const bucketCheck = await verifyAndFixBucketAccess(preferredBucketName)

    // Create a unique filename
    const timestamp = Date.now()
    const cleanFileName = file.name.replace(/\s+/g, "_")
    const filePath = `${folderPath}/${timestamp}_${cleanFileName}`

    // If we have access to the preferred bucket, use it
    if (bucketCheck.success && bucketCheck.actualBucketName) {
      console.log(`Uploading to verified bucket: ${bucketCheck.actualBucketName}`)

      const { data, error } = await supabase.storage.from(bucketCheck.actualBucketName).upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      })

      if (!error) {
        const { data: urlData } = supabase.storage.from(bucketCheck.actualBucketName).getPublicUrl(data.path)

        return {
          success: true,
          url: urlData.publicUrl,
          storageType: "supabase",
          bucketUsed: bucketCheck.actualBucketName,
        }
      }

      console.warn(`Failed to upload to bucket "${bucketCheck.actualBucketName}":`, error.message)
    } else {
      console.warn(`Could not access preferred bucket: ${bucketCheck.message}`)
    }

    // Get all available buckets as fallback
    const buckets = await listAllBuckets()
    console.log("Available buckets for fallback:", buckets)

    if (buckets.length === 0) {
      return {
        success: false,
        storageType: "supabase",
        error: "No storage buckets available",
      }
    }

    // Try each bucket until one works
    for (const bucket of buckets) {
      // Skip if it's the same as the one we already tried
      if (bucket === bucketCheck.actualBucketName) continue

      console.log(`Trying fallback bucket: ${bucket}`)

      const { data, error } = await supabase.storage.from(bucket).upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      })

      if (!error) {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path)

        console.log(`Successfully uploaded to fallback bucket: ${bucket}`)
        return {
          success: true,
          url: urlData.publicUrl,
          storageType: "supabase",
          bucketUsed: bucket,
        }
      }

      console.warn(`Failed to upload to fallback bucket "${bucket}":`, error.message)
    }

    // If we get here, all bucket attempts failed
    return {
      success: false,
      storageType: "supabase",
      error: "Failed to upload to any available bucket",
    }
  } catch (error) {
    console.error("Supabase upload error:", error)
    return {
      success: false,
      storageType: "supabase",
      error: error instanceof Error ? error.message : "Unknown Supabase error",
    }
  }
}

/**
 * Fallback method to store files in browser's memory
 * Creates a blob URL that's valid for the current session
 */
async function uploadToLocalStorage(file: File): Promise<UploadResult> {
  try {
    // Create a blob URL for the file
    const blobUrl = URL.createObjectURL(file)

    console.log("Created local blob URL:", blobUrl)

    return {
      success: true,
      url: blobUrl,
      storageType: "local",
    }
  } catch (error) {
    console.error("Local storage error:", error)
    return {
      success: false,
      storageType: "local",
      error: error instanceof Error ? error.message : "Unknown local storage error",
    }
  }
}
