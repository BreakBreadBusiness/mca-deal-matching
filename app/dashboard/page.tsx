import { ApplicationProvider } from "@/context/application-context"
import { DashboardNew } from "@/components/dashboard-new"
import { ProtectedRoute } from "@/components/protected-route"
import { ErrorBoundary } from "@/components/error-boundary"

export default function DashboardPage() {
  return (
    <ErrorBoundary
      fallback={<div className="p-8">Something went wrong loading the dashboard. Please try refreshing the page.</div>}
    >
      <ProtectedRoute>
        <ApplicationProvider>
          <DashboardNew />
        </ApplicationProvider>
      </ProtectedRoute>
    </ErrorBoundary>
  )
}
