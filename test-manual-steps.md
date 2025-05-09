# ISO Application URL Functionality - Manual Testing Guide

This guide provides step-by-step instructions for manually testing the ISO application URL functionality in the MCA deal matching application.

## Prerequisites

1. At least two test user accounts
2. Test lenders with ISO application URLs configured
3. Sample bank statements or application data

## Test Scenario 1: Lender Management Interface

### Steps:

1. Log in as an admin user
2. Navigate to the Lender Management page
3. Click "Add Lender" or edit an existing lender
4. Verify the ISO Application URL field is present
5. Enter a valid URL (e.g., https://example.com/apply-as-iso)
6. Save the lender
7. Edit the lender again to verify the URL was saved correctly

### Expected Results:

- The ISO Application URL field should be visible in the lender form
- The URL should be saved correctly
- The URL should be displayed in the lender details

## Test Scenario 2: Lender Matching with External Lenders

### Setup:

1. Create two test users (User A and User B)
2. Add Lender X to User A's network
3. Add Lender Y to User B's network
4. Ensure both lenders have ISO application URLs configured

### Steps:

1. Log in as User A
2. Upload and analyze documents that match both Lender X and Lender Y's criteria
3. Navigate to the Lenders page
4. View the matching lenders

### Expected Results:

- Lender X should appear in "My Network" tab
- Lender Y should appear as an external lender
- Lender Y should have an "Apply as ISO" button
- The "Apply as ISO" button should not appear for Lender X

## Test Scenario 3: Apply as ISO Button Functionality

### Steps:

1. Log in as User A
2. Navigate to the Lenders page
3. Find Lender Y (from User B's network)
4. Click the "Apply as ISO" button

### Expected Results:

- A new tab should open with Lender Y's ISO application URL
- The URL should be correctly formed with any query parameters

## Test Scenario 4: End-to-End User Flow

### Steps:

1. Log in as a new test user
2. Upload bank statements and other documents
3. Analyze the documents
4. View matching lenders
5. Identify external lenders (from other users' networks)
6. Click "Apply as ISO" for an external lender
7. Complete the application process on the lender's site (if possible)

### Expected Results:

- The entire flow should work smoothly
- The user should be able to apply as an ISO directly on the lender's site
- No admin intervention should be required

## Test Scenario 5: Edge Cases

### Test Cases:

1. **Missing URL**: Verify behavior when an external lender doesn't have an ISO application URL
2. **Invalid URL**: Test with an improperly formatted URL
3. **Network Changes**: Add a previously external lender to the user's network and verify the "Apply as ISO" button disappears
4. **Multiple Users**: Verify that multiple users can apply as ISO for the same lender

### Expected Results:

- The application should handle all edge cases gracefully
- Appropriate error messages or fallback behavior should be displayed
