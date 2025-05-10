interface ApplicationData {
  businessName: string
  creditScore: number
  avgDailyBalance: number
  avgMonthlyRevenue: number
  hasExistingLoans: boolean
  hasPriorDefaults?: boolean
  negativeDays?: number
  timeInBusiness: number // in months
  state: string
  industry: string
  fundingRequested: number
  fundingPurpose?: string
}

export async function submitToLender(
  lender: any,
  applicationData: ApplicationData,
  uploadedFiles?: {
    bankStatements: File[]
    application: File | null
  },
) {
  try {
    // Format the email subject
    const subject = `New Deal - ${applicationData.businessName} ($${applicationData.fundingRequested.toLocaleString()})`

    // Format the email body
    const body = generateEmailBody(lender, applicationData, uploadedFiles)

    // In a real application, you would send the email via an API
    // For demo purposes, we'll open the default email client
    const ccParam = lender.cc_email ? `&cc=${encodeURIComponent(lender.cc_email)}` : ""

    // Create mailto link
    const mailtoLink = `mailto:${lender.email}?subject=${encodeURIComponent(subject)}${ccParam}&body=${encodeURIComponent(body)}`

    // Open the email client
    window.open(mailtoLink, "_blank")

    return true
  } catch (error) {
    console.error("Error submitting to lender:", error)
    throw error
  }
}

function generateEmailBody(
  lender: any,
  applicationData: ApplicationData,
  uploadedFiles?: {
    bankStatements: File[]
    application: File | null
  },
): string {
  // Format time in business
  const years = Math.floor(applicationData.timeInBusiness / 12)
  const months = applicationData.timeInBusiness % 12
  const timeInBusinessStr =
    years > 0
      ? `${years} year${years !== 1 ? "s" : ""}${months > 0 ? `, ${months} month${months !== 1 ? "s" : ""}` : ""}`
      : `${months} month${months !== 1 ? "s" : ""}`

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Generate file attachment information
  let attachmentInfo = ""
  if (uploadedFiles) {
    const totalFiles = (uploadedFiles.application ? 1 : 0) + uploadedFiles.bankStatements.length

    if (totalFiles > 0) {
      attachmentInfo = `\n\nAttachments (${totalFiles}):\n`

      if (uploadedFiles.application) {
        attachmentInfo += `- Application: ${uploadedFiles.application.name}\n`
      }

      if (uploadedFiles.bankStatements.length > 0) {
        attachmentInfo += `- Bank Statements (${uploadedFiles.bankStatements.length}):\n`
        uploadedFiles.bankStatements.forEach((file, index) => {
          attachmentInfo += `  ${index + 1}. ${file.name}\n`
        })
      }

      attachmentInfo += "\nNote: The attachments will be sent separately or are available upon request.\n"
    }
  }

  // Generate email body
  return `Dear ${lender.name},

I'm pleased to submit a new deal opportunity for your review from Break Bread Business Group.

Business Details:
- Business Name: ${applicationData.businessName}
- Industry: ${applicationData.industry}
- Location: ${applicationData.state}
- Time in Business: ${timeInBusinessStr}
- Credit Score: ${applicationData.creditScore}

Financial Information:
- Average Monthly Revenue: ${formatCurrency(applicationData.avgMonthlyRevenue)}
- Average Daily Balance: ${formatCurrency(applicationData.avgDailyBalance)}
- Existing Loans: ${applicationData.hasExistingLoans ? "Yes" : "No"}
${applicationData.hasPriorDefaults !== undefined ? `- Prior Defaults: ${applicationData.hasPriorDefaults ? "Yes" : "No"}` : ""}
${applicationData.negativeDays !== undefined ? `- Negative Days: ${applicationData.negativeDays}` : ""}
- Funding Requested: ${formatCurrency(applicationData.fundingRequested)}
${applicationData.fundingPurpose ? `- Funding Purpose: ${applicationData.fundingPurpose}` : ""}

This deal is an excellent match for your criteria:
${lender.matchReasons.map((reason: string) => `- ${reason}`).join("\n")}

Based on our analysis, this business demonstrates strong financial health and growth potential. The requested funding aligns perfectly with your lending parameters, making it an ideal opportunity for your portfolio.${attachmentInfo}

Please let me know if you need any additional information or documentation to proceed with this application.

Thank you for your consideration.

Best regards,
Break Bread Business Group
`
}
