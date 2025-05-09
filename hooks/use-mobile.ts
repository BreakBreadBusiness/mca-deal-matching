"use client"

import { useState, useEffect } from "react"

export function useMobile(): boolean {
  // Default to false for SSR
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Set initial value
    setIsMobile(window.innerWidth < 768)

    // Add resize listener
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener("resize", handleResize)

    // Clean up
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return isMobile
}
