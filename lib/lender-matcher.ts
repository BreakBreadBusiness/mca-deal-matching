// This is a simplified version of the lender matcher that will work for testing
// The full implementation would include more complex matching logic

interface Lender {
  id: string
  name: string
  product_type: string
  min_credit_score: number
  min_time_in_business: number
  min_monthly_revenue: number
  max_existing_mcas: number
  allowed_states: string[]
  allowed_industries: string[]
  description?: string
  matchReasons?: string[]
}

interface AnalysisResult {
  businessName: string
  creditScore: number
  timeInBusiness: number
  state: string
  industry: string
  avgMonthlyRevenue: number
  existingMcaCount?: number
  [key: string]: any
}

// Sample lenders for testing
const SAMPLE_LENDERS: Lender[] = [
  {
    id: "1",
    name: "Capital Funding Partners",
    product_type: "MCA",
    min_credit_score: 550,
    min_time_in_business: 6,
    min_monthly_revenue: 25000,
    max_existing_mcas: 2,
    allowed_states: ["CA", "NY", "FL", "TX", "IL", "PA", "OH", "GA", "NC", "MI"],
    allowed_industries: ["Retail", "Restaurant", "Healthcare", "Construction", "Manufacturing", "Transportation"],
    description: "Fast funding with flexible terms",
  },
  {
    id: "2",
    name: "Business Growth Capital",
    product_type: "Term Loan",
    min_credit_score: 650,
    min_time_in_business: 12,
    min_monthly_revenue: 50000,
    max_existing_mcas: 1,
    allowed_states: ["CA", "NY", "FL", "TX", "IL", "PA", "OH", "GA", "NC", "MI", "AZ", "WA", "CO", "NJ", "VA"],
    allowed_industries: [
      "Retail",
      "Restaurant",
      "Healthcare",
      "Technology",
      "Professional Services",
      "Manufacturing",
      "Finance",
    ],
    description: "Lower rates for established businesses",
  },
  {
    id: "3",
    name: "Express Funding Solutions",
    product_type: "MCA",
    min_credit_score: 500,
    min_time_in_business: 3,
    min_monthly_revenue: 15000,
    max_existing_mcas: 3,
    allowed_states: ["ALL"],
    allowed_industries: ["ALL"],
    description: "Funding for businesses with less than perfect credit",
  },
  {
    id: "4",
    name: "Industry Specific Funding",
    product_type: "Revenue Based Financing",
    min_credit_score: 600,
    min_time_in_business: 12,
    min_monthly_revenue: 30000,
    max_existing_mcas: 1,
    allowed_states: ["CA", "NY", "FL", "TX", "IL", "PA"],
    allowed_industries: ["Technology", "Healthcare", "Professional Services"],
    description: "Specialized funding for high-growth industries",
  },
]

export async function findMatchingLenders(applicationData: AnalysisResult): Promise<Lender[]> {
  console.log("Finding matching lenders for:", applicationData)

  // In a real implementation, we would fetch lenders from a database
  // For now, we'll use our sample lenders
  const allLenders = SAMPLE_LENDERS

  // Filter lenders based on criteria
  const matchingLenders = allLenders.filter((lender) => {
    // Check credit score
    if (applicationData.creditScore < lender.min_credit_score) {
      return false
    }

    // Check time in business
    if (applicationData.timeInBusiness < lender.min_time_in_business) {
      return false
    }

    // Check monthly revenue
    if (applicationData.avgMonthlyRevenue < lender.min_monthly_revenue) {
      return false
    }

    // Check existing MCAs
    const existingMcaCount = applicationData.existingMcaCount || 0
    if (existingMcaCount > lender.max_existing_mcas) {
      return false
    }

    // Check state
    if (lender.allowed_states[0] !== "ALL" && !lender.allowed_states.includes(applicationData.state)) {
      return false
    }

    // Check industry
    if (lender.allowed_industries[0] !== "ALL" && !lender.allowed_industries.includes(applicationData.industry)) {
      return false
    }

    return true
  })

  // Add match reasons to each lender
  return matchingLenders.map((lender) => {
    const matchReasons = [
      `Meets ${lender.product_type} criteria`,
      `Credit score ${applicationData.creditScore} exceeds minimum ${lender.min_credit_score}`,
      `Business in approved industry (${applicationData.industry})`,
      `Sufficient time in business (${Math.floor(applicationData.timeInBusiness / 12)} years, ${
        applicationData.timeInBusiness % 12
      } months)`,
      `Strong monthly revenue ($${applicationData.avgMonthlyRevenue.toLocaleString()})`,
    ]

    return {
      ...lender,
      matchReasons,
    }
  })
}
import { createClient } from "@supabase/supabase-js"

