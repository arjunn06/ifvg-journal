import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { AccountFilter } from '@/components/AccountFilter';

interface TradeFiltersProps {
  onFiltersChange: (filters: TradeFilters) => void;
  symbolOptions: string[];
  accountOptions: { id: string; name: string; }[];
}

export interface TradeFilters {
  searchTerm: string;
  tradeType: string;
  status: string;
  accountId: string;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
}

const initialFilters: TradeFilters = {
  searchTerm: '',
  tradeType: '',
  status: '',
  accountId: '',
  sortBy: 'entry_date',
  sortDirection: 'desc'
};

export function TradeFilters({ onFiltersChange, accountOptions }: TradeFiltersProps) {
  const [filters, setFilters] = useState<TradeFilters>(initialFilters);

  const updateFilters = (newFilters: Partial<TradeFilters>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);
    onFiltersChange(updated);
  };

  return (
    <div className="w-full space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search trades by symbol, type, or status..."
          value={filters.searchTerm}
          onChange={(e) => updateFilters({ searchTerm: e.target.value })}
          className="pl-10 w-full"
        />
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-4">
        {/* Account Filter */}
        <div className="min-w-[200px]">
          <AccountFilter
            value={filters.accountId || 'all'}
            onValueChange={(value) => updateFilters({ accountId: value === 'all' ? '' : value })}
            placeholder="All accounts"
          />
        </div>

        {/* Status Filter */}
        <div className="min-w-[150px]">
          <Select value={filters.status || 'all'} onValueChange={(value) => updateFilters({ status: value === 'all' ? '' : value })}>
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Trade Type Filter */}
        <div className="min-w-[150px]">
          <Select value={filters.tradeType || 'all'} onValueChange={(value) => updateFilters({ tradeType: value === 'all' ? '' : value })}>
            <SelectTrigger>
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="long">Long</SelectItem>
              <SelectItem value="short">Short</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}