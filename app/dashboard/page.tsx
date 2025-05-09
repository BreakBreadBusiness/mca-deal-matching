import { DashboardNew } from "@/components/dashboard-new"
import { SupabaseDiagnostics } from "@/components/supabase-diagnostics"
import { ApplicationProvider } from "@/context/application-context"

export default function DashboardPage() {
  return (
    <div className="container mx-auto py-6">
      {/* Wrap DashboardNew with ApplicationProvider */}
      <ApplicationProvider>
        <DashboardNew />
      </ApplicationProvider>

      {/* Add the diagnostics component at the bottom of the page */}
      <div className="mt-8 border-t pt-8">
        <h2 className="text-xl font-semibold mb-4">Storage Diagnostics</h2>
        <SupabaseDiagnostics />
      </div>
    </div>
  )
}
