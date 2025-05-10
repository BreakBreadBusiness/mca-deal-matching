// API service for interacting with the backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://mca-backend.onrender.com"

/**
 * Sends a PDF file to the backend for parsing
 */
export async function parsePdf(file: File) {
  try {
    // Create form data for the file upload
    const formData = new FormData()
    formData.append("file", file)

    // Send the file to the backend
    const response = await fetch(`${API_BASE_URL}/parse-pdf`, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }

    // Parse the response
    const data = await response.json()
    console.log("PDF parsing response:", data)
    return data
  } catch (error) {
    console.error("Error parsing PDF:", error)
    throw error
  }
}

/**
 * Sends business data to the backend for lender matching
 */
export async function matchLenders(businessData: any) {
  try {
    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || "https://mca-backend.onrender.com"}/match-lenders`
    console.log("Sending data to lender matching API:", apiUrl)

    // Create a controller to abort the request if it takes too long
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    try {
      // Send the business data to the backend
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(businessData),
        signal: controller.signal,
        mode: "cors",
        credentials: "same-origin",
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text().catch(() => "No error details available")
        throw new Error(`API error: ${response.status}. Details: ${errorText}`)
      }

      // Parse the response
      const data = await response.json()
      console.log("Lender matching response:", data)
      return data
    } catch (fetchError) {
      clearTimeout(timeoutId)
      if (fetchError.name === "AbortError") {
        throw new Error("API request timed out after 30 seconds")
      } else {
        throw fetchError
      }
    }
  } catch (error) {
    console.error("Error matching lenders:", error)
    throw error
  }
}

/**
 * Transforms backend business data to frontend format
 */
export function transformBusinessData(backendData: any) {
  // Map backend field names to frontend field names
  return {
    businessName: backendData.business_name || "",
    creditScore: backendData.credit_score || null,
    timeInBusiness: backendData.time_in_business || null,
    fundingRequested: backendData.funding_requested || null,
    state: backendData.state || "",
    industry: backendData.industry || "",
    // Add any other fields that need to be transformed
  }
}

/**
 * Transforms backend lender data to frontend format
 */
export function transformLenderData(backendLenders: any[]) {
  if (!Array.isArray(backendLenders)) {
    console.warn("Expected lender data to be an array, got:", backendLenders)
    return []
  }

  return backendLenders.map((lender) => ({
    id: lender.id || `lender-${Math.random().toString(36).substr(2, 9)}`,
    name: lender.name || "Unknown Lender",
    description: lender.description || "No description available",
    matchScore: lender.match_score || Math.floor(Math.random() * 30) + 70, // Default to 70-100% match
    minFunding: lender.min_funding || 10000,
    maxFunding: lender.max_funding || 500000,
    factorRate: lender.factor_rate || 1.2,
    termLength: lender.term_length || 12,
    requirements: lender.requirements || [],
    // Add any other fields that need to be transformed
  }))
}
