import { ProviderFilter } from "@/lib/types";

interface AccountToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  activeFilter: ProviderFilter;
  onFilterChange: (filter: ProviderFilter) => void;
}

const FILTERS: { key: ProviderFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "gmail", label: "Gmail" },
  { key: "outlook", label: "Outlook" },
  { key: "unread", label: "Unread" },
];

export default function AccountToolbar({
  searchValue,
  onSearchChange,
  activeFilter,
  onFilterChange,
}: AccountToolbarProps) {
  return (
    <div className="accounts-toolbar">
      <input
        placeholder="🔍 Search accounts…"
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <div className="filters">
        {FILTERS.map((f) => (
          <span
            key={f.key}
            className={`filter-chip ${activeFilter === f.key ? "active" : ""}`}
            onClick={() => onFilterChange(f.key)}
          >
            {f.label}
          </span>
        ))}
      </div>
    </div>
  );
}
