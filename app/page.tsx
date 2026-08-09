import Dashboard from "@/components/Dashboard";

// Mock/demo accounts have been removed -- the dashboard now starts empty
// and only shows the real, OAuth-connected Gmail account once you click
// "+ Connect account". (lib/mock-data.ts is kept around for reference /
// if demo data is ever wanted again, just no longer wired up here.)
export default function Home() {
  return <Dashboard initialAccounts={[]} initialEmails={[]} />;
}
