import { Navbar } from "@/components/navbar"
import { Dashboard } from "@/components/dashboard"
import { ProtectedRoute } from "@/components/protected-route"
import { ApplicationProvider } from "@/context/application-context"

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-gray-50">
        <Navbar />
        <ApplicationProvider>
          <Dashboard />
        </ApplicationProvider>
      </main>
    </ProtectedRoute>
  )
}