// Create a Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function matchLendersToApplication(application: any, userId?: string) {
  try {
    // Fetch lenders from the database
    let query = supabase.from("lenders").select("*")

    // If userId is provided, filter lenders by user_id
    if (userId) {
      query = query.eq("user_id", userId)
    }

    const { data: lenders, error } = await query

    if (error) {
      console.error("Error fetching lenders:", error)
      throw new Error("Failed to fetch lenders")
    }

    // Match lenders to the application
    const matches = lenders.map((lender) => {
      const matchScore = calculateMatchScore(application, lender)
      const { matchReasons, mismatchReasons } = getMatchReasons(application, lender)

      return {
        ...lender,
        match_score: matchScore,
        match_reasons: matchReasons,
        mismatch_reasons: mismatchReasons,
        isMatch: matchScore >= 40, // Consider it a match if score is at least 40%
      }
    })

    // Sort matches by score (highest first)
    return matches.sort((a, b) => b.match_score - a.match_score)
  } catch (error) {
    console.error("Error matching lenders:", error)
    throw error
  }
}

// For backward compatibility, export the old function name as well
// export const findMatchingLenders = matchLendersToApplication

function calculateMatchScore(application: any, lender: any) {
  let score = 0
  let totalCriteria = 0

  // Credit score check
  if (lender.criteria?.min_credit_score && lender.criteria?.max_credit_score) {
    totalCriteria++
    if (
      application.creditScore >= lender.criteria.min_credit_score &&
      application.creditScore <= lender.criteria.max_credit_score
    ) {
      score++
    }
  } else if (lender.criteria?.min_credit_score) {
    totalCriteria++
    if (application.creditScore >= lender.criteria.min_credit_score) {
      score++
    }
  }

  // Monthly revenue check
  if (lender.criteria?.min_monthly_revenue && lender.criteria?.max_monthly_revenue) {
    totalCriteria++
    if (
      application.avgMonthlyRevenue >= lender.criteria.min_monthly_revenue &&
      application.avgMonthlyRevenue <= lender.criteria.max_monthly_revenue
    ) {
      score++
    }
  } else if (lender.criteria?.min_monthly_revenue) {
    totalCriteria++
    if (application.avgMonthlyRevenue >= lender.criteria.min_monthly_revenue) {
      score++
    }
  }

  // Funding amount check
  if (lender.criteria?.min_funding_amount && lender.criteria?.max_funding_amount) {
    totalCriteria++
    if (
      application.fundingRequested >= lender.criteria.min_funding_amount &&
      application.fundingRequested <= lender.criteria.max_funding_amount
    ) {
      score++
    }
  }

  // Time in business check
  if (lender.criteria?.min_time_in_business) {
    totalCriteria++
    if (application.timeInBusiness >= lender.criteria.min_time_in_business) {
      score++
    }
  }

  // Existing loans check
  if (lender.criteria?.accepts_existing_loans !== undefined) {
    totalCriteria++
    if (!application.hasExistingLoans || lender.criteria.accepts_existing_loans) {
      score++
    }
  }

  // State check
  if (lender.criteria?.states && lender.criteria.states.length > 0) {
    totalCriteria++
    if (lender.criteria.states.includes(application.state)) {
      score++
    }
  }

  // Industry check
  if (lender.criteria?.industries && lender.criteria.industries.length > 0) {
    totalCriteria++
    if (lender.criteria.industries.includes(application.industry)) {
      score++
    }
  }

  // Calculate percentage score
  return totalCriteria > 0 ? Math.round((score / totalCriteria) * 100) : 0
}

