import type React from "react"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/context/auth-context"
import { Toaster } from "@/components/ui/toaster"

// Optimize font loading
const inter = Inter({
  subsets: ["latin"],
  display: "swap", // Use swap to prevent FOIT (Flash of Invisible Text)
  preload: true,
})

export const metadata = {
  title: "MCA Deal Matching - Break Bread Business Group",
  description: "Match MCA applications with suitable lenders",
  viewport: "width=device-width, initial-scale=1.0, maximum-scale=1.0",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <AuthProvider>{children}</AuthProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
