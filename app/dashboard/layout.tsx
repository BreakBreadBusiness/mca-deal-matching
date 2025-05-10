// Make sure the layout is correct and not interfering with the dashboard

import type React from "react"
import { Navbar } from "@/components/navbar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Navbar />
      {children}
    </>
  )
}
