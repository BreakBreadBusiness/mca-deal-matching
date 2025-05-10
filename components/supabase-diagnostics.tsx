"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Info } from "lucide-react"
import { verifyAndFixBucketAccess, runSupabaseDiagnostics } from "@/lib/supabase-client"

export function SupabaseDiagnostics() {
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [isFixing, setIsFixing] = useState(false)
  const [fixResult, setFixResult] = useState<string | null>(null)

  const runDiagnostics = async () => {
    setIsRunning(true)
    setError(null)
    setFixResult(null)

    try {
      const diagnosticResults = await runSupabaseDiagnostics()
      setResults(diagnosticResults)
    } catch (e: any) {
      setError(e.message || "An unknown error occurred")
    } finally {
      setIsRunning(false)
    }
  }

  const attemptToFixBucket = async () => {
    setIsFixing(true)
    setFixResult(null)

    try {
      const result = await verifyAndFixBucketAccess("applications")

      if (result.success) {
        setFixResult(`✅ Success: ${result.message}`)
      } else {
        setFixResult(`❌ Failed: ${result.message}`)
      }

      // Run diagnostics again to refresh the data
      await runDiagnostics()
    } catch (e: any) {
      setFixResult(`❌ Error: ${e.message || "Unknown error"}`)
    } finally {
      setIsFixing(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Supabase Storage Diagnostics</CardTitle>
        <CardDescription>Check your Supabase storage configuration and troubleshoot issues</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex space-x-2">
            <Button onClick={runDiagnostics} disabled={isRunning}>
              {isRunning ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Running Diagnostics...
                </>
              ) : (
                "Run Diagnostics"
              )}
            </Button>

            <Button onClick={attemptToFixBucket} disabled={isFixing || isRunning} variant="outline">
              {isFixing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Fixing...
                </>
              ) : (
                "Attempt to Fix Bucket"
              )}
            </Button>
          </div>

          {fixResult && (
            <Alert variant={fixResult.includes("Success") ? "default" : "destructive"}>
              <AlertTitle>Fix Attempt Result</AlertTitle>
              <AlertDescription>{fixResult}</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {results && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-2">Environment</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span>SUPABASE_URL</span>
                    <span>{results.environment.supabaseUrl ? "✓ Set" : "✗ Missing"}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span>SUPABASE_ANON_KEY</span>
                    <span>{results.environment.supabaseAnonKey ? "✓ Set" : "✗ Missing"}</span>
                  </div>
                  {results.environment.actualUrl && (
                    <div className="col-span-2 p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-500">URL Preview: {results.environment.actualUrl}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">Connection</h3>
                <div className="p-3 rounded bg-gray-50 flex items-center">
                  {results.connection ? (
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500 mr-2" />
                  )}
                  <span>{results.connection ? "Successfully connected to Supabase" : "Connection failed"}</span>
                </div>

                {results.projectInfo && (
                  <div className="mt-2 p-3 rounded bg-blue-50">
                    <div className="flex items-center mb-1">
                      <Info className="h-4 w-4 text-blue-500 mr-2" />
                      <span className="font-medium">Project Information</span>
                    </div>
                    <div className="text-sm text-gray-700 space-y-1">
                      {Object.entries(results.projectInfo).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="font-medium">{key}:</span>
                          <span>{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">Storage Buckets</h3>
                {results.buckets && results.buckets.length > 0 ? (
                  <div className="space-y-2">
                    {results.buckets.map((bucket: any, index: number) => (
                      <div key={index} className="p-3 rounded bg-gray-50">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center">
                            {bucket.accessible ? (
                              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500 mr-2" />
                            )}
                            <span className="font-medium">{bucket.name}</span>
                            {bucket.name.toLowerCase() === "applications" && (
                              <Badge className="ml-2 bg-blue-100 text-blue-800">Primary</Badge>
                            )}
                          </div>
                          {bucket.accessible ? (
                            <span className="text-sm text-gray-500">{bucket.fileCount} files</span>
                          ) : (
                            <Badge variant="destructive">Access Error</Badge>
                          )}
                        </div>

                        {bucket.error && <div className="mt-1 text-sm text-red-500">Error: {bucket.error}</div>}

                        {bucket.name.toLowerCase() === "applications" && !bucket.accessible && (
                          <div className="mt-2 text-sm text-amber-600 bg-amber-50 p-2 rounded">
                            <AlertTriangle className="h-4 w-4 inline-block mr-1" />
                            The primary "applications" bucket exists but cannot be accessed. This may be due to
                            permissions or RLS policies.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded bg-gray-50">
                    <div className="flex items-center text-red-500">
                      <XCircle className="h-5 w-5 mr-2" />
                      <span>No buckets found or unable to list buckets</span>
                    </div>
                  </div>
                )}

                {/* Check specifically for applications bucket */}
                {results.buckets && !results.buckets.some((b: any) => b.name.toLowerCase() === "applications") && (
                  <Alert variant="warning" className="mt-3">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Missing Primary Bucket</AlertTitle>
                    <AlertDescription>
                      The "applications" bucket was not found in your Supabase project. This is required for file
                      uploads.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Check for case sensitivity issues */}
                {results.buckets &&
                  results.buckets.some(
                    (b: any) => b.name.toLowerCase() === "applications" && b.name !== "applications",
                  ) && (
                    <Alert className="mt-3">
                      <Info className="h-4 w-4" />
                      <AlertTitle>Case Sensitivity Issue</AlertTitle>
                      <AlertDescription>
                        Found the applications bucket but with different capitalization: "
                        {results.buckets.find((b: any) => b.name.toLowerCase() === "applications").name}". The
                        application is looking for "applications" (all lowercase).
                      </AlertDescription>
                    </Alert>
                  )}
              </div>

              <div className="text-xs text-gray-500">Diagnostics run at: {new Date().toLocaleString()}</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
