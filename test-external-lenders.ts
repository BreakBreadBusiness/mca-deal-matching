/**
 * Test script to verify external lenders functionality
 *
 * This script helps test how external lenders appear in the interface
 * with the new visual enhancements.
 */

import { createClient } from "@supabase/supabase-js"

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testExternalLenders() {
  try {
    console.log("Testing external lenders functionality...")

    // 1. Verify the dummy lenders exist
    const { data: externalLenders, error: lendersError } = await supabase
      .from("lenders")
      .select("*")
      .in("name", ["External Capital Group", "Blue Sky Funding", "Horizon Financial"])

    if (lendersError) throw lendersError

    console.log(`Found ${externalLenders.length} external lenders:`)
    externalLenders.forEach((lender) => {
      console.log(`- ${lender.name} (${lender.id})`)
      console.log(`  ISO Application URL: ${lender.iso_application_url}`)
    })

    // 2. Verify they have criteria
    for (const lender of externalLenders) {
      const { data: criteria, error: criteriaError } = await supabase
        .from("lender_criteria")
        .select("*")
        .eq("lender_id", lender.id)
        .single()

      if (criteriaError) {
        console.error(`Error fetching criteria for ${lender.name}:`, criteriaError)
        continue
      }

      console.log(`Criteria for ${lender.name}:`)
      console.log(`  Min Credit Score: ${criteria.min_credit_score}`)
      console.log(`  Min Monthly Revenue: $${criteria.min_monthly_revenue}`)
      console.log(`  Funding Range: $${criteria.min_funding_amount} - $${criteria.max_funding_amount}`)
    }

    // 3. Verify they're in another user's network
    const { data: networkEntries, error: networkError } = await supabase
      .from("user_lender_network")
      .select("user_id, lender_id")
      .in(
        "lender_id",
        externalLenders.map((l) => l.id),
      )

    if (networkError) throw networkError

    console.log("\nNetwork associations:")
    networkEntries.forEach((entry) => {
      const lender = externalLenders.find((l) => l.id === entry.lender_id)
      console.log(`- ${lender?.name} is in user ${entry.user_id}'s network`)
    })

    console.log("\nExternal lenders test completed successfully!")
  } catch (error) {
    console.error("Error testing external lenders:", error)
  }
}

// Run the test
testExternalLenders()
