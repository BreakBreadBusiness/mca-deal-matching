import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"

// Load environment variables
dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key for admin operations

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials. Please check your .env file.")
  process.exit(1)
}

// Create Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkAndCreateBuckets() {
  try {
    console.log("Checking Supabase storage buckets...")

    // List all buckets
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()

    if (listError) {
      console.error("Error listing buckets:", listError)
      return
    }

    console.log("Existing buckets:")
    buckets.forEach((bucket) => {
      console.log(`- ${bucket.name} (${bucket.public ? "public" : "private"})`)
    })

    // Check if applications bucket exists
    const applicationsBucket = buckets.find((bucket) => bucket.name === "applications")

    if (!applicationsBucket) {
      console.log('\nCreating "applications" bucket...')

      const { data, error: createError } = await supabase.storage.createBucket("applications", {
        public: true,
        fileSizeLimit: 20971520, // 20MB
      })

      if (createError) {
        console.error("Error creating applications bucket:", createError)
      } else {
        console.log("Applications bucket created successfully!")
      }
    } else {
      console.log("\nApplications bucket already exists.")

      // Update bucket to ensure it's public
      if (!applicationsBucket.public) {
        console.log("Updating applications bucket to be public...")

        const { error: updateError } = await supabase.storage.updateBucket("applications", {
          public: true,
          fileSizeLimit: 20971520, // 20MB
        })

        if (updateError) {
          console.error("Error updating applications bucket:", updateError)
        } else {
          console.log("Applications bucket updated to be public.")
        }
      }
    }

    // Check bucket policies
    console.log("\nChecking bucket policies...")

    const { data: policies, error: policiesError } = await supabase.storage.getBucket("applications")

    if (policiesError) {
      console.error("Error getting bucket policies:", policiesError)
    } else {
      console.log("Applications bucket policies:", policies)
    }
  } catch (error) {
    console.error("Unexpected error:", error)
  }
}

checkAndCreateBuckets()
