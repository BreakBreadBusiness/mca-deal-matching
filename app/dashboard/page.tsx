import { DashboardNew } from "@/components/dashboard-new"
import { ProtectedRoute } from "@/components/protected-route"
import { ApplicationProvider } from "@/context/application-context"

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <ApplicationProvider>
        <DashboardNew />
      </ApplicationProvider>
    </ProtectedRoute>
  )
}
