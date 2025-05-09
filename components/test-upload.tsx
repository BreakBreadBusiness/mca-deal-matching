"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileSpreadsheet, RefreshCw } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export function TestUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first")
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    setError(null)
    setResult(null)

    try {
      // Create a FormData object to send the file
      const formData = new FormData()
      formData.append("file", file)

      // Set up progress tracking with XMLHttpRequest
      const xhr = new XMLHttpRequest()

      // Create a promise to handle the XHR request
      const uploadPromise = new Promise<any>((resolve, reject) => {
        xhr.open("POST", "https://mca-backend.onrender.com/upload", true)

        // Track upload progress
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100)
            setUploadProgress(percentComplete)
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              // Log the raw response for debugging
              console.log("Raw API response:", xhr.responseText)

              // Check if response is empty
              if (!xhr.responseText.trim()) {
                reject(new Error("API returned empty response"))
                return
              }

              // Attempt to parse the response as JSON
              try {
                const response = JSON.parse(xhr.responseText)
                resolve(response)
              } catch (parseError) {
                console.error("Error parsing API response:", parseError, "Raw response:", xhr.responseText)

                // If it's not JSON, just return the text
                resolve({
                  success: true,
                  message: "File uploaded successfully, but response was not JSON",
                  rawResponse: xhr.responseText,
                })
              }
            } catch (e) {
              reject(new Error("Invalid response from API"))
            }
          } else {
            reject(new Error(`API returned ${xhr.status}: ${xhr.statusText}`))
          }
        }

        xhr.onerror = () => {
          console.error("Network error during upload")
          reject(new Error("Network error during upload"))
        }

        xhr.ontimeout = () => {
          console.error("Upload timed out")
          reject(new Error("Upload timed out"))
        }

        // Send the form data
        xhr.send(formData)
      })

      // Add a timeout to the promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Request timed out after 60 seconds")), 60000)
      })

      // Wait for the upload and processing to complete or timeout
      const result = await Promise.race([uploadPromise, timeoutPromise])

      console.log("Upload result:", result)
      setResult(result)
      setUploadProgress(100)
    } catch (error) {
      console.error("Upload error:", error)
      setError(error instanceof Error ? error.message : "An unknown error occurred")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Test PDF Upload</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <input type="file" accept=".pdf" onChange={handleFileChange} className="flex-1" />
            <Button onClick={handleUpload} disabled={!file || isUploading} className="bg-amber-600 hover:bg-amber-700">
              {isUploading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload"
              )}
            </Button>
          </div>

          {file && (
            <div className="flex items-center space-x-2 bg-gray-50 p-2 rounded">
              <FileSpreadsheet className="h-5 w-5 text-amber-600" />
              <span className="text-sm">{file.name}</span>
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

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
              <h3 className="font-medium text-green-800 mb-2">Upload Successful</h3>
              <pre className="text-xs bg-white p-2 rounded overflow-auto max-h-40">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
