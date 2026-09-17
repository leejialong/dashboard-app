import { Suspense } from "react";
import Dashboard from "@/components/Dashboard";

// Same Gmail dashboard as before — only the URL changed from / to /dashboard.
// Suspense is required because Dashboard reads ?gmail_error= via useSearchParams
// (OAuth failure codes from /api/auth/google*).
export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <Dashboard initialAccounts={[]} initialEmails={[]} />
    </Suspense>
  );
}
