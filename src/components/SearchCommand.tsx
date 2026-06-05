import { useState, useEffect } from 'react';
import { Search, Calculator, Calendar, FileText, TrendingUp, Settings, Users, DollarSign, BarChart3 } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
  keywords?: string[];
}

export function SearchCommand() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const searchResults: SearchResult[] = [
    // Navigation
    {
      id: 'dashboard',
      title: 'Dashboard',
      description: 'View your trading overview and statistics',
      url: '/dashboard',
      icon: TrendingUp,
      category: 'Navigation',
      keywords: ['overview', 'stats', 'performance', 'home']
    },
    {
      id: 'trades',
      title: 'Trades',
      description: 'Manage and view your trading history',
      url: '/trades',
      icon: DollarSign,
      category: 'Navigation',
      keywords: ['trading', 'history', 'positions', 'orders']
    },
    {
      id: 'calendar',
      title: 'Calendar',
      description: 'View trading calendar and performance by date',
      url: '/calendar',
      icon: Calendar,
      category: 'Navigation',
      keywords: ['dates', 'schedule', 'timeline']
    },
    {
      id: 'notes',
      title: 'Notes',
      description: 'Trading notes and journal entries',
      url: '/notes',
      icon: FileText,
      category: 'Navigation',
      keywords: ['journal', 'thoughts', 'analysis']
    },
    {
      id: 'strategies',
      title: 'Strategies',
      description: 'Manage your trading strategies',
      url: '/strategies',
      icon: Calculator,
      category: 'Navigation',
      keywords: ['plans', 'methods', 'systems']
    },
    {
      id: 'accounts',
      title: 'Trading Accounts',
      description: 'Manage your trading accounts',
      url: '/accounts',
      icon: Users,
      category: 'Navigation',
      keywords: ['brokers', 'balance', 'equity']
    },
    {
      id: 'reports',
      title: 'Weekly Reports',
      description: 'View detailed weekly trading reports',
      url: '/reports',
      icon: BarChart3,
      category: 'Navigation',
      keywords: ['analytics', 'performance', 'weekly', 'summary']
    },
    
    // Quick Actions
    {
      id: 'new-trade',
      title: 'Add New Trade',
      description: 'Record a new trading position',
      url: '/trades/new',
      icon: DollarSign,
      category: 'Quick Actions',
      keywords: ['create', 'record', 'position', 'entry']
    },
    {
      id: 'new-note',
      title: 'Add Trading Note',
      description: 'Create a new journal entry',
      url: '/notes/new',
      icon: FileText,
      category: 'Quick Actions',
      keywords: ['write', 'journal', 'record', 'thoughts']
    },
    
    // Settings
    {
      id: 'settings',
      title: 'Settings',
      description: 'Application preferences and configuration',
      url: '/settings',
      icon: Settings,
      category: 'Settings',
      keywords: ['preferences', 'config', 'profile']
    }
  ];

  const filteredResults = searchResults.filter(result => {
    if (!query) return true;
    
    const searchTerm = query.toLowerCase();
    const matchesTitle = result.title.toLowerCase().includes(searchTerm);
    const matchesDescription = result.description?.toLowerCase().includes(searchTerm);
    const matchesKeywords = result.keywords?.some(keyword => 
      keyword.toLowerCase().includes(searchTerm)
    );
    
    return matchesTitle || matchesDescription || matchesKeywords;
  });

  const groupedResults = filteredResults.reduce((acc, result) => {
    if (!acc[result.category]) {
      acc[result.category] = [];
    }
    acc[result.category].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  const handleSelect = (url: string) => {
    setOpen(false);
    setQuery('');
    navigate(url);
  };

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-9 p-0 xl:h-10 xl:w-60 xl:justify-start xl:px-3 xl:py-2"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4 xl:mr-2" />
        <span className="hidden xl:inline-flex">Search...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-2 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 xl:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
          placeholder="Search for pages, features, or actions..." 
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          
          {Object.entries(groupedResults).map(([category, results], index) => (
            <div key={category}>
              <CommandGroup heading={category}>
                {results.map((result) => (
                  <CommandItem
                    key={result.id}
                    value={result.title}
                    onSelect={() => handleSelect(result.url)}
                    className="flex items-center gap-3 px-3 py-2"
                  >
                    <result.icon className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 overflow-hidden">
                      <div className="font-medium">{result.title}</div>
                      {result.description && (
                        <div className="text-xs text-muted-foreground truncate">
                          {result.description}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              {index < Object.entries(groupedResults).length - 1 && <CommandSeparator />}
            </div>
          ))}
          
          {query && filteredResults.length === 0 && (
            <CommandGroup heading="No results">
              <CommandItem disabled>
                <Search className="h-4 w-4 mr-3 text-muted-foreground" />
                <span className="text-muted-foreground">
                  No results found for "{query}"
                </span>
              </CommandItem>
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}