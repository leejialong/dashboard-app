import { Suspense } from "react";
import Dashboard from "@/components/Dashboard";

// Dashboard starts empty and only shows the real, OAuth-connected Gmail
// account once you click "+ Connect account". Suspense is required because
// Dashboard reads ?gmail_error= via useSearchParams (OAuth failure codes
// from /api/auth/google*). lib/mock-data.ts still exports provider helpers
// used by ExpandedAccount; its mock arrays are intentionally unwired.
export default function Home() {
  return (
    <Suspense fallback={null}>
      <Dashboard initialAccounts={[]} initialEmails={[]} />
    </Suspense>
  );
}
