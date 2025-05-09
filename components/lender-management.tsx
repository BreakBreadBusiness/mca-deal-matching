"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  Mail,
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Search,
  List,
  LayoutGrid,
  ChevronUp,
  ChevronDown,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/context/auth-context"
import {
  getLenders,
  createLender,
  updateLender,
  deleteLender,
  getLenderCriteria,
  createLenderCriteria,
  updateLenderCriteria,
} from "@/lib/lender-service"

// CSV import interface
interface CSVLenderData {
  name: string
  email: string
  cc_email?: string
  description?: string
  min_credit_score?: number
  max_credit_score?: number
  min_monthly_revenue?: number
  max_monthly_revenue?: number
  min_daily_balance?: number
  max_daily_balance?: number
  min_time_in_business?: number
  max_time_in_business?: number
  min_funding_amount?: number
  max_funding_amount?: number
  accepts_existing_loans?: boolean
  accepts_prior_defaults?: boolean
  max_negative_days?: number
  funds_first_position?: boolean
  excluded_states?: string
  excluded_industries?: string
}

type ViewMode = "card" | "list"
type SortField = "name" | "email" | "min_credit_score" | "min_monthly_revenue" | "min_funding_amount"
type SortDirection = "asc" | "desc"

export default function LenderManagement() {
  const [lenders, setLenders] = useState<any[]>([])
  const [filteredLenders, setFilteredLenders] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [currentLender, setCurrentLender] = useState<any>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCsvDialogOpen, setIsCsvDialogOpen] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadResults, setUploadResults] = useState<{
    total: number
    successful: number
    failed: number
    errors: string[]
  } | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("card")
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [isDeleting, setIsDeleting] = useState(false)
  const [lenderToDelete, setLenderToDelete] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const { user } = useAuth()

  // Define all US states and industries
  const ALL_US_STATES = [
    "AL",
    "AK",
    "AZ",
    "AR",
    "CA",
    "CO",
    "CT",
    "DE",
    "FL",
    "GA",
    "HI",
    "ID",
    "IL",
    "IN",
    "IA",
    "KS",
    "KY",
    "LA",
    "ME",
    "MD",
    "MA",
    "MI",
    "MN",
    "MS",
    "MO",
    "MT",
    "NE",
    "NV",
    "NH",
    "NJ",
    "NM",
    "NY",
    "NC",
    "ND",
    "OH",
    "OK",
    "OR",
    "PA",
    "RI",
    "SC",
    "SD",
    "TN",
    "TX",
    "UT",
    "VT",
    "VA",
    "WA",
    "WV",
    "WI",
    "WY",
  ]

  const ALL_INDUSTRIES = [
    "Restaurant",
    "Retail",
    "Healthcare",
    "Technology",
    "Construction",
    "Manufacturing",
    "Transportation",
    "Finance",
    "Real Estate",
    "Education",
    "Hospitality",
    "Entertainment",
    "Agriculture",
    "Energy",
    "Legal Services",
    "Cannabis",
    "CBD",
    "Adult Entertainment",
    "Adult Products",
    "Firearms",
    "Ammunition Sales",
    "Gambling",
    "Betting",
    "Casinos",
    "Loan Companies",
    "Financial Services Companies",
    "Cryptocurrency",
    "Forex Trading",
    "Nonprofits",
    "Religious Organizations",
    "Marijuana Paraphernalia",
    "Vape Shops",
    "Escort Services",
    "Dating Services",
    "Offshore Businesses",
    "Non-U.S. Entities",
    "Used Car Dealerships",
    "Trucking",
    "Logistics",
    "Bars",
    "Healthcare Practices",
  ]

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    cc_email: "",
    description: "",
    min_credit_score: 500,
    max_credit_score: 850,
    min_monthly_revenue: 10000,
    max_monthly_revenue: 1000000,
    min_daily_balance: 1000,
    max_daily_balance: 100000,
    min_time_in_business: 6, // 6 months
    max_time_in_business: 240, // 20 years
    min_funding_amount: 5000,
    max_funding_amount: 500000,
    accepts_prior_defaults: true,
    max_negative_days: 3,
    min_position: 1,
    max_position: 2,
    excluded_states: [] as string[],
    excluded_industries: [] as string[],
  })

  useEffect(() => {
    if (user) {
      fetchLenders()
    }
  }, [user])

  useEffect(() => {
    // Filter and sort lenders whenever search term, sort field, or sort direction changes
    try {
      filterAndSortLenders()
    } catch (err) {
      console.error("Error filtering lenders:", err)
      setError("Failed to filter lenders")
    }
  }, [searchTerm, lenders, sortField, sortDirection])

  const fetchLenders = async () => {
    if (!user?.id) {
      setError("User not authenticated")
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      // Pass the user ID to get only lenders for this user
      const data = await getLenders(user.id)
      console.log("Fetched lenders for user:", user.id, data)

      // Initialize with empty array if no lenders
      if (!data || !Array.isArray(data)) {
        setLenders([])
        setFilteredLenders([])
        setIsLoading(false)
        return
      }

      // Fetch criteria for each lender
      const lendersWithCriteria = await Promise.all(
        data.map(async (lender: any) => {
          try {
            const criteria = await getLenderCriteria(lender.id)

            // Handle case where criteria might be undefined or not an array
            const lenderCriteria = criteria && criteria.length > 0 ? criteria[0] : {}

            // If the lender has states defined in the old format, convert to excluded_states
            let excludedStates = lenderCriteria.excluded_states || []
            if (!lenderCriteria.excluded_states && lenderCriteria.states) {
              const includedStates = lenderCriteria.states || []
              excludedStates = ALL_US_STATES.filter((state) => !includedStates.includes(state))
            }

            // If the lender has industries defined in the old format, convert to excluded_industries
            let excludedIndustries = lenderCriteria.excluded_industries || []
            if (!lenderCriteria.excluded_industries && lenderCriteria.industries) {
              const includedIndustries = lenderCriteria.industries || []
              excludedIndustries = ALL_INDUSTRIES.filter((industry) => !includedIndustries.includes(industry))
            }

            return {
              ...lender,
              criteria: {
                ...lenderCriteria,
                excluded_states: excludedStates,
                excluded_industries: excludedIndustries,
              },
            }
          } catch (error) {
            console.error(`Error fetching criteria for lender ${lender.id}:`, error)
            // Return lender with empty criteria if there was an error
            return {
              ...lender,
              criteria: {},
            }
          }
        }),
      )

      setLenders(lendersWithCriteria)
      setFilteredLenders(lendersWithCriteria)
    } catch (error) {
      console.error("Error fetching lenders:", error)
      setError("Failed to fetch lenders. Please try again.")
      toast({
        title: "Error",
        description: "Failed to fetch lenders.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const filterAndSortLenders = () => {
    // Filter lenders based on search term
    let filtered = lenders
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase()
      filtered = lenders.filter(
        (lender) =>
          lender.name?.toLowerCase().includes(term) ||
          lender.email?.toLowerCase().includes(term) ||
          (lender.description && lender.description.toLowerCase().includes(term)),
      )
    }

    // Sort lenders based on sort field and direction
    filtered = [...filtered].sort((a, b) => {
      let valueA, valueB

      // Handle nested properties for criteria fields
      if (
        sortField === "min_credit_score" ||
        sortField === "min_monthly_revenue" ||
        sortField === "min_funding_amount"
      ) {
        valueA = a.criteria?.[sortField] || 0
        valueB = b.criteria?.[sortField] || 0
      } else {
        valueA = a[sortField] || ""
        valueB = b[sortField] || ""
      }

      // Handle string vs number comparison
      if (typeof valueA === "string" && typeof valueB === "string") {
        return sortDirection === "asc" ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA)
      } else {
        return sortDirection === "asc" ? valueA - valueB : valueB - valueA
      }
    })

    setFilteredLenders(filtered)
  }

  const handleSortChange = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      // Set new field and default to ascending
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }

  const clearSearch = () => {
    setSearchTerm("")
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleNumberInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value === "" ? "" : Number(value),
    }))
  }

  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      [name]: checked,
    }))
  }

  const handleStateChange = (state: string) => {
    setFormData((prev) => {
      const excludedStates = [...prev.excluded_states]
      const index = excludedStates.indexOf(state)

      if (index === -1) {
        excludedStates.push(state)
      } else {
        excludedStates.splice(index, 1)
      }

      return {
        ...prev,
        excluded_states: excludedStates,
      }
    })
  }

  const handleIndustryChange = (industry: string) => {
    setFormData((prev) => {
      const excludedIndustries = [...prev.excluded_industries]
      const index = excludedIndustries.indexOf(industry)

      if (index === -1) {
        excludedIndustries.push(industry)
      } else {
        excludedIndustries.splice(index, 1)
      }

      return {
        ...prev,
        excluded_industries: excludedIndustries,
      }
    })
  }

  const handleEditLender = (lender: any) => {
    try {
      setIsEditing(true)
      setCurrentLender(lender)

      // Convert from states to excluded_states if needed
      let excludedStates = lender.criteria?.excluded_states || []
      if (!lender.criteria?.excluded_states && lender.criteria?.states) {
        // If we have states but not excluded_states, convert
        excludedStates = ALL_US_STATES.filter((state) => !lender.criteria.states.includes(state))
      }

      // Convert from industries to excluded_industries if needed
      let excludedIndustries = lender.criteria?.excluded_industries || []
      if (!lender.criteria?.excluded_industries && lender.criteria?.industries) {
        // If we have industries but not excluded_industries, convert
        excludedIndustries = ALL_INDUSTRIES.filter((industry) => !lender.criteria.industries.includes(industry))
      }

      setFormData({
        name: lender.name || "",
        email: lender.email || "",
        cc_email: lender.criteria?.cc_email || "",
        description: lender.description || "",
        min_credit_score: lender.criteria?.min_credit_score || 500,
        max_credit_score: lender.criteria?.max_credit_score || 850,
        min_monthly_revenue: lender.criteria?.min_monthly_revenue || 10000,
        max_monthly_revenue: lender.criteria?.max_monthly_revenue || 1000000,
        min_daily_balance: lender.criteria?.min_daily_balance || 1000,
        max_daily_balance: lender.criteria?.max_daily_balance || 100000,
        min_time_in_business: lender.criteria?.min_time_in_business || 6,
        max_time_in_business: lender.criteria?.max_time_in_business || 240,
        min_funding_amount: lender.criteria?.min_funding_amount || 5000,
        max_funding_amount: lender.criteria?.max_funding_amount || 500000,
        accepts_prior_defaults: lender.criteria?.accepts_prior_defaults !== false,
        max_negative_days: lender.criteria?.max_negative_days || 3,
        min_position: lender.criteria?.min_position || 1,
        max_position: lender.criteria?.max_position || 2,
        excluded_states: excludedStates,
        excluded_industries: excludedIndustries,
      })

      setIsDialogOpen(true)
    } catch (error) {
      console.error("Error editing lender:", error)
      toast({
        title: "Error",
        description: "Failed to edit lender. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleAddNewLender = () => {
    setIsEditing(false)
    setCurrentLender(null)

    setFormData({
      name: "",
      email: "",
      cc_email: "",
      description: "",
      min_credit_score: 500,
      max_credit_score: 850,
      min_monthly_revenue: 10000,
      max_monthly_revenue: 1000000,
      min_daily_balance: 1000,
      max_daily_balance: 100000,
      min_time_in_business: 6,
      max_time_in_business: 240,
      min_funding_amount: 5000,
      max_funding_amount: 500000,
      accepts_prior_defaults: true,
      max_negative_days: 3,
      min_position: 1,
      max_position: 2,
      excluded_states: [],
      excluded_industries: [],
    })

    setIsDialogOpen(true)
  }

  const handleSaveLender = async () => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to save a lender.",
        variant: "destructive",
      })
      return
    }

    try {
      // Calculate accepted states and industries from excluded ones
      const acceptedStates = ALL_US_STATES.filter((state) => !formData.excluded_states.includes(state))
      const acceptedIndustries = ALL_INDUSTRIES.filter((industry) => !formData.excluded_industries.includes(industry))

      if (isEditing && currentLender) {
        // Update existing lender
        const updatedLender = await updateLender(currentLender.id, {
          name: formData.name,
          email: formData.email,
          description: formData.description,
        })

        // Create a safe criteria object with only fields we know exist in the database
        const criteriaData = {
          min_credit_score: formData.min_credit_score,
          max_credit_score: formData.max_credit_score,
          min_monthly_revenue: formData.min_monthly_revenue,
          max_monthly_revenue: formData.max_monthly_revenue,
          min_daily_balance: formData.min_daily_balance,
          max_daily_balance: formData.max_daily_balance,
          min_time_in_business: formData.min_time_in_business,
          max_time_in_business: formData.max_time_in_business,
          min_funding_amount: formData.min_funding_amount,
          max_funding_amount: formData.max_funding_amount,
          max_negative_days: formData.max_negative_days,
          cc_email: formData.cc_email,
          min_position: formData.min_position,
          max_position: formData.max_position,
          states: acceptedStates,
          industries: acceptedIndustries,
        }

        // Update lender criteria
        await updateLenderCriteria(currentLender.criteria.id, criteriaData)

        toast({
          title: "Success",
          description: "Lender updated successfully.",
        })
      } else {
        // Create new lender with the user ID
        const newLender = await createLender(
          {
            name: formData.name,
            email: formData.email,
            description: formData.description,
          },
          user.id,
        )

        // Create a safe criteria object with only fields we know exist in the database
        const criteriaData = {
          lender_id: newLender.id,
          min_credit_score: formData.min_credit_score,
          max_credit_score: formData.max_credit_score,
          min_monthly_revenue: formData.min_monthly_revenue,
          max_monthly_revenue: formData.max_monthly_revenue,
          min_daily_balance: formData.min_daily_balance,
          max_daily_balance: formData.max_daily_balance,
          min_time_in_business: formData.min_time_in_business,
          max_time_in_business: formData.max_time_in_business,
          min_funding_amount: formData.min_funding_amount,
          max_funding_amount: formData.max_funding_amount,
          max_negative_days: formData.max_negative_days,
          cc_email: formData.cc_email,
          min_position: formData.min_position,
          max_position: formData.max_position,
          states: acceptedStates,
          industries: acceptedIndustries,
        }

        // Create lender criteria
        await createLenderCriteria(criteriaData)

        toast({
          title: "Success",
          description: "Lender created successfully.",
        })
      }

      // Refresh lenders
      await fetchLenders()

      // Close dialog
      setIsDialogOpen(false)
    } catch (error) {
      console.error("Error saving lender:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save lender.",
        variant: "destructive",
      })
    }
  }

  // Open delete confirmation dialog
  const openDeleteDialog = (lenderId: string) => {
    setLenderToDelete(lenderId)
    setDeleteDialogOpen(true)
  }

  // Confirm delete action
  const confirmDelete = async () => {
    if (!lenderToDelete) return

    try {
      setIsDeleting(true)
      console.log(`Attempting to delete lender with ID: ${lenderToDelete}`)

      // Call the deleteLender function
      await deleteLender(lenderToDelete)

      // If we get here, the delete was successful
      toast({
        title: "Success",
        description: "Lender deleted successfully.",
      })

      // Update the local state to remove the deleted lender
      setLenders((prevLenders) => prevLenders.filter((lender) => lender.id !== lenderToDelete))
      setFilteredLenders((prevLenders) => prevLenders.filter((lender) => lender.id !== lenderToDelete))
    } catch (error) {
      console.error("Error deleting lender:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete lender. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setLenderToDelete(null)
      setDeleteDialogOpen(false)
    }
  }

  // Cancel delete action
  const cancelDelete = () => {
    setLenderToDelete(null)
    setDeleteDialogOpen(false)
  }

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCsvFile(e.target.files[0])
    }
  }

  const handleCsvUploadClick = () => {
    fileInputRef.current?.click()
  }

  const parseCsvFile = (file: File): Promise<CSVLenderData[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (event) => {
        try {
          if (!event.target || !event.target.result) {
            throw new Error("Failed to read file")
          }

          const csvText = event.target.result as string
          console.log("CSV content:", csvText.substring(0, 100) + "...") // Log first 100 chars

          // Split by newline, handling both \r\n and \n
          const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0)

          if (lines.length === 0) {
            throw new Error("CSV file is empty")
          }

          console.log(`Found ${lines.length} lines in CSV`)

          // Extract headers (first line)
          const headers = lines[0].split(",").map((header) => header.trim().toLowerCase())
          console.log("CSV headers:", headers)

          // Parse data rows
          const data: CSVLenderData[] = []

          for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue // Skip empty lines

            // Split by comma, but handle quoted values correctly
            const values: string[] = []
            let inQuotes = false
            let currentValue = ""

            for (let j = 0; j < lines[i].length; j++) {
              const char = lines[i][j]

              if (char === '"' && (j === 0 || lines[i][j - 1] !== "\\")) {
                inQuotes = !inQuotes
              } else if (char === "," && !inQuotes) {
                values.push(currentValue.trim())
                currentValue = ""
              } else {
                currentValue += char
              }
            }

            // Add the last value
            values.push(currentValue.trim())

            // Ensure we have the right number of values
            if (values.length !== headers.length) {
              console.warn(
                `Line ${i + 1} has ${values.length} values but expected ${headers.length}. Line: ${lines[i]}`,
              )
              // Pad with empty strings if needed
              while (values.length < headers.length) {
                values.push("")
              }
              // Truncate if too many
              if (values.length > headers.length) {
                values.splice(headers.length)
              }
            }

            const lender: any = {}

            headers.forEach((header, index) => {
              // Handle undefined, empty strings, or whitespace-only strings
              const value = values[index] !== undefined ? values[index].trim() : ""

              if (value === "") {
                // For empty values, set to undefined or appropriate default
                if (header === "name" || header === "email") {
                  // For required fields, keep as empty string to trigger validation
                  lender[header] = ""
                } else {
                  // For optional fields, set to undefined
                  lender[header] = undefined
                }
              } else {
                // Convert values to appropriate types
                if (
                  header === "accepts_existing_loans" ||
                  header === "accepts_prior_defaults" ||
                  header === "funds_first_position"
                ) {
                  const val = value.toLowerCase()
                  lender[header] = val === "true" || val === "yes" || val === "1"
                } else if (
                  header.includes("credit_score") ||
                  header.includes("revenue") ||
                  header.includes("balance") ||
                  header.includes("time_in_business") ||
                  header.includes("funding_amount") ||
                  header === "max_negative_days"
                ) {
                  // Remove any non-numeric characters except decimal point
                  const numStr = value.replace(/[^\d.]/g, "")
                  lender[header] = numStr ? Number(numStr) : undefined
                } else {
                  lender[header] = value
                }
              }
            })

            data.push(lender as CSVLenderData)
          }

          console.log(`Successfully parsed ${data.length} lenders from CSV`)
          resolve(data)
        } catch (error) {
          console.error("Error parsing CSV:", error)
          reject(new Error(`Failed to parse CSV file: ${error instanceof Error ? error.message : "Unknown error"}`))
        }
      }

      reader.onerror = (event) => {
        console.error("FileReader error:", event)
        reject(new Error("Failed to read CSV file."))
      }

      reader.readAsText(file)
    })
  }

  const processLenderData = async (lenderData: CSVLenderData[]) => {
    if (!user?.id) {
      throw new Error("User not authenticated")
    }

    const results = {
      total: lenderData.length,
      successful: 0,
      failed: 0,
      errors: [] as string[],
    }

    console.log(`Processing ${lenderData.length} lenders from CSV`)

    for (let i = 0; i < lenderData.length; i++) {
      const lender = lenderData[i]
      console.log(`Processing lender ${i + 1}/${lenderData.length}: ${lender.name}`)

      try {
        // Update progress
        setUploadProgress(Math.round(((i + 1) / lenderData.length) * 100))

        // Validate required fields
        const trimmedName = lender.name?.trim() || ""
        const trimmedEmail = lender.email?.trim() || ""

        if (!trimmedName || !trimmedEmail) {
          const missingFields = []
          if (!trimmedName) missingFields.push("name")
          if (!trimmedEmail) missingFields.push("email")

          const errorMessage = `Row ${i + 2}: ${missingFields.join(" and ")} ${missingFields.length > 1 ? "are" : "is"} required`
          console.error(errorMessage, lender)
          results.errors.push(errorMessage)
          results.failed++
          continue // Skip this lender and continue with the next one
        }

        // Use the trimmed values
        lender.name = trimmedName
        lender.email = trimmedEmail

        console.log(`Creating lender: ${lender.name}, ${lender.email}`)

        // Create lender with user ID
        const newLender = await createLender(
          {
            name: lender.name,
            email: lender.email,
            description: lender.description || "",
          },
          user.id,
        )

        console.log(`Lender created with ID: ${newLender.id}`)

        // Process excluded states and industries
        let excludedStates: string[] = []
        let excludedIndustries: string[] = []

        if (lender.excluded_states) {
          excludedStates = lender.excluded_states.split(/[|;]/).map((s) => s.trim())
          console.log(`Parsed excluded states: ${excludedStates.join(", ")}`)
        }

        if (lender.excluded_industries) {
          excludedIndustries = lender.excluded_industries.split(/[|;]/).map((i) => i.trim())
          console.log(`Parsed excluded industries: ${excludedIndustries.join(", ")}`)
        }

        // Calculate accepted states and industries
        const acceptedStates = ALL_US_STATES.filter((state) => !excludedStates.includes(state))
        const acceptedIndustries = ALL_INDUSTRIES.filter((industry) => !excludedIndustries.includes(industry))

        // Create a safe criteria object with only fields we know exist in the database
        const criteriaData = {
          lender_id: newLender.id,
          min_credit_score: lender.min_credit_score || 500,
          max_credit_score: lender.max_credit_score || 850,
          min_monthly_revenue: lender.min_monthly_revenue || 10000,
          max_monthly_revenue: lender.max_monthly_revenue || 1000000,
          min_daily_balance: lender.min_daily_balance || 1000,
          max_daily_balance: lender.max_daily_balance || 100000,
          min_time_in_business: lender.min_time_in_business || 6,
          max_time_in_business: lender.max_time_in_business || 240,
          min_funding_amount: lender.min_funding_amount || 5000,
          max_funding_amount: lender.max_funding_amount || 500000,
          max_negative_days: lender.max_negative_days || 3,
          min_position: lender.min_position || 1,
          max_position: lender.max_position || 2,
          cc_email: lender.cc_email || "",
          states: acceptedStates,
          industries: acceptedIndustries,
        }

        console.log(`Creating criteria for lender ${newLender.id}`)
        console.log("Criteria data:", JSON.stringify(criteriaData, null, 2))

        // Create lender criteria
        await createLenderCriteria(criteriaData)

        console.log(`Successfully processed lender: ${lender.name}`)
        results.successful++
      } catch (error) {
        results.failed++
        const errorMessage =
          error instanceof Error
            ? `Error with lender ${lender.name}: ${error.message}`
            : `Unknown error with lender ${lender.name}`

        console.error(errorMessage)
        results.errors.push(errorMessage)
      }
    }

    return results
  }

  const handleUploadCsv = async () => {
    if (!csvFile) {
      toast({
        title: "Error",
        description: "Please select a CSV file to upload.",
        variant: "destructive",
      })
      return
    }

    if (!user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to upload lenders.",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    setUploadResults(null)

    try {
      console.log(`Starting CSV upload for file: ${csvFile.name} (${csvFile.size} bytes)`)

      // Parse CSV file
      const lenderData = await parseCsvFile(csvFile)

      console.log(`CSV parsed successfully with ${lenderData.length} lenders`)

      // Process lender data
      const results = await processLenderData(lenderData)
      console.log("CSV import results:", results)

      // Set results
      setUploadResults(results)

      // Show toast
      if (results.successful > 0) {
        toast({
          title: "Import Complete",
          description: `Successfully imported ${results.successful} lenders.${results.failed > 0 ? ` Failed to import ${results.failed} lenders.` : ""}`,
          variant: results.failed > 0 ? "warning" : "default",
        })
      } else {
        toast({
          title: "Import Failed",
          description: "Failed to import any lenders. Please check the CSV format.",
          variant: "destructive",
        })
      }

      // Refresh lenders list
      await fetchLenders()
    } catch (error) {
      console.error("Error uploading CSV:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload CSV file.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const generateSampleCsv = () => {
    const headers = [
      "name",
      "email",
      "cc_email",
      "description",
      "min_credit_score",
      "min_monthly_revenue",
      "min_daily_balance",
      "min_time_in_business",
      "min_funding_amount",
      "max_funding_amount",
      "max_negative_days",
      "excluded_states",
      "excluded_industries",
    ].join(",")

    const sampleData = [
      "ABC Capital,abc@example.com,cc@example.com,Fast funding provider,550,15000,2000,12,10000,250000,3,ND|SD|WY,Agriculture|Energy",
      "XYZ Funding,xyz@example.com,support@example.com,Small business specialist,600,25000,5000,24,25000,500000,0,HI|AK|ME,Manufacturing|Construction",
    ].join("\n")

    const csvContent = `${headers}\n${sampleData}`
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "lenders_template.csv"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // If there's an error, show error message
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <div>
              <h3 className="text-red-800 font-medium">Error loading lenders</h3>
              <p className="text-red-700 text-sm">{error}</p>
              <Button
                onClick={fetchLenders}
                variant="outline"
                className="mt-2 text-red-600 border-red-300 hover:bg-red-50"
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // If user is not authenticated, show login message
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-amber-500 mr-2" />
            <div>
              <h3 className="text-amber-800 font-medium">Authentication Required</h3>
              <p className="text-amber-700 text-sm">Please log in to manage your lenders.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Lender Database</h1>
            <p className="text-sm text-gray-500">Manage your lenders and their criteria</p>
          </div>

          <div className="flex space-x-3">
            <Button onClick={() => setIsCsvDialogOpen(true)} variant="outline" className="flex items-center">
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
            <Button onClick={handleAddNewLender} className="bg-amber-600 hover:bg-amber-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Lender
            </Button>
          </div>
        </div>

        {/* Search and View Toggle */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
          <div className="relative w-full sm:w-auto flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <Input
              type="text"
              placeholder="Search lenders..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="pl-10 pr-10"
            />
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                aria-label="Clear search"
              >
                <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto">
            <span className="text-sm text-gray-500">View:</span>
            <div className="bg-gray-100 rounded-md p-1 flex">
              <button
                onClick={() => setViewMode("card")}
                className={`p-1 rounded ${
                  viewMode === "card" ? "bg-white shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
                aria-label="Card view"
              >
                <LayoutGrid className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1 rounded ${
                  viewMode === "list" ? "bg-white shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
                aria-label="List view"
              >
                <List className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="text-sm text-gray-500">
          {filteredLenders.length} {filteredLenders.length === 1 ? "lender" : "lenders"} found
          {searchTerm && ` for "${searchTerm}"`}
        </div>
      </div>

      {/* Lender Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Lender" : "Add New Lender"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the lender information and criteria."
                : "Add a new lender and define their criteria."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Lender Name</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter lender name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter lender email"
                  required
                />
              </div>
              <div>
                <Label htmlFor="cc_email">CC Email (Optional)</Label>
                <Input
                  id="cc_email"
                  name="cc_email"
                  type="email"
                  value={formData.cc_email}
                  onChange={handleInputChange}
                  placeholder="Enter CC email address"
                />
                <p className="text-xs text-gray-500 mt-1">Additional recipient to CC when sending emails</p>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Enter lender description"
                  rows={3}
                />
              </div>
              {/* Credit Score Range - Only show minimum */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Minimum Credit Score</h3>
                <div>
                  <Input
                    id="min_credit_score"
                    name="min_credit_score"
                    type="number"
                    value={formData.min_credit_score}
                    onChange={handleNumberInputChange}
                    min={300}
                    max={850}
                  />
                </div>
              </div>
              {/* Monthly Revenue Range - Only show minimum */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Minimum Monthly Revenue</h3>
                <div>
                  <Input
                    id="min_monthly_revenue"
                    name="min_monthly_revenue"
                    type="number"
                    value={formData.min_monthly_revenue}
                    onChange={handleNumberInputChange}
                    min={0}
                  />
                </div>
              </div>
              {/* Daily Balance Range - Only show minimum */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Minimum Daily Balance</h3>
                <div>
                  <Input
                    id="min_daily_balance"
                    name="min_daily_balance"
                    type="number"
                    value={formData.min_daily_balance}
                    onChange={handleNumberInputChange}
                    min={0}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-4">
              {/* Time in Business - Only show minimum */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Minimum Time in Business (months)</h3>
                <div>
                  <Input
                    id="min_time_in_business"
                    name="min_time_in_business"
                    type="number"
                    value={formData.min_time_in_business}
                    onChange={handleNumberInputChange}
                    min={0}
                  />
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Funding Amount Range</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="min_funding_amount">Minimum</Label>
                    <Input
                      id="min_funding_amount"
                      name="min_funding_amount"
                      type="number"
                      value={formData.min_funding_amount}
                      onChange={handleNumberInputChange}
                      min={0}
                    />
                  </div>
                  <div>
                    <Label htmlFor="max_funding_amount">Maximum</Label>
                    <Input
                      id="max_funding_amount"
                      name="max_funding_amount"
                      type="number"
                      value={formData.max_funding_amount}
                      onChange={handleNumberInputChange}
                      min={0}
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Funding Position Range</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="min_position">From Position</Label>
                    <Input
                      id="min_position"
                      name="min_position"
                      type="number"
                      value={formData.min_position}
                      onChange={handleNumberInputChange}
                      min={1}
                    />
                  </div>
                  <div>
                    <Label htmlFor="max_position">To Position</Label>
                    <Input
                      id="max_position"
                      name="max_position"
                      type="number"
                      value={formData.max_position}
                      onChange={handleNumberInputChange}
                      min={1}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="accepts_prior_defaults"
                  checked={formData.accepts_prior_defaults}
                  onCheckedChange={(checked) => handleSwitchChange("accepts_prior_defaults", checked)}
                />
                <Label htmlFor="accepts_prior_defaults">Accepts Prior Defaults</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_negative_days">Max Negative Days</Label>
                <Input
                  id="max_negative_days"
                  name="max_negative_days"
                  type="number"
                  value={formData.max_negative_days}
                  onChange={handleNumberInputChange}
                  min={0}
                />
                <p className="text-xs text-gray-500">Maximum number of negative days in bank statements</p>
              </div>
              <div className="space-y-2">
                <Label>Restricted States</Label>
                <p className="text-xs text-gray-500 mb-2">Select states that this lender does NOT work with</p>
                <div className="grid grid-cols-5 gap-2 border rounded-md p-2 max-h-40 overflow-y-auto">
                  {ALL_US_STATES.map((state) => (
                    <div key={state} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`state-${state}`}
                        checked={formData.excluded_states.includes(state)}
                        onChange={() => handleStateChange(state)}
                        className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                      />
                      <label htmlFor={`state-${state}`} className="text-sm">
                        {state}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Restricted Industries</Label>
                <p className="text-xs text-gray-500 mb-2">Select industries that this lender does NOT work with</p>
                <div className="grid grid-cols-1 gap-2 border rounded-md p-2 max-h-60 overflow-y-auto">
                  {ALL_INDUSTRIES.map((industry) => (
                    <div key={industry} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`industry-${industry}`}
                        checked={formData.excluded_industries.includes(industry)}
                        onChange={() => handleIndustryChange(industry)}
                        className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                      />
                      <label htmlFor={`industry-${industry}`} className="text-sm">
                        {industry}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveLender} className="bg-amber-600 hover:bg-amber-700 text-white">
              <Save className="h-4 w-4 mr-2" />
              Save Lender
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Upload Dialog */}
      <Dialog open={isCsvDialogOpen} onOpenChange={setIsCsvDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Lenders from CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file to bulk import lenders. The first row should contain headers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={generateSampleCsv}>
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>

              <input type="file" ref={fileInputRef} onChange={handleCsvFileChange} accept=".csv" className="hidden" />
            </div>

            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={handleCsvUploadClick}
            >
              <div className="flex flex-col items-center justify-center space-y-2">
                <FileSpreadsheet className="h-10 w-10 text-gray-400" />
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-amber-600">Click to upload</span> or drag and drop
                </div>
                <p className="text-xs text-gray-500">CSV files only</p>
              </div>
            </div>

            {csvFile && (
              <div className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                <div className="flex items-center space-x-2">
                  <FileSpreadsheet className="h-4 w-4 text-green-500" />
                  <span className="text-sm truncate max-w-[200px]">{csvFile.name}</span>
                </div>
                <button onClick={() => setCsvFile(null)} className="text-red-500 hover:text-red-700 text-sm">
                  Remove
                </button>
              </div>
            )}

            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            {uploadResults && (
              <div className={`p-3 rounded-md ${uploadResults.failed > 0 ? "bg-amber-50" : "bg-green-50"}`}>
                <div className="flex items-start space-x-2">
                  {uploadResults.failed > 0 ? (
                    <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {uploadResults.successful > 0
                        ? `Successfully imported ${uploadResults.successful} lenders`
                        : "Import completed with issues"}
                    </p>
                    {uploadResults.failed > 0 && (
                      <p className="text-sm text-gray-600">Failed to import {uploadResults.failed} lenders</p>
                    )}
                    {uploadResults.errors.length > 0 && (
                      <div className="mt-2 text-xs text-gray-600 max-h-40 overflow-y-auto">
                        <p className="font-medium">Errors:</p>
                        <ul className="list-disc list-inside">
                          {uploadResults.errors.slice(0, 10).map((error, index) => (
                            <li key={index} className="text-red-600 mb-1">
                              {error}
                            </li>
                          ))}
                          {uploadResults.errors.length > 10 && (
                            <li>...and {uploadResults.errors.length - 10} more errors</li>
                          )}
                        </ul>
                        <p className="mt-2 text-sm font-medium">
                          Tip: Check your CSV file for empty rows or missing required fields (name and email).
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCsvDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUploadCsv}
              disabled={!csvFile || isUploading}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Upload className="h-4 w-4 mr-2" />
              {isUploading ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
        </div>
      ) : (
        <div className="mt-6">
          {viewMode === "card" ? (
            // Card View
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredLenders.length > 0 ? (
                filteredLenders.map((lender) => (
                  <Card key={lender.id}>
                    <CardHeader className="bg-gradient-to-r from-amber-500 to-amber-600 text-white">
                      <CardTitle className="flex justify-between items-center">
                        <span>{lender.name}</span>
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-white hover:bg-amber-700"
                            onClick={() => handleEditLender(lender)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-white hover:bg-amber-700"
                            onClick={() => openDeleteDialog(lender.id)}
                            disabled={isDeleting && lenderToDelete === lender.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-center space-x-2 text-sm">
                        <Mail className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-700">{lender.email}</span>
                      </div>
                      {lender.criteria?.cc_email && (
                        <div className="flex items-center space-x-2 text-sm">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">CC: {lender.criteria.cc_email}</span>
                        </div>
                      )}

                      {lender.description && <p className="text-sm text-gray-600">{lender.description}</p>}

                      <div className="space-y-2">
                        <h3 className="text-sm font-medium text-gray-700">Criteria:</h3>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <div>
                            <p className="text-gray-500">Min Credit Score</p>
                            <p>{lender.criteria?.min_credit_score || "Any"}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Min Monthly Revenue</p>
                            <p>
                              {lender.criteria?.min_monthly_revenue
                                ? formatCurrency(lender.criteria.min_monthly_revenue)
                                : "Any"}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Funding Range</p>
                            <p>
                              {lender.criteria?.min_funding_amount
                                ? formatCurrency(lender.criteria.min_funding_amount)
                                : "Any"}{" "}
                              -{" "}
                              {lender.criteria?.max_funding_amount
                                ? formatCurrency(lender.criteria.max_funding_amount)
                                : "Any"}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Max Negative Days</p>
                            <p>{lender.criteria?.max_negative_days || "N/A"}</p>
                          </div>
                          {lender.criteria?.excluded_states && lender.criteria.excluded_states.length > 0 && (
                            <div className="col-span-2">
                              <p className="text-gray-500">Restricted States</p>
                              <p className="text-xs">{lender.criteria.excluded_states.join(", ")}</p>
                            </div>
                          )}
                          {lender.criteria?.excluded_industries && lender.criteria.excluded_industries.length > 0 && (
                            <div className="col-span-2">
                              <p className="text-gray-500">Restricted Industries</p>
                              <p className="text-xs line-clamp-2">
                                {lender.criteria.excluded_industries.length > 3
                                  ? `${lender.criteria.excluded_industries.slice(0, 3).join(", ")} +${lender.criteria.excluded_industries.length - 3} more`
                                  : lender.criteria.excluded_industries.join(", ")}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <p className="text-gray-600">No lenders found. Add a lender to get started.</p>
                </div>
              )}
            </div>
          ) : (
            // List View
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer" onClick={() => handleSortChange("name")}>
                      <div className="flex items-center space-x-1">
                        <span>Name</span>
                        {sortField === "name" && (
                          <span>
                            {sortDirection === "asc" ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </span>
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSortChange("email")}>
                      <div className="flex items-center space-x-1">
                        <span>Email</span>
                        {sortField === "email" && (
                          <span>
                            {sortDirection === "asc" ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </span>
                        )}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hidden md:table-cell"
                      onClick={() => handleSortChange("min_credit_score")}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Min Credit Score</span>
                        {sortField === "min_credit_score" && (
                          <span>
                            {sortDirection === "asc" ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </span>
                        )}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hidden lg:table-cell"
                      onClick={() => handleSortChange("min_monthly_revenue")}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Min Revenue</span>
                        {sortField === "min_monthly_revenue" && (
                          <span>
                            {sortDirection === "asc" ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </span>
                        )}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hidden lg:table-cell"
                      onClick={() => handleSortChange("min_funding_amount")}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Funding Range</span>
                        {sortField === "min_funding_amount" && (
                          <span>
                            {sortDirection === "asc" ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </span>
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLenders.length > 0 ? (
                    filteredLenders.map((lender) => (
                      <TableRow key={lender.id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{lender.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{lender.email}</span>
                            {lender.criteria?.cc_email && (
                              <span className="text-xs text-gray-500">CC: {lender.criteria.cc_email}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {lender.criteria?.min_credit_score || "Any"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {lender.criteria?.min_monthly_revenue
                            ? formatCurrency(lender.criteria.min_monthly_revenue)
                            : "Any"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {lender.criteria?.min_funding_amount
                            ? formatCurrency(lender.criteria.min_funding_amount)
                            : "Any"}{" "}
                          -{" "}
                          {lender.criteria?.max_funding_amount
                            ? formatCurrency(lender.criteria.max_funding_amount)
                            : "Any"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-500 hover:text-gray-700"
                              onClick={() => handleEditLender(lender)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-500 hover:text-gray-700"
                              onClick={() => openDeleteDialog(lender.id)}
                              disabled={isDeleting && lenderToDelete === lender.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6">
                        <p className="text-gray-600">No lenders found. Add a lender to get started.</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the lender and all associated criteria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
