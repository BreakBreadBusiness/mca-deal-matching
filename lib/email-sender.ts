// This is a simplified version of the email sender that will work for testing
// The full implementation would include actual email sending logic

interface Lender {
  id: string
  name: string
  email?: string
  product_type?: string
  matchReasons?: string[]
  [key: string]: any
}

interface ApplicationData {
  businessName: string
  ownerName?: string
  creditScore: number
  timeInBusiness: number
  state: string
  industry: string
  avgMonthlyRevenue: number
  avgDailyBalance: number
  fundingRequested: number
  [key: string]: any
}

interface FileAttachments {
  bankStatements: File[]
  application: File | null
}

export async function submitToLender(
  lender: Lender,
  applicationData: ApplicationData,
  uploadedFiles: { bankStatements: File[]; application: File },
): Promise<void> {
  console.log("Submitting to lender:", lender.name)
  console.log("Application data:", applicationData)
  console.log("Attachments:", {
    bankStatements: uploadedFiles.bankStatements.map((file) => file.name),
    application: uploadedFiles.application?.name,
  })

  // Generate email body
  const emailBody = generateEmailBody(lender, applicationData)

  // In a real implementation, we would send an email with attachments
  // For now, we'll just simulate a successful submission
  await new Promise((resolve) => setTimeout(resolve, 1000))

  console.log("Email body:", emailBody)
  console.log("Submission successful")
}

function generateEmailBody(lender: Lender, applicationData: ApplicationData): string {
  const lenderName = lender.name || "Lender"
  const businessName = applicationData.businessName
  const state = applicationData.state
  const timeInBusinessYears = Math.floor(applicationData.timeInBusiness / 12)
  const timeInBusinessMonths = applicationData.timeInBusiness % 12
  const timeInBusinessText =
    timeInBusinessYears > 0
      ? `${timeInBusinessYears} years${timeInBusinessMonths > 0 ? `, ${timeInBusinessMonths} months` : ""}`
      : `${timeInBusinessMonths} months`
  const monthlyRevenue = formatCurrency(applicationData.avgMonthlyRevenue)
  const avgDailyBalance = formatCurrency(applicationData.avgDailyBalance)
  const fundingRequested = formatCurrency(applicationData.fundingRequested)

  // Create match reasons section if available
  let matchReasonsSection = ""
  if (lender.matchReasons && Array.isArray(lender.matchReasons) && lender.matchReasons.length > 0) {
    matchReasonsSection = `\n\nThe client aligns well with your underwriting criteria based on:\n${lender.matchReasons
      .map((reason: string) => `- ${reason}`)
      .join("\n")}`
  } else {
    // Default match reasons if none provided
    matchReasonsSection = `\n\nThe client aligns well with your underwriting criteria based on:
- Business in approved industry (${applicationData.industry})
- Sufficient time in business (${timeInBusinessText})
- Strong monthly revenue (${monthlyRevenue})
- Good average daily balance (${avgDailyBalance})`
  }

  return `Subject: MCA Submission – ${businessName}

Hello ${lenderName},

Please see the attached MCA application and recent bank statements for ${businessName}, located in ${state}. The business has been operating for ${timeInBusinessText}, is currently doing ${monthlyRevenue} in monthly deposits, and maintains a strong average daily balance of ${avgDailyBalance}.

The client is seeking ${fundingRequested} in funding.${matchReasonsSection}

Let me know if you need anything further to move this forward.

Best regards,
Your Name / Company`
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount)
}
