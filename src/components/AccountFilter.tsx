import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, EyeOff, ChevronDown, ChevronRight, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

interface AccountFilterProps {
  value?: string;
  onValueChange?: (value: string) => void;
  values?: string[];
  onValuesChange?: (values: string[]) => void;
  className?: string;
  placeholder?: string;
  multiSelect?: boolean;
}

interface TradingAccount {
  id: string;
  name: string;
  is_active: boolean;
}

export function AccountFilter({ 
  value, 
  onValueChange, 
  values, 
  onValuesChange, 
  className, 
  placeholder = "All accounts", 
  multiSelect = false 
}: AccountFilterProps) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [open, setOpen] = useState(false);

  const selectedValues = multiSelect ? (values || []) : (value ? [value] : []);

  useEffect(() => {
    if (user) {
      fetchAccounts();
    }
  }, [user]);

  const fetchAccounts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('trading_accounts')
        .select('id, name, is_active')
        .eq('user_id', user.id)
        .order('is_active', { ascending: false })
        .order('name');

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      logger.apiError('AccountFilter - fetching trading accounts', error);
    } finally {
      setLoading(false);
    }
  };

  const activeAccounts = accounts.filter(account => account.is_active);
  const inactiveAccounts = accounts.filter(account => !account.is_active);

  const handleSelect = (accountId: string) => {
    if (!multiSelect) {
      onValueChange?.(accountId);
      setOpen(false);
      return;
    }

    const currentValues = values || [];
    if (accountId === 'all') {
      // When "All Active Accounts" is selected, clear other selections
      onValuesChange?.(['all']);
    } else {
      // Remove 'all' if a specific account is being selected
      let newValues = [...currentValues.filter(v => v !== 'all')];
      
      if (newValues.includes(accountId)) {
        // Deselect the account
        newValues = newValues.filter(v => v !== accountId);
      } else {
        // Select the account
        newValues.push(accountId);
      }
      
      // If no accounts are selected, default back to "All Active Accounts"
      if (newValues.length === 0) {
        newValues = ['all'];
      }
      
      onValuesChange?.(newValues);
    }
  };

  const getDisplayText = () => {
    if (!multiSelect) {
      if (!value || value === 'all') return placeholder;
      const account = accounts.find(acc => acc.id === value);
      return account?.name || placeholder;
    }

    const currentValues = values || [];
    if (currentValues.includes('all') || currentValues.length === 0) {
      return placeholder;
    }
    
    if (currentValues.length === 1) {
      const account = accounts.find(acc => acc.id === currentValues[0]);
      return account?.name || placeholder;
    }
    
    return `${currentValues.length} accounts selected`;
  };

  const removeAccount = (accountId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!multiSelect || !values) return;
    
    const newValues = values.filter(v => v !== accountId);
    if (newValues.length === 0) {
      onValuesChange?.(['all']);
    } else {
      onValuesChange?.(newValues);
    }
  };

  if (loading) {
    return (
      <div className={className}>
        <Button variant="outline" disabled className="w-full justify-between">
          Loading...
        </Button>
      </div>
    );
  }

  if (!multiSelect) {
    return (
      <Select value={value || 'all'} onValueChange={onValueChange}>
        <SelectTrigger className={className}>
          <SelectValue placeholder={getDisplayText()} />
        </SelectTrigger>
        <SelectContent className="w-[280px]">
          <SelectItem value="all" className="font-medium hover:bg-white hover:text-black focus:bg-white focus:text-black">
            All accounts
          </SelectItem>
          
          {activeAccounts.length > 0 && (
            <>
              <Separator className="my-1" />
              <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Eye className="h-3 w-3" />
                Active Accounts
              </div>
              {activeAccounts.map((account) => (
                <SelectItem 
                  key={account.id} 
                  value={account.id}
                  className="pl-6 hover:bg-white hover:text-black focus:bg-white focus:text-black"
                >
                  <div className="flex items-center justify-between w-full">
                    <span>{account.name}</span>
                    <Badge variant="secondary" className="ml-2 text-xs bg-primary/10 text-primary border-primary/20">
                      Active
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </>
          )}

          {inactiveAccounts.length > 0 && (
            <>
              <Separator className="my-1" />
              <div 
                className="w-full px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-white hover:text-black cursor-pointer flex items-center gap-2 rounded-sm transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowInactive(!showInactive);
                }}
              >
                {showInactive ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                <EyeOff className="h-3 w-3" />
                Inactive Accounts ({inactiveAccounts.length})
              </div>
              
              {showInactive && inactiveAccounts.map((account) => (
                <SelectItem 
                  key={account.id} 
                  value={account.id}
                  className="pl-8 hover:bg-white hover:text-black focus:bg-white focus:text-black"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-muted-foreground group-hover:text-black">{account.name}</span>
                    <Badge variant="outline" className="ml-2 text-xs border-muted-foreground/30 text-muted-foreground group-hover:text-black group-hover:border-black/30">
                      View Only
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={`w-full justify-between ${className}`}>
          <div className="flex items-center gap-2 flex-1 overflow-hidden">
            {getDisplayText()}
            {multiSelect && values && values.length > 1 && !values.includes('all') && (
              <div className="flex items-center gap-1 ml-2">
                {values.slice(0, 2).map(accountId => {
                  const account = accounts.find(acc => acc.id === accountId);
                  return account ? (
                    <Badge 
                      key={accountId} 
                      variant="secondary" 
                      className="text-xs px-2 py-0 flex items-center gap-1"
                    >
                      {account.name.slice(0, 8)}
                      <X 
                        className="h-3 w-3 cursor-pointer hover:text-destructive" 
                        onClick={(e) => removeAccount(accountId, e)}
                      />
                    </Badge>
                  ) : null;
                })}
                {values.length > 2 && (
                  <Badge variant="outline" className="text-xs px-2 py-0">
                    +{values.length - 2}
                  </Badge>
                )}
              </div>
            )}
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0">
        <Command>
          <CommandInput placeholder="Search accounts..." />
          <CommandList>
            <CommandEmpty>No accounts found.</CommandEmpty>
            <CommandGroup>
              <CommandItem 
                onSelect={() => handleSelect('all')}
                className="cursor-pointer"
              >
                <Checkbox 
                  checked={selectedValues.includes('all')} 
                  className="mr-2"
                />
                All Active Accounts
              </CommandItem>
              
              {activeAccounts.length > 0 && (
                <>
                  <Separator className="my-1" />
                  <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Eye className="h-3 w-3" />
                    Active Accounts
                  </div>
                  {activeAccounts.map((account) => (
                    <CommandItem 
                      key={account.id}
                      onSelect={() => handleSelect(account.id)}
                      className="cursor-pointer pl-6"
                    >
                      <Checkbox 
                        checked={selectedValues.includes(account.id)} 
                        className="mr-2"
                      />
                      <div className="flex items-center justify-between w-full">
                        <span>{account.name}</span>
                        <Badge variant="secondary" className="ml-2 text-xs bg-primary/10 text-primary border-primary/20">
                          Active
                        </Badge>
                      </div>
                    </CommandItem>
                  ))}
                </>
              )}

              {inactiveAccounts.length > 0 && (
                <>
                  <Separator className="my-1" />
                  <div 
                    className="w-full px-2 py-1.5 text-sm font-medium text-muted-foreground cursor-pointer flex items-center gap-2 rounded-sm transition-colors hover:bg-accent"
                    onClick={() => setShowInactive(!showInactive)}
                  >
                    {showInactive ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    <EyeOff className="h-3 w-3" />
                    Inactive Accounts ({inactiveAccounts.length})
                  </div>
                  
                  {showInactive && inactiveAccounts.map((account) => (
                    <CommandItem 
                      key={account.id}
                      onSelect={() => handleSelect(account.id)}
                      className="cursor-pointer pl-8"
                    >
                      <Checkbox 
                        checked={selectedValues.includes(account.id)} 
                        className="mr-2"
                      />
                      <div className="flex items-center justify-between w-full">
                        <span className="text-muted-foreground">{account.name}</span>
                        <Badge variant="outline" className="ml-2 text-xs border-muted-foreground/30 text-muted-foreground">
                          View Only
                        </Badge>
                      </div>
                    </CommandItem>
                  ))}
                </>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}