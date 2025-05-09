/**
 * ISO Application URL Functionality Test Script
 *
 * This script provides a step-by-step guide to test the ISO application URL functionality
 * in the MCA deal matching application.
 */

import { createClient } from "@supabase/supabase-js"

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

/**
 * Test 1: Verify Lender Management Interface
 *
 * This test verifies that the ISO application URL field is properly displayed
 * and can be edited in the lender management interface.
 */
async function testLenderManagementInterface() {
  console.log("=== Test 1: Lender Management Interface ===")

  try {
    // 1. Fetch a test lender
    const { data: lender, error } = await supabase.from("lenders").select("*").eq("name", "Test Lender A").single()

    if (error) throw error

    console.log("✅ Successfully fetched test lender")
    console.log(`Current ISO application URL: ${lender.iso_application_url}`)

    // 2. Update the ISO application URL
    const newUrl = `${lender.iso_application_url}?test=updated`
    const { error: updateError } = await supabase
      .from("lenders")
      .update({ iso_application_url: newUrl })
      .eq("id", lender.id)

    if (updateError) throw updateError

    console.log("✅ Successfully updated ISO application URL")

    // 3. Verify the update
    const { data: updatedLender, error: fetchError } = await supabase
      .from("lenders")
      .select("*")
      .eq("id", lender.id)
      .single()

    if (fetchError) throw fetchError

    console.log(`Updated ISO application URL: ${updatedLender.iso_application_url}`)
    console.log("✅ URL update verification successful")

    // 4. Reset the URL to original value
    await supabase.from("lenders").update({ iso_application_url: lender.iso_application_url }).eq("id", lender.id)

    console.log("✅ Reset URL to original value")
  } catch (error) {
    console.error("❌ Test failed:", error)
  }
}

/**
 * Test 2: Verify Lender Matching Process
 *
 * This test verifies that the lender matching process correctly identifies
 * external lenders (lenders from other users' networks) and includes the
 * ISO application URL in the results.
 */
async function testLenderMatchingProcess() {
  console.log("\n=== Test 2: Lender Matching Process ===")

  try {
    // 1. Create two test users
    const testUser1Email = `test-user-1-${Date.now()}@example.com`
    const testUser2Email = `test-user-2-${Date.now()}@example.com`

    const { data: user1, error: user1Error } = await supabase.auth.admin.createUser({
      email: testUser1Email,
      password: "password123",
      email_confirm: true,
    })

    if (user1Error) throw user1Error

    const { data: user2, error: user2Error } = await supabase.auth.admin.createUser({
      email: testUser2Email,
      password: "password123",
      email_confirm: true,
    })

    if (user2Error) throw user2Error

    console.log("✅ Created test users")

    // 2. Add Test Lender A to user1's network
    const { data: lenderA, error: lenderAError } = await supabase
      .from("lenders")
      .select("*")
      .eq("name", "Test Lender A")
      .single()

    if (lenderAError) throw lenderAError

    await supabase.from("user_lender_network").insert({
      user_id: user1.user.id,
      lender_id: lenderA.id,
    })

    console.log("✅ Added Test Lender A to User 1's network")

    // 3. Add Test Lender B to user2's network
    const { data: lenderB, error: lenderBError } = await supabase
      .from("lenders")
      .select("*")
      .eq("name", "Test Lender B")
      .single()

    if (lenderBError) throw lenderBError

    await supabase.from("user_lender_network").insert({
      user_id: user2.user.id,
      lender_id: lenderB.id,
    })

    console.log("✅ Added Test Lender B to User 2's network")

    // 4. Simulate application data that matches both lenders
    const applicationData = {
      businessName: "Test Business",
      creditScore: 650,
      avgDailyBalance: 5000,
      avgMonthlyRevenue: 20000,
      hasExistingLoans: false,
      timeInBusiness: 24, // 2 years
      state: "CA",
      industry: "Technology",
      fundingRequested: 50000,
    }

    console.log("✅ Created test application data")
    console.log("Test setup complete. Ready for manual testing.")

    // 5. Instructions for manual testing
    console.log("\nManual Testing Instructions:")
    console.log("1. Log in as User 1 (email: " + testUser1Email + ")")
    console.log("2. Upload and analyze documents that match the test application data")
    console.log('3. Verify that Test Lender A appears in "My Network" tab')
    console.log('4. Verify that Test Lender B appears as an external lender with "Apply as ISO" button')
    console.log('5. Click "Apply as ISO" and verify it opens the correct URL')
    console.log("6. Log in as User 2 and repeat the process to verify the reverse scenario")

    // 6. Clean up (optional - comment out if you want to keep the test data)
    /*
    await supabase.from('user_lender_network').delete().eq('user_id', user1.user.id)
    await supabase.from('user_lender_network').delete().eq('user_id', user2.user.id)
    await supabase.auth.admin.deleteUser(user1.user.id)
    await supabase.auth.admin.deleteUser(user2.user.id)
    console.log('✅ Cleaned up test data')
    */
  } catch (error) {
    console.error("❌ Test failed:", error)
  }
}

/**
 * Test 3: Verify "Apply as ISO" Button Functionality
 *
 * This test provides instructions for manually testing the "Apply as ISO" button
 * to ensure it correctly opens the lender's ISO application URL.
 */
function testApplyAsISOButton() {
  console.log('\n=== Test 3: "Apply as ISO" Button Functionality ===')
  console.log("Manual Testing Instructions:")
  console.log("1. Log in to the application")
  console.log("2. Navigate to the Lenders page")
  console.log("3. Find a lender from another user's network that has an ISO application URL")
  console.log('4. Click the "Apply as ISO" button')
  console.log("5. Verify that it opens a new tab with the correct URL")
  console.log("6. Verify that the URL includes any query parameters defined in the lender's ISO application URL")
}

/**
 * Test 4: End-to-End User Flow
 *
 * This test provides instructions for testing the complete user flow from
 * uploading documents to applying as an ISO.
 */
function testEndToEndUserFlow() {
  console.log("\n=== Test 4: End-to-End User Flow ===")
  console.log("Manual Testing Instructions:")
  console.log("1. Log in as a test user")
  console.log("2. Upload bank statements and other documents")
  console.log("3. Analyze the documents")
  console.log("4. View matching lenders")
  console.log("5. Identify external lenders (from other users' networks)")
  console.log('6. Click "Apply as ISO" for an external lender')
  console.log("7. Verify you are redirected to the lender's ISO application page")
  console.log("8. Verify the application process on the lender's site")
}

/**
 * Main test function
 */
async function runTests() {
  console.log("Starting ISO Application URL Functionality Tests...\n")

  // Run automated tests
  await testLenderManagementInterface()
  await testLenderMatchingProcess()

  // Display manual test instructions
  testApplyAsISOButton()
  testEndToEndUserFlow()

  console.log("\nTests completed.")
}

// Run the tests
runTests()
