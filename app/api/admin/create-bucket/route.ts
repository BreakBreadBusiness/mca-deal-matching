import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    // This should only be accessible to administrators
    // You should add proper authentication checks here

    // Get the service role key from environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Missing Supabase credentials" }, { status: 500 })
    }

    // Create a Supabase client with the service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if the bucket already exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()

    if (listError) {
      return NextResponse.json({ error: `Error listing buckets: ${listError.message}` }, { status: 500 })
    }

    const bucketExists = buckets.some((bucket) => bucket.name === "applications")

    if (bucketExists) {
      return NextResponse.json({ message: "Bucket 'applications' already exists" })
    }

    // Create the bucket
    const { data, error: createError } = await supabase.storage.createBucket("applications", {
      public: true,
      fileSizeLimit: 20971520, // 20MB
    })

    if (createError) {
      return NextResponse.json({ error: `Error creating bucket: ${createError.message}` }, { status: 500 })
    }

    return NextResponse.json({
      message: "Bucket 'applications' created successfully",
      data,
    })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
