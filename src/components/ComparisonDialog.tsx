import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { BarChart3, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: any[];
  onViewComparison: (comparisonData: ComparisonData) => void;
}

interface ComparisonData {
  compareAcross: 'time' | 'accounts' | 'strategies';
  fromDate?: Date;
  toDate?: Date;
  fromAccount?: string;
  toAccount?: string;
  fromStrategy?: string;
  toStrategy?: string;
  granularity?: 'daily' | 'monthly' | 'yearly';
}

export const ComparisonDialog = ({ open, onOpenChange, accounts, onViewComparison }: ComparisonDialogProps) => {
  const [compareAcross, setCompareAcross] = useState<'time' | 'accounts' | 'strategies'>('time');
  const [fromDate, setFromDate] = useState<Date>();
  const [toDate, setToDate] = useState<Date>();
  const [fromAccount, setFromAccount] = useState<string>('');
  const [toAccount, setToAccount] = useState<string>('');
  const [granularity, setGranularity] = useState<'daily' | 'monthly' | 'yearly'>('monthly');
  const [fromMonth, setFromMonth] = useState<string>('');
  const [fromYear, setFromYear] = useState<string>('');
  const [toMonth, setToMonth] = useState<string>('');
  const [toYear, setToYear] = useState<string>('');

  const handleViewComparison = () => {
    let finalFromDate = fromDate;
    let finalToDate = toDate;
    
    // Convert month/year selections to dates for monthly/yearly granularity
    if (granularity === 'monthly' && fromMonth && fromYear && toMonth && toYear) {
      finalFromDate = new Date(parseInt(fromYear), parseInt(fromMonth) - 1, 1);
      finalToDate = new Date(parseInt(toYear), parseInt(toMonth), 0); // Last day of the month
    } else if (granularity === 'yearly' && fromYear && toYear) {
      finalFromDate = new Date(parseInt(fromYear), 0, 1);
      finalToDate = new Date(parseInt(toYear), 11, 31);
    }
    
    const comparisonData: ComparisonData = {
      compareAcross,
      ...(compareAcross === 'time' && { 
        fromDate: finalFromDate,
        toDate: finalToDate,
        granularity
      }),
      ...(compareAcross === 'accounts' && { fromAccount, toAccount })
    };
    
    onViewComparison(comparisonData);
    onOpenChange(false);
  };

  const renderTimeRangeSection = () => {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 10 }, (_, i) => currentYear - i);
    const months = [
      { value: '1', label: 'January' },
      { value: '2', label: 'February' },
      { value: '3', label: 'March' },
      { value: '4', label: 'April' },
      { value: '5', label: 'May' },
      { value: '6', label: 'June' },
      { value: '7', label: 'July' },
      { value: '8', label: 'August' },
      { value: '9', label: 'September' },
      { value: '10', label: 'October' },
      { value: '11', label: 'November' },
      { value: '12', label: 'December' }
    ];

    if (granularity === 'daily') {
      return (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">From Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !fromDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {fromDate ? format(fromDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-background border z-50" align="start">
                <Calendar
                  mode="single"
                  selected={fromDate}
                  onSelect={setFromDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">To Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !toDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {toDate ? format(toDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-background border z-50" align="start">
                <Calendar
                  mode="single"
                  selected={toDate}
                  onSelect={setToDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      );
    }

    if (granularity === 'monthly') {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">From Period</label>
              <div className="grid grid-cols-2 gap-2">
                <Select value={fromMonth} onValueChange={setFromMonth}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border z-50">
                    {months.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={fromYear} onValueChange={setFromYear}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border z-50">
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">To Period</label>
              <div className="grid grid-cols-2 gap-2">
                <Select value={toMonth} onValueChange={setToMonth}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border z-50">
                    {months.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={toYear} onValueChange={setToYear}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border z-50">
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (granularity === 'yearly') {
      return (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">From Year</label>
            <Select value={fromYear} onValueChange={setFromYear}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50">
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">To Year</label>
            <Select value={toYear} onValueChange={setToYear}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50">
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderAccountsSection = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Comparison from</label>
          <Select value={fromAccount} onValueChange={setFromAccount}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent className="bg-background border z-50">
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Comparison to</label>
          <Select value={toAccount} onValueChange={setToAccount}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent className="bg-background border z-50">
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  const renderStrategiesSection = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Comparison from</label>
          <Select>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Select strategy" />
            </SelectTrigger>
            <SelectContent className="bg-background border z-50">
              <SelectItem value="strategy1">Scalping Strategy</SelectItem>
              <SelectItem value="strategy2">Swing Trading</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Comparison to</label>
          <Select>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Select strategy" />
            </SelectTrigger>
            <SelectContent className="bg-background border z-50">
              <SelectItem value="strategy1">Scalping Strategy</SelectItem>
              <SelectItem value="strategy2">Swing Trading</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Add Comparison
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Compare across</label>
            <Select value={compareAcross} onValueChange={(value: 'time' | 'accounts' | 'strategies') => setCompareAcross(value)}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50">
                <SelectItem value="time">Date Range</SelectItem>
                <SelectItem value="accounts">Accounts</SelectItem>
                <SelectItem value="strategies">Strategies</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {compareAcross === 'time' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Data Granularity</label>
                <Select value={granularity} onValueChange={(value: 'daily' | 'monthly' | 'yearly') => setGranularity(value)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border z-50">
                    <SelectItem value="daily">Daily Data</SelectItem>
                    <SelectItem value="monthly">Monthly Data</SelectItem>
                    <SelectItem value="yearly">Yearly Data</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {renderTimeRangeSection()}
            </div>
          )}
          {compareAcross === 'accounts' && renderAccountsSection()}
          {compareAcross === 'strategies' && renderStrategiesSection()}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleViewComparison}
              disabled={
                (compareAcross === 'time' && granularity === 'daily' && (!fromDate || !toDate)) ||
                (compareAcross === 'time' && granularity === 'monthly' && (!fromMonth || !fromYear || !toMonth || !toYear)) ||
                (compareAcross === 'time' && granularity === 'yearly' && (!fromYear || !toYear)) ||
                (compareAcross === 'accounts' && (!fromAccount || !toAccount)) ||
                (compareAcross === 'strategies' && false) // Add strategy validation when implemented
              }
            >
              View Comparison
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};