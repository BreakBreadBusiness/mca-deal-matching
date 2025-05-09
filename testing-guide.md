# Testing External Lenders Functionality

This guide will help you test the new external lenders functionality with the visual enhancements we've implemented.

## What to Expect

When you log in and view lenders, you should now see three external lenders from another user's network:
- External Capital Group
- Blue Sky Funding
- Horizon Financial

These lenders should have distinct visual styling:
- Blue borders and headers (instead of amber/gold for your network lenders)
- "External" badges in the header
- Blue information banners explaining they're from another user's network
- "Apply as ISO" buttons that link to their ISO application URLs

## Testing Steps

1. **Log in to your account**

2. **Upload a bank statement or application data**
   - Use data that would match the criteria of these lenders:
   - Credit score: 580+
   - Monthly revenue: $12,000+
   - Funding amount: $5,000 - $300,000

3. **View the matching lenders**
   - The external lenders should appear with blue styling
   - They should be clearly distinguished from your network lenders

4. **Test the "Apply as ISO" button**
   - Click the button for an external lender
   - It should open the lender's ISO application URL in a new tab

5. **View lender details**
   - Click "View Details" on an external lender
   - The details dialog should show the external lender badge
   - It should include the blue information box explaining it's an external lender

6. **Try adding to network**
   - Click the star icon to add an external lender to your network
   - It should change from external (blue) to network (amber/gold) styling

## Troubleshooting

If you don't see the external lenders:
- Make sure you're logged in with a different user than the one we used to create the external lenders
- Check that your application data matches the lender criteria
- Verify the lenders exist in the database using the test script

If the styling doesn't appear correctly:
- Clear your browser cache
- Make sure you're using the latest version of the application
