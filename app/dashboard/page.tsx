import { DashboardNew } from "@/components/dashboard-new"
import { ApplicationProvider } from "@/context/application-context"

export default function DashboardPage() {
  return (
    <div className="container mx-auto py-6">
      {/* Wrap DashboardNew with ApplicationProvider */}
      <ApplicationProvider>
        <DashboardNew />
      </ApplicationProvider>

      {/* Add the diagnostics component at the bottom of the page */}
    </div>
  )
}
