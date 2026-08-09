import Dashboard from "@/components/Dashboard";
import { mockAccounts, mockEmails } from "@/lib/mock-data";

export default function Home() {
  return <Dashboard initialAccounts={mockAccounts} initialEmails={mockEmails} />;
}