function getMatchReasons(application: any, lender: any) {
  const matchReasons = []
  const mismatchReasons = []

  // Credit score check
  if (lender.criteria?.min_credit_score && lender.criteria?.max_credit_score) {
    if (
      application.creditScore >= lender.criteria.min_credit_score &&
      application.creditScore <= lender.criteria.max_credit_score
    ) {
      matchReasons.push(
        `Credit score (${application.creditScore}) is within range (${lender.criteria.min_credit_score}-${lender.criteria.max_credit_score})`,
      )
    } else {
      mismatchReasons.push(
        `Credit score (${application.creditScore}) is outside range (${lender.criteria.min_credit_score}-${lender.criteria.max_credit_score})`,
      )
    }
  } else if (lender.criteria?.min_credit_score) {
    if (application.creditScore >= lender.criteria.min_credit_score) {
      matchReasons.push(`Credit score (${application.creditScore}) meets minimum (${lender.criteria.min_credit_score})`)
    } else {
      mismatchReasons.push(
        `Credit score (${application.creditScore}) below minimum (${lender.criteria.min_credit_score})`,
      )
    }
  }

  // Monthly revenue check
  if (lender.criteria?.min_monthly_revenue && lender.criteria?.max_monthly_revenue) {
    if (
      application.avgMonthlyRevenue >= lender.criteria.min_monthly_revenue &&
      application.avgMonthlyRevenue <= lender.criteria.max_monthly_revenue
    ) {
      matchReasons.push(
        `Monthly revenue ($${application.avgMonthlyRevenue.toLocaleString()}) is within range ($${lender.criteria.min_monthly_revenue.toLocaleString()}-$${lender.criteria.max_monthly_revenue.toLocaleString()})`,
      )
    } else {
      mismatchReasons.push(
        `Monthly revenue ($${application.avgMonthlyRevenue.toLocaleString()}) is outside range ($${lender.criteria.min_monthly_revenue.toLocaleString()}-$${lender.criteria.max_monthly_revenue.toLocaleString()})`,
      )
    }
  } else if (lender.criteria?.min_monthly_revenue) {
    if (application.avgMonthlyRevenue >= lender.criteria.min_monthly_revenue) {
      matchReasons.push(
        `Monthly revenue ($${application.avgMonthlyRevenue.toLocaleString()}) meets minimum ($${lender.criteria.min_monthly_revenue.toLocaleString()})`,
      )
    } else {
      mismatchReasons.push(
        `Monthly revenue ($${application.avgMonthlyRevenue.toLocaleString()}) below minimum ($${lender.criteria.min_monthly_revenue.toLocaleString()})`,
      )
    }
  }

  // Funding amount check
  if (lender.criteria?.min_funding_amount && lender.criteria?.max_funding_amount) {
    if (
      application.fundingRequested >= lender.criteria.min_funding_amount &&
      application.fundingRequested <= lender.criteria.max_funding_amount
    ) {
      matchReasons.push(
        `Funding amount ($${application.fundingRequested.toLocaleString()}) is within range ($${lender.criteria.min_funding_amount.toLocaleString()}-$${lender.criteria.max_funding_amount.toLocaleString()})`,
      )
    } else {
      mismatchReasons.push(
        `Funding amount ($${application.fundingRequested.toLocaleString()}) is outside range ($${lender.criteria.min_funding_amount.toLocaleString()}-$${lender.criteria.max_funding_amount.toLocaleString()})`,
      )
    }
  }

  // Time in business check
  if (lender.criteria?.min_time_in_business) {
    if (application.timeInBusiness >= lender.criteria.min_time_in_business) {
      matchReasons.push(
        `Time in business (${application.timeInBusiness} months) meets minimum (${lender.criteria.min_time_in_business} months)`,
      )
    } else {
      mismatchReasons.push(
        `Time in business (${application.timeInBusiness} months) below minimum (${lender.criteria.min_time_in_business} months)`,
      )
    }
  }

  // Existing loans check
  if (lender.criteria?.accepts_existing_loans !== undefined) {
    if (!application.hasExistingLoans || lender.criteria.accepts_existing_loans) {
      matchReasons.push(
        application.hasExistingLoans ? "Lender accepts businesses with existing loans" : "No existing loans",
      )
    } else {
      mismatchReasons.push("Lender does not accept businesses with existing loans")
    }
  }

  // State check
  if (lender.criteria?.states && lender.criteria.states.length > 0) {
    if (lender.criteria.states.includes(application.state)) {
      matchReasons.push(`Business state (${application.state}) is supported`)
    } else {
      mismatchReasons.push(`Business state (${application.state}) is not supported`)
    }
  }

  // Industry check
  if (lender.criteria?.industries && lender.criteria.industries.length > 0) {
    if (lender.criteria.industries.includes(application.industry)) {
      matchReasons.push(`Industry (${application.industry}) is supported`)
    } else {
      mismatchReasons.push(`Industry (${application.industry}) is not supported`)
    }
  }

  return { matchReasons, mismatchReasons }
}
