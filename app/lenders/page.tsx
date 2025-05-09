import { Navbar } from "@/components/navbar"
import LenderManagement from "@/components/lender-management"
import { ProtectedRoute } from "@/components/protected-route"

export default function LendersPage() {
  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-gray-50">
        <Navbar />
        <LenderManagement />
      </main>
    </ProtectedRoute>
  )
}
