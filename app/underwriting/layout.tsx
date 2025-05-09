"use client"

import type React from "react"

import { ApplicationProvider } from "@/context/application-context"

export default function UnderwritingLayout({ children }: { children: React.ReactNode }) {
  return <ApplicationProvider>{children}</ApplicationProvider>
}
