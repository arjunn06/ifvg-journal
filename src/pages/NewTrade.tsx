import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Calendar } from '@/components/ui/calendar';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useSubscription } from '@/hooks/useSubscription';
import { PremiumFeature } from '@/components/PremiumFeature';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarIcon, Upload, X, ImageIcon, Clock, CheckSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import MistakesManager from '@/components/MistakesManager';

interface TradingAccount {
  id: string;
  name: string;
  currency: string;
  current_balance: number;
}

interface Strategy {
  id: string;
  name: string;
}

interface ConfluenceItem {
  id: string;
  name: string;
  description: string;
  weight: number;
  category: string;
  is_active: boolean;
}

const NewTrade = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isPremium } = useSubscription();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEditing = !!id;
  const isCopying = !!searchParams.get('copy');
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [confluenceItems, setConfluenceItems] = useState<ConfluenceItem[]>([]);
  const [selectedConfluence, setSelectedConfluence] = useState<{[key: string]: boolean}>({});
  const [entryDate, setEntryDate] = useState<Date | undefined>(new Date());
  const [exitDate, setExitDate] = useState<Date | undefined>();
  const [entryTime, setEntryTime] = useState<string>('');
  const [exitTime, setExitTime] = useState<string>('');
  const [includeEntryTime, setIncludeEntryTime] = useState(false);
  const [includeExitTime, setIncludeExitTime] = useState(false);
  const [isClosedTrade, setIsClosedTrade] = useState(false);
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [uploadingScreenshots, setUploadingScreenshots] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [formData, setFormData] = useState({
    symbol: '',
    trade_type: '',
    session: '',
    entry_price: '',
    quantity: '',
    stop_loss: '',
    take_profit: '',
    trading_account_id: '',
    strategy_id: '',
    notes: '',
    emotions: '',
    risk_amount: '',
    risk_reward_ratio: '',
    // Advanced fields
    order_type: '',
    execution_price: '',
    slippage_points: '',
    spread: '',
    commission: '',
    swap: '',
    margin_rate: '',
    filled_volume: '',
    exit_price: '',
    pnl: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const [showConfluenceSection, setShowConfluenceSection] = useState(true);
  const [isPartialExit, setIsPartialExit] = useState(false);
  const [tradeMistakes, setTradeMistakes] = useState<any[]>([]);

  // Auto-calculate PnL when relevant fields change
  useEffect(() => {
    const calculatePnL = () => {
      const entryPrice = parseFloat(formData.entry_price);
      const exitPrice = parseFloat(formData.exit_price);
      const quantity = parseFloat(formData.quantity);
      const commission = parseFloat(formData.commission) || 0;
      const swap = parseFloat(formData.swap) || 0;

      if (entryPrice && exitPrice && quantity && formData.trade_type) {
        let grossPnL = 0;
        
        if (formData.trade_type.toLowerCase() === 'buy') {
          grossPnL = (exitPrice - entryPrice) * quantity;
        } else if (formData.trade_type.toLowerCase() === 'sell') {
          grossPnL = (entryPrice - exitPrice) * quantity;
        }

        // Calculate net PnL including commission and swap
        const netPnL = grossPnL - commission - swap;

        // Only update if the calculated value is different from current
        if (Math.abs(netPnL - parseFloat(formData.pnl || '0')) > 0.001) {
          setFormData(prev => ({
            ...prev,
            pnl: netPnL.toFixed(2)
          }));
        }
      }
    };

    // Only calculate if we have exit price (closed trade)
    if (isClosedTrade && formData.exit_price) {
      calculatePnL();
    }
   }, [formData.entry_price, formData.exit_price, formData.quantity, formData.trade_type, formData.commission, formData.swap, isClosedTrade]);

   // Calculate lot size based on percentage of account balance
   const calculateLotSizeByPercentage = (percentage: number) => {
     const selectedAccount = accounts.find(acc => acc.id === formData.trading_account_id);
     const entryPrice = parseFloat(formData.entry_price);
     
     if (!selectedAccount || !entryPrice || !selectedAccount.current_balance) {
       toast({
         title: "Cannot calculate lot size",
         description: "Please select an account and enter entry price first",
         variant: "destructive"
       });
       return;
     }

     const riskAmount = (selectedAccount.current_balance * percentage) / 100;
     const suggestedLotSize = (riskAmount / entryPrice).toFixed(4);
     
     setFormData({ ...formData, quantity: suggestedLotSize });
     
     toast({
       title: "Lot size calculated",
       description: `${percentage}% of ${selectedAccount.current_balance} ${selectedAccount.currency} = ${suggestedLotSize} lots`,
     });
   };

  useEffect(() => {
    if (user) {
      fetchAccounts();
      fetchStrategies();
      fetchConfluenceItems();
      if (isEditing && id) {
        fetchTrade();
      } else if (isCopying) {
        const copyId = searchParams.get('copy');
        if (copyId) {
          fetchTradeForCopy(copyId);
        }
      }
    }
  }, [user, isEditing, id, isCopying, searchParams]);

  const fetchTrade = async () => {
    if (!user || !id) return;

    try {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      // Populate form with existing trade data
      setFormData({
        symbol: data.symbol || '',
        trade_type: data.trade_type || '',
        session: (data as any).session || '',
        entry_price: data.entry_price?.toString() || '',
        quantity: data.quantity?.toString() || '',
        stop_loss: data.stop_loss?.toString() || '',
        take_profit: data.take_profit?.toString() || '',
        trading_account_id: data.trading_account_id || '',
        strategy_id: data.strategy_id || '',
        notes: data.notes || '',
        emotions: (data as any).emotions || '',
        risk_amount: data.risk_amount?.toString() || '',
        risk_reward_ratio: data.risk_reward_ratio?.toString() || '',
        order_type: data.order_type || '',
        execution_price: data.execution_price?.toString() || '',
        slippage_points: data.slippage_points?.toString() || '',
        spread: data.spread?.toString() || '',
        commission: data.commission?.toString() || '',
        swap: data.swap?.toString() || '',
        margin_rate: data.margin_rate?.toString() || '',
        filled_volume: data.filled_volume?.toString() || '',
        exit_price: data.exit_price?.toString() || '',
        pnl: data.pnl?.toString() || ''
      });

      if (data.entry_date) {
        setEntryDate(new Date(data.entry_date));
        const entryDateObj = new Date(data.entry_date);
        const entryHours = entryDateObj.getHours().toString().padStart(2, '0');
        const entryMinutes = entryDateObj.getMinutes().toString().padStart(2, '0');
        setEntryTime(`${entryHours}:${entryMinutes}`);
        setIncludeEntryTime(true);
      }
      
      if (data.exit_date) {
        setExitDate(new Date(data.exit_date));
        const exitDateObj = new Date(data.exit_date);
        const exitHours = exitDateObj.getHours().toString().padStart(2, '0');
        const exitMinutes = exitDateObj.getMinutes().toString().padStart(2, '0');
        setExitTime(`${exitHours}:${exitMinutes}`);
        setIncludeExitTime(true);
        setIsClosedTrade(true);
      }
      
      // Set closed trade status
      if (data.status === 'closed') {
        setIsClosedTrade(true);
      }

      // Handle existing screenshots for editing
      if (data.screenshots && Array.isArray(data.screenshots)) {
        // For editing, we need to show existing screenshots as already uploaded
        // Create placeholder files to represent existing screenshots
        const existingScreenshots = data.screenshots.map((url, index) => {
          const file = new File([''], `screenshot-${index}.png`, { type: 'image/png' });
          (file as any).url = url; // Add URL to show preview
          return file;
        });
        setScreenshots(existingScreenshots);
      }

      // Fetch confluence data for this trade
      await fetchTradeConfluence(data.id);
    } catch (error) {
      console.error('Error fetching trade:', error);
      toast({
        title: "Error",
        description: "Failed to load trade data",
        variant: "destructive"
      });
      navigate('/trades');
    }
  };

  const fetchTradeForCopy = async (tradeId: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      // Populate form with trade data for copying (but reset some fields)
      setFormData({
        symbol: data.symbol || '',
        trade_type: data.trade_type || '',
        session: (data as any).session || '',
        entry_price: data.entry_price?.toString() || '',
        quantity: data.quantity?.toString() || '',
        stop_loss: data.stop_loss?.toString() || '',
        take_profit: data.take_profit?.toString() || '',
        trading_account_id: '',  // User should select new account
        strategy_id: data.strategy_id || '',
        notes: data.notes ? `Copy of: ${data.notes}` : 'Copied trade',
        emotions: '',
        risk_amount: data.risk_amount?.toString() || '',
        risk_reward_ratio: data.risk_reward_ratio?.toString() || '',
        commission: '',  // Reset these fields
        swap: '',
        slippage_points: data.slippage_points?.toString() || '',
        order_type: data.order_type || '',
        margin_rate: data.margin_rate?.toString() || '',
        filled_volume: data.filled_volume?.toString() || '',
        exit_price: '',  // Reset exit details for copying
        pnl: '',
        execution_price: data.execution_price?.toString() || '',
        spread: data.spread?.toString() || ''
      });

      // Copy exit details if it was a closed trade and user wants them
      if (data.status === 'closed' && data.exit_price && data.pnl !== null) {
        setIsClosedTrade(true);
        setFormData(prev => ({
          ...prev,
          exit_price: data.exit_price?.toString() || '',
          pnl: data.pnl?.toString() || ''
        }));
        if (data.exit_date) {
          setExitDate(new Date(data.exit_date));
        }
      }

      // Set entry date
      if (data.entry_date) {
        setEntryDate(new Date(data.entry_date));
      }

      // Copy screenshots when duplicating
      if (data.screenshots && Array.isArray(data.screenshots)) {
        // For copying, we preserve the screenshot URLs
        const copiedScreenshots = data.screenshots.map((url, index) => {
          const file = new File([''], `screenshot-${index}.png`, { type: 'image/png' });
          (file as any).url = url; // Add URL to show preview
          return file;
        });
        setScreenshots(copiedScreenshots);
      }

    } catch (error) {
      console.error('Error fetching trade for copy:', error);
      toast({
        title: "Error",
        description: "Failed to load trade for copying",
        variant: "destructive"
      });
    }
  };

  const fetchTradeConfluence = async (tradeId: string) => {
    try {
      const { data, error } = await supabase
        .from('trade_confluence')
        .select('confluence_item_id, is_present')
        .eq('trade_id', tradeId);

      if (error) throw error;

      // Set selected confluence items
      const confluenceSelection: {[key: string]: boolean} = {};
      data?.forEach(item => {
        if (item.is_present) {
          confluenceSelection[item.confluence_item_id] = true;
        }
      });
      
      setSelectedConfluence(confluenceSelection);
    } catch (error) {
      console.error('Error fetching trade confluence:', error);
    }
  };

  const fetchAccounts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('trading_accounts')
        .select('id, name, currency, current_balance')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const fetchStrategies = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('strategies')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) throw error;
      setStrategies(data || []);
    } catch (error) {
      console.error('Error fetching strategies:', error);
    }
  };

  const fetchConfluenceItems = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('confluence_items')
        .select('id, name, description, weight, category, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setConfluenceItems(data || []);
    } catch (error) {
      console.error('Error fetching confluence items:', error);
    }
  };

  const calculateRiskReward = () => {
    const entry = parseFloat(formData.entry_price);
    const stopLoss = parseFloat(formData.stop_loss);
    const takeProfit = parseFloat(formData.take_profit);

    if (entry && stopLoss && takeProfit) {
      const risk = Math.abs(entry - stopLoss);
      const reward = Math.abs(takeProfit - entry);
      return reward / risk;
    }
    return 0;
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    // Required fields
    if (!formData.symbol.trim()) {
      errors.symbol = 'Symbol is required';
    }
    if (!formData.trade_type) {
      errors.trade_type = 'Trade type is required';
    }
    if (!formData.entry_price) {
      errors.entry_price = 'Entry price is required';
    } else if (isNaN(parseFloat(formData.entry_price)) || parseFloat(formData.entry_price) <= 0) {
      errors.entry_price = 'Entry price must be a positive number';
    }
    if (!formData.quantity) {
      errors.quantity = 'Quantity is required';
    } else if (isNaN(parseFloat(formData.quantity)) || parseFloat(formData.quantity) <= 0) {
      errors.quantity = 'Quantity must be a positive number';
    }
    if (!formData.trading_account_id) {
      errors.trading_account_id = 'Trading account is required';
    }

    // Closed trade validations
    if (isClosedTrade) {
      if (!exitDate) {
        errors.exit_date = 'Exit date is required for closed trades';
      }
      if (!formData.exit_price) {
        errors.exit_price = 'Exit price is required for closed trades';
      } else if (isNaN(parseFloat(formData.exit_price)) || parseFloat(formData.exit_price) <= 0) {
        errors.exit_price = 'Exit price must be a positive number';
      }
      if (!formData.pnl) {
        errors.pnl = 'P&L is required for closed trades';
      } else if (isNaN(parseFloat(formData.pnl))) {
        errors.pnl = 'P&L must be a valid number';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const isFormValid = () => {
    const requiredFields = ['symbol', 'trade_type', 'entry_price', 'quantity', 'trading_account_id'];
    const hasRequiredFields = requiredFields.every(field => formData[field as keyof typeof formData]?.toString().trim());
    
    if (isClosedTrade) {
      const closedTradeFields = ['exit_price', 'pnl'];
      const hasClosedTradeFields = closedTradeFields.every(field => formData[field as keyof typeof formData]?.toString().trim());
      return hasRequiredFields && hasClosedTradeFields && exitDate;
    }
    
    return hasRequiredFields;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    addFiles(files);
  };

  const addFiles = (files: File[]) => {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length + screenshots.length > 5) {
      toast({
        title: "Too many files",
        description: "You can upload a maximum of 5 screenshots",
        variant: "destructive"
      });
      return;
    }
    
    setScreenshots(prev => [...prev, ...imageFiles]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  };

  const removeScreenshot = (index: number) => {
    setScreenshots(prev => prev.filter((_, i) => i !== index));
  };

  const uploadScreenshots = async (): Promise<string[]> => {
    if (screenshots.length === 0) return [];
    
    setUploadingScreenshots(true);
    const uploadedUrls: string[] = [];
    
    try {
      for (const file of screenshots) {
        // Skip files that already have URLs (existing screenshots)
        if ((file as any).url) {
          uploadedUrls.push((file as any).url);
          continue;
        }
        
        const fileExt = file.name.split('.').pop();
        const fileName = `${user!.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { error } = await supabase.storage
          .from('trade-screenshots')
          .upload(fileName, file);
          
        if (error) throw error;
        
        const { data } = supabase.storage
          .from('trade-screenshots')
          .getPublicUrl(fileName);
          
        uploadedUrls.push(data.publicUrl);
      }
    } catch (error) {
      console.error('Error uploading screenshots:', error);
      throw error;
    } finally {
      setUploadingScreenshots(false);
    }
    
    return uploadedUrls;
  };

  const uploadNewScreenshots = async (newFiles: File[]): Promise<string[]> => {
    if (newFiles.length === 0) return [];
    
    setUploadingScreenshots(true);
    const uploadedUrls: string[] = [];
    
    try {
      for (const file of newFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user!.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { error } = await supabase.storage
          .from('trade-screenshots')
          .upload(fileName, file);
          
        if (error) throw error;
        
        const { data } = supabase.storage
          .from('trade-screenshots')
          .getPublicUrl(fileName);
          
        uploadedUrls.push(data.publicUrl);
      }
    } catch (error) {
      console.error('Error uploading new screenshots:', error);
      throw error;
    } finally {
      setUploadingScreenshots(false);
    }
    
    return uploadedUrls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !entryDate) return;

    if (!validateForm()) {
      toast({
        title: "Form Validation Error",
        description: "Please fix the errors below and try again",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Handle screenshots for editing vs creating
      let screenshotUrls: string[] = [];
      
      if (isEditing) {
        // For editing, preserve existing screenshot URLs and upload only new files
        const existingUrls = screenshots
          .filter(file => (file as any).url) // Files with URLs are existing screenshots
          .map(file => (file as any).url);
        
        const newFiles = screenshots.filter(file => !(file as any).url); // Files without URLs are new
        
        if (newFiles.length > 0) {
          const newUrls = await uploadNewScreenshots(newFiles);
          screenshotUrls = [...existingUrls, ...newUrls];
        } else {
          screenshotUrls = existingUrls;
        }
      } else {
        // For creating new trades, upload all screenshots
        screenshotUrls = await uploadScreenshots();
      }
      
      // Prepare entry date with optional time
      let entryDateWithTime = entryDate;
      if (includeEntryTime && entryTime) {
        const [hours, minutes] = entryTime.split(':');
        entryDateWithTime = new Date(entryDate);
        entryDateWithTime.setHours(parseInt(hours), parseInt(minutes));
      }

      // Prepare exit date with optional time
      let exitDateWithTime = null;
      if (exitDate) {
        exitDateWithTime = exitDate;
        if (includeExitTime && exitTime) {
          const [hours, minutes] = exitTime.split(':');
          exitDateWithTime = new Date(exitDate);
          exitDateWithTime.setHours(parseInt(hours), parseInt(minutes));
        }
      }

      const tradeData = {
        symbol: formData.symbol.toUpperCase(),
        trade_type: formData.trade_type,
        session: formData.session || null,
        entry_price: parseFloat(formData.entry_price),
        quantity: parseFloat(formData.quantity),
        stop_loss: formData.stop_loss ? parseFloat(formData.stop_loss) : null,
        take_profit: formData.take_profit ? parseFloat(formData.take_profit) : null,
        entry_date: entryDateWithTime.toISOString(),
        exit_date: exitDateWithTime ? exitDateWithTime.toISOString() : null,
        trading_account_id: formData.trading_account_id,
        strategy_id: formData.strategy_id || null,
        notes: formData.notes,
        emotions: formData.emotions || null,
        risk_amount: formData.risk_amount ? parseFloat(formData.risk_amount) : null,
        risk_reward_ratio: calculateRiskReward() || null,
        status: isClosedTrade ? 'closed' : 'open',
        user_id: user.id,
        screenshots: screenshotUrls.length > 0 ? screenshotUrls : null,
        // Advanced fields
        order_type: formData.order_type || null,
        execution_price: formData.execution_price ? parseFloat(formData.execution_price) : null,
        slippage_points: formData.slippage_points ? parseFloat(formData.slippage_points) : null,
        spread: formData.spread ? parseFloat(formData.spread) : null,
        commission: formData.commission ? parseFloat(formData.commission) : null,
        swap: formData.swap ? parseFloat(formData.swap) : null,
        margin_rate: formData.margin_rate ? parseFloat(formData.margin_rate) : null,
        filled_volume: formData.filled_volume ? parseFloat(formData.filled_volume) : null,
        exit_price: isClosedTrade && formData.exit_price ? parseFloat(formData.exit_price) : null,
        pnl: isClosedTrade && formData.pnl ? parseFloat(formData.pnl) : null,
        source: 'manual'
      };

      if (isEditing && id) {
        // Update existing trade
        const { data: tradeResult, error } = await supabase
          .from('trades')
          .update(tradeData)
          .eq('id', id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;

        // Handle confluence items
        await handleConfluenceItems(tradeResult.id);

        toast({
          title: "Success",
          description: "Trade updated successfully"
        });
      } else {
        // Create new trade
        const { data: tradeResult, error } = await supabase
          .from('trades')
          .insert([tradeData])
          .select()
          .single();

        if (error) throw error;

        // Handle confluence items
        await handleConfluenceItems(tradeResult.id);

        toast({
          title: "Success",
          description: "Trade created successfully"
        });
      }

      navigate('/trades');
    } catch (error) {
      console.error('Error creating trade:', error);
      toast({
        title: "Error",
        description: "Failed to create trade",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfluenceItems = async (tradeId: string) => {
    const selectedItems = Object.keys(selectedConfluence).filter(itemId => selectedConfluence[itemId]);
    
    if (selectedItems.length === 0) return;

    try {
      // First, delete existing confluence items for this trade (in case of editing)
      if (isEditing) {
        await supabase
          .from('trade_confluence')
          .delete()
          .eq('trade_id', tradeId);
      }

      // Insert new confluence items
      const confluenceData = selectedItems.map(itemId => ({
        trade_id: tradeId,
        confluence_item_id: itemId,
        is_present: true
      }));

      const { error } = await supabase
        .from('trade_confluence')
        .insert(confluenceData);

      if (error) throw error;
    } catch (error) {
      console.error('Error handling confluence items:', error);
    }
  };

  if (accounts.length === 0) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
        <h1 className="text-3xl font-bold">New Trade</h1>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <h3 className="text-lg font-medium mb-2">No Trading Accounts Found</h3>
              <p className="text-muted-foreground mb-4">You need to create a trading account before adding trades</p>
              <Button onClick={() => navigate('/accounts')}>
                Create Trading Account
              </Button>
            </div>
          </CardContent>
        </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="w-full space-y-6 overflow-hidden">
        <div className="px-2 sm:px-0 hidden lg:block">
          <h1 className="text-3xl font-bold">{isEditing ? 'Edit Trade' : 'New Trade'}</h1>
          <p className="text-muted-foreground">{isEditing ? 'Update trading position details' : 'Record a new trading position'}</p>
        </div>

        <div className="w-full max-w-4xl mx-auto">
          <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Trade Details</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-8 w-full overflow-hidden">
            {/* 1. ACCOUNT & BASIC SETUP */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold border-b pb-2">Account & Basic Setup</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="trading_account" className="flex items-center gap-1 text-sm font-medium">
                    Trading Account <span className="text-destructive">*</span>
                  </Label>
                  <Select 
                    value={formData.trading_account_id} 
                    onValueChange={(value) => {
                      setFormData({ ...formData, trading_account_id: value });
                      if (formErrors.trading_account_id) {
                        setFormErrors({ ...formErrors, trading_account_id: '' });
                      }
                    }}
                  >
                    <SelectTrigger className={formErrors.trading_account_id ? 'border-destructive focus:ring-destructive' : ''}>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} ({account.currency})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.trading_account_id && (
                    <p className="text-sm text-destructive mt-1">{formErrors.trading_account_id}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="symbol" className="flex items-center gap-1 text-sm font-medium">
                    Symbol <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="symbol"
                    placeholder="e.g., EURUSD, AAPL"
                    value={formData.symbol}
                    onChange={(e) => {
                      setFormData({ ...formData, symbol: e.target.value });
                      if (formErrors.symbol) {
                        setFormErrors({ ...formErrors, symbol: '' });
                      }
                    }}
                    className={formErrors.symbol ? 'border-destructive focus-visible:ring-destructive' : ''}
                    required
                  />
                  {formErrors.symbol && (
                    <p className="text-sm text-destructive mt-1">{formErrors.symbol}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trade_type" className="flex items-center gap-1 text-sm font-medium">
                    Trade Type <span className="text-destructive">*</span>
                  </Label>
                  <Select 
                    value={formData.trade_type} 
                    onValueChange={(value) => {
                      setFormData({ ...formData, trade_type: value });
                      if (formErrors.trade_type) {
                        setFormErrors({ ...formErrors, trade_type: '' });
                      }
                    }}
                  >
                    <SelectTrigger className={formErrors.trade_type ? 'border-destructive focus:ring-destructive' : ''}>
                      <SelectValue placeholder="Select trade type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="long">Long (Buy)</SelectItem>
                      <SelectItem value="short">Short (Sell)</SelectItem>
                    </SelectContent>
                  </Select>
                  {formErrors.trade_type && (
                    <p className="text-sm text-destructive mt-1">{formErrors.trade_type}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="session" className="text-sm font-medium">Trading Session</Label>
                  <Select 
                    value={formData.session} 
                    onValueChange={(value) => setFormData({ ...formData, session: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select trading session" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asia">Asia</SelectItem>
                      <SelectItem value="london">London</SelectItem>
                      <SelectItem value="new-york-am">New York AM</SelectItem>
                      <SelectItem value="new-york-lunch">New York Lunch</SelectItem>
                      <SelectItem value="new-york-pm">New York PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="strategy" className="text-sm font-medium">Strategy (Optional)</Label>
                  <Select value={formData.strategy_id} onValueChange={(value) => setFormData({ ...formData, strategy_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select strategy" />
                    </SelectTrigger>
                    <SelectContent>
                      {strategies.map((strategy) => (
                        <SelectItem key={strategy.id} value={strategy.id}>
                          {strategy.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* 2. POSITION & ENTRY DETAILS */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold border-b pb-2">Position & Entry Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="entry_price" className="flex items-center gap-1 text-sm font-medium">
                    Entry Price <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="entry_price"
                    type="number"
                    step="any"
                    value={formData.entry_price}
                    onChange={(e) => {
                      setFormData({ ...formData, entry_price: e.target.value });
                      if (formErrors.entry_price) {
                        setFormErrors({ ...formErrors, entry_price: '' });
                      }
                    }}
                    className={formErrors.entry_price ? 'border-destructive focus-visible:ring-destructive' : ''}
                    required
                  />
                  {formErrors.entry_price && (
                    <p className="text-sm text-destructive mt-1">{formErrors.entry_price}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity" className="flex items-center gap-1 text-sm font-medium">
                    Quantity/Lot Size <span className="text-destructive">*</span>
                  </Label>
                  
                  {/* Percentage buttons for quick lot size calculation */}
                  <div className="flex gap-2 mb-2">
                    <span className="text-xs text-muted-foreground self-center">Quick %:</span>
                    {[1, 2, 5, 10].map((percentage) => (
                      <Button
                        key={percentage}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => calculateLotSizeByPercentage(percentage)}
                        className="text-xs px-2 py-1 h-7"
                        disabled={!formData.trading_account_id || !formData.entry_price}
                      >
                        {percentage}%
                      </Button>
                    ))}
                  </div>
                  
                  <Input
                    id="quantity"
                    type="number"
                    step="any"
                    value={formData.quantity}
                    onChange={(e) => {
                      setFormData({ ...formData, quantity: e.target.value });
                      if (formErrors.quantity) {
                        setFormErrors({ ...formErrors, quantity: '' });
                      }
                    }}
                    className={formErrors.quantity ? 'border-destructive focus-visible:ring-destructive' : ''}
                    required
                  />
                  {formErrors.quantity && (
                    <p className="text-sm text-destructive mt-1">{formErrors.quantity}</p>
                  )}
                  {formData.trading_account_id && (
                    <p className="text-xs text-muted-foreground">
                      Click percentage buttons to auto-calculate lot size based on account balance
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Entry Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal text-sm"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                        <span className="truncate">
                          {entryDate ? format(entryDate, "PPP") : "Pick a date"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={entryDate}
                        onSelect={setEntryDate}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Entry Time</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include-entry-time"
                      checked={includeEntryTime}
                      onCheckedChange={(checked) => setIncludeEntryTime(checked === true)}
                    />
                    <Label htmlFor="include-entry-time" className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4" />
                      Include specific entry time
                    </Label>
                  </div>
                  
                  {includeEntryTime && (
                    <Input
                      id="entry-time"
                      type="time"
                      value={entryTime}
                      onChange={(e) => setEntryTime(e.target.value)}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* 3. RISK MANAGEMENT */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold border-b pb-2">Risk Management</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="stop_loss" className="text-sm font-medium">Stop Loss</Label>
                  <Input
                    id="stop_loss"
                    type="number"
                    step="any"
                    value={formData.stop_loss}
                    onChange={(e) => setFormData({ ...formData, stop_loss: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="take_profit" className="text-sm font-medium">Take Profit</Label>
                  <Input
                    id="take_profit"
                    type="number"
                    step="any"
                    value={formData.take_profit}
                    onChange={(e) => setFormData({ ...formData, take_profit: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="risk_amount" className="text-sm font-medium">Risk Amount</Label>
                  <Input
                    id="risk_amount"
                    type="number"
                    step="0.01"
                    placeholder="Amount at risk"
                    value={formData.risk_amount}
                    onChange={(e) => setFormData({ ...formData, risk_amount: e.target.value })}
                  />
                </div>
              </div>

              {calculateRiskReward() > 0 && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Risk/Reward Ratio: <span className="font-medium">{calculateRiskReward().toFixed(2)}:1</span>
                  </p>
                </div>
              )}
            </div>

            {/* Trade Status Section */}
            <div className="border rounded-lg p-4 bg-muted/20">
              <div className="flex items-center space-x-2 mb-3">
                <Checkbox
                  id="is-closed-trade"
                  checked={isClosedTrade}
                  onCheckedChange={(checked) => setIsClosedTrade(checked === true)}
                />
                <Label htmlFor="is-closed-trade" className="font-medium">
                  This trade is closed
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Check this if you want to record a completed trade with P&L details
              </p>
            </div>

            {calculateRiskReward() > 0 && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Risk/Reward Ratio: <span className="font-medium">{calculateRiskReward().toFixed(2)}:1</span>
                </p>
              </div>
            )}

            {/* Advanced Fields Toggle */}
            <div className="border-t pt-6">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowAdvancedFields(!showAdvancedFields)}
                className="flex items-center gap-2"
              >
                {showAdvancedFields ? 'Hide' : 'Show'} Advanced Fields
                <span className="text-xs text-muted-foreground">
                  (Order type, execution details, spreads, etc.)
                </span>
              </Button>
            </div>

            {/* Advanced Fields Section */}
            {showAdvancedFields && (
              <div className="border rounded-lg p-6 bg-muted/30">
                <h3 className="text-lg font-medium mb-4">Advanced Trade Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="order_type">Order Type</Label>
                    <Select value={formData.order_type} onValueChange={(value) => setFormData({ ...formData, order_type: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select order type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MARKET">Market Order</SelectItem>
                        <SelectItem value="LIMIT">Limit Order</SelectItem>
                        <SelectItem value="STOP">Stop Order</SelectItem>
                        <SelectItem value="STOP_LIMIT">Stop Limit</SelectItem>
                        <SelectItem value="MARKET_RANGE">Market Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="execution_price">Execution Price</Label>
                    <Input
                      id="execution_price"
                      type="number"
                      step="any"
                      placeholder="Actual execution price"
                      value={formData.execution_price}
                      onChange={(e) => setFormData({ ...formData, execution_price: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      If different from entry price (for market orders with slippage)
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="slippage_points">Slippage (Points)</Label>
                    <Input
                      id="slippage_points"
                      type="number"
                      step="0.1"
                      placeholder="Price slippage in points"
                      value={formData.slippage_points}
                      onChange={(e) => setFormData({ ...formData, slippage_points: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="spread">Spread (Points)</Label>
                    <Input
                      id="spread"
                      type="number"
                      step="0.1"
                      placeholder="Bid-ask spread"
                      value={formData.spread}
                      onChange={(e) => setFormData({ ...formData, spread: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="commission">Commission</Label>
                    <Input
                      id="commission"
                      type="number"
                      step="0.01"
                      placeholder="Commission paid"
                      value={formData.commission}
                      onChange={(e) => setFormData({ ...formData, commission: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="swap">Swap/Rollover</Label>
                    <Input
                      id="swap"
                      type="number"
                      step="0.01"
                      placeholder="Overnight swap fees"
                      value={formData.swap}
                      onChange={(e) => setFormData({ ...formData, swap: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="margin_rate">Margin Rate (%)</Label>
                    <Input
                      id="margin_rate"
                      type="number"
                      step="0.01"
                      placeholder="Required margin percentage"
                      value={formData.margin_rate}
                      onChange={(e) => setFormData({ ...formData, margin_rate: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="filled_volume">Filled Volume</Label>
                    <Input
                      id="filled_volume"
                      type="number"
                      step="any"
                      placeholder="Actually filled amount"
                      value={formData.filled_volume}
                      onChange={(e) => setFormData({ ...formData, filled_volume: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      For partial fills, enter the actual filled amount
                    </p>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> These advanced fields provide more detailed trade analysis. 
                    Manual entry is optional.
                  </p>
                </div>
              </div>
            )}

            {/* Exit Details */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold border-b pb-2">Exit Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1 text-sm font-medium">
                    Exit Date {isClosedTrade && <span className="text-destructive">*</span>}
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`w-full justify-start text-left font-normal text-sm ${formErrors.exit_date ? 'border-destructive' : ''}`}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                        <span className="truncate">
                          {exitDate ? format(exitDate, "PPP") : 
                            isClosedTrade ? "Pick exit date (required)" : "Pick exit date (optional)"
                          }
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={exitDate}
                        onSelect={(date) => {
                          setExitDate(date);
                          if (formErrors.exit_date) {
                            setFormErrors({ ...formErrors, exit_date: '' });
                          }
                        }}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  {formErrors.exit_date && (
                    <p className="text-sm text-destructive mt-1">{formErrors.exit_date}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Exit Time</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include-exit-time"
                      checked={includeExitTime}
                      onCheckedChange={(checked) => setIncludeExitTime(checked === true)}
                    />
                    <Label htmlFor="include-exit-time" className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4" />
                      Include specific exit time
                    </Label>
                  </div>
                  
                  {includeExitTime && (
                    <Input
                      id="exit-time"
                      type="time"
                      value={exitTime}
                      onChange={(e) => setExitTime(e.target.value)}
                    />
                  )}
                </div>

                {/* Partial Exit Checkbox */}
                <div className="col-span-full">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is-partial-exit"
                      checked={isPartialExit}
                      onCheckedChange={(checked) => setIsPartialExit(checked === true)}
                    />
                    <Label htmlFor="is-partial-exit" className="text-sm font-medium">
                      This is a partial exit
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Check this if you only closed part of your position
                  </p>
                </div>

                {/* P&L Details for Closed Trades */}
                {isClosedTrade && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="exit_price" className="flex items-center gap-1 text-sm font-medium">
                        Exit Price <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="exit_price"
                        type="number"
                        step="any"
                        placeholder="Exit price"
                        value={formData.exit_price}
                        onChange={(e) => {
                          setFormData({ ...formData, exit_price: e.target.value });
                          if (formErrors.exit_price) {
                            setFormErrors({ ...formErrors, exit_price: '' });
                          }
                        }}
                        className={formErrors.exit_price ? 'border-destructive focus-visible:ring-destructive' : ''}
                        required={isClosedTrade}
                      />
                      {formErrors.exit_price && (
                        <p className="text-sm text-destructive mt-1">{formErrors.exit_price}</p>
                      )}
                    </div>

                    {isPartialExit && (
                      <div className="space-y-2">
                        <Label htmlFor="exit_quantity" className="flex items-center gap-1 text-sm font-medium">
                          Exit Quantity <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="exit_quantity"
                          type="number"
                          step="any"
                          placeholder="Quantity closed"
                          className="border-orange-300 focus-visible:ring-orange-500"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Enter the quantity/lot size that was closed
                        </p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="pnl" className="flex items-center gap-1 text-sm font-medium">
                        Profit/Loss <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="pnl"
                        type="number"
                        step="0.01"
                        placeholder="P&L amount"
                        value={formData.pnl}
                        onChange={(e) => {
                          setFormData({ ...formData, pnl: e.target.value });
                          if (formErrors.pnl) {
                            setFormErrors({ ...formErrors, pnl: '' });
                          }
                        }}
                        className={formErrors.pnl ? 'border-destructive focus-visible:ring-destructive' : ''}
                        required={isClosedTrade}
                      />
                      {formErrors.pnl && (
                        <p className="text-sm text-destructive mt-1">{formErrors.pnl}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {isPartialExit 
                          ? 'Enter P&L for the partial exit only' 
                          : 'Enter positive for profit, negative for loss'
                        }
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Trading Psychology */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold border-b pb-2">Trading Psychology</h3>
              <div className="space-y-2">
                <Label htmlFor="emotions" className="text-sm font-medium">Emotions (Optional)</Label>
                <Select value={formData.emotions} onValueChange={(value) => setFormData({ ...formData, emotions: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="How did you feel during this trade?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confident">Confident</SelectItem>
                    <SelectItem value="nervous">Nervous</SelectItem>
                    <SelectItem value="excited">Excited</SelectItem>
                    <SelectItem value="fearful">Fearful</SelectItem>
                    <SelectItem value="greedy">Greedy</SelectItem>
                    <SelectItem value="patient">Patient</SelectItem>
                    <SelectItem value="impatient">Impatient</SelectItem>
                    <SelectItem value="calm">Calm</SelectItem>
                    <SelectItem value="stressed">Stressed</SelectItem>
                    <SelectItem value="doubtful">Doubtful</SelectItem>
                    <SelectItem value="focused">Focused</SelectItem>
                    <SelectItem value="distracted">Distracted</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Trade rationale, setup details, etc."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                />
              </div>
            </div>

            {/* Confluence Checklist */}
            {confluenceItems.length > 0 && (
              <div className="space-y-6">
                <div 
                  className="flex items-center justify-between cursor-pointer border-b pb-2"
                  onClick={() => setShowConfluenceSection(!showConfluenceSection)}
                >
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <CheckSquare className="w-5 h-5" />
                    Confluence Checklist (Optional)
                  </h3>
                  {showConfluenceSection ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                  )}
                </div>
                
                {showConfluenceSection && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Select the confluence factors that apply to this trade setup
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {confluenceItems.reduce((acc, item) => {
                      const category = item.category || 'General';
                      if (!acc[category]) acc[category] = [];
                      acc[category].push(item);
                      return acc;
                    }, {} as Record<string, ConfluenceItem[]>)
                    && Object.entries(
                      confluenceItems.reduce((acc, item) => {
                        const category = item.category || 'General';
                        if (!acc[category]) acc[category] = [];
                        acc[category].push(item);
                        return acc;
                      }, {} as Record<string, ConfluenceItem[]>)
                    ).map(([category, items]) => (
                      <div key={category} className="space-y-3">
                        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                          {category}
                        </h4>
                        <div className="space-y-2">
                          {items.map((item) => (
                            <div key={item.id} className="flex items-start space-x-2 p-2 border rounded-lg hover:bg-muted/30 transition-colors">
                              <Checkbox
                                id={`confluence-${item.id}`}
                                checked={selectedConfluence[item.id] || false}
                                onCheckedChange={(checked) => {
                                  setSelectedConfluence(prev => ({
                                    ...prev,
                                    [item.id]: checked === true
                                  }));
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <Label 
                                  htmlFor={`confluence-${item.id}`}
                                  className="text-sm font-medium cursor-pointer"
                                >
                                  {item.name}
                                  <span className="ml-1 text-xs text-muted-foreground">
                                    ({item.weight}pts)
                                  </span>
                                </Label>
                                {item.description && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {Object.keys(selectedConfluence).some(key => selectedConfluence[key]) && (
                    <div className="p-4 bg-muted/30 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Selected Confluence Score:</span>
                        <span className="font-bold text-primary">
                          {confluenceItems
                            .filter(item => selectedConfluence[item.id])
                            .reduce((sum, item) => sum + item.weight, 0)
                            .toFixed(1)} points
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Selected: {Object.keys(selectedConfluence).filter(key => selectedConfluence[key]).length} factors
                      </p>
                    </div>
                  )}

                  {confluenceItems.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground">
                      <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No confluence items found</p>
                      <p className="text-xs">Create confluence factors in the Confluence page first</p>
                    </div>
                  )}
                  </div>
                )}
              </div>
            )}

            {/* Chart Screenshots */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold border-b pb-2">Chart Screenshots</h3>
              <div className="space-y-2">
                <Label htmlFor="screenshots" className="text-sm font-medium">Chart Screenshots (Optional)</Label>
                <PremiumFeature
                  feature="Chart Screenshots"
                  description="Upload and save chart screenshots with your trades. Available in premium plan only."
                  fallback={
                    <div className="flex items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/30">
                      <div className="flex flex-col items-center justify-center text-center">
                        <ImageIcon className="w-8 h-8 mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground mb-3">
                          Chart screenshots available in <span className="font-semibold">Premium</span>
                        </p>
                        <Button size="sm" variant="outline" onClick={() => navigate('/')}>
                          Upgrade to Premium
                        </Button>
                      </div>
                    </div>
                  }
                >
                  <div 
                    className={`relative w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                      isDragging 
                        ? 'border-primary bg-primary/10' 
                        : 'border-muted-foreground/30 bg-muted/20 hover:bg-muted/30'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('screenshot-upload')?.click()}
                  >
                    <div className="flex flex-col items-center justify-center h-full">
                      <Upload className={`w-8 h-8 mb-2 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                      <p className={`text-sm font-medium ${isDragging ? 'text-primary' : 'text-muted-foreground'}`}>
                        {isDragging ? 'Drop files here' : 'Drag & drop or click to upload'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PNG, JPG, GIF up to 5 files
                      </p>
                    </div>
                    <input
                      id="screenshot-upload"
                      type="file"
                      className="hidden"
                      multiple
                      accept="image/*"
                      onChange={handleFileChange}
                    />
                  </div>
                  
                  {screenshots.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm text-muted-foreground mb-3">
                        {screenshots.length} file{screenshots.length > 1 ? 's' : ''} selected
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {screenshots.map((file, index) => (
                          <div key={index} className="relative group">
                            <div className="aspect-square bg-muted rounded-lg overflow-hidden border">
                              <img
                                src={URL.createObjectURL(file)}
                                alt={`Screenshot ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeScreenshot(index)}
                              className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <div className="absolute bottom-2 left-2 bg-background/90 text-foreground text-xs px-2 py-1 rounded backdrop-blur-sm">
                              {file.name.length > 15 ? file.name.substring(0, 15) + '...' : file.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </PremiumFeature>
              </div>
            </div>

            {/* Mistakes Section */}
            <MistakesManager 
              tradeId={isEditing ? id : undefined}
              mistakes={tradeMistakes}
              onMistakesChange={setTradeMistakes}
            />

            <div className="flex space-x-4">
              <Button 
                type="submit" 
                disabled={loading || uploadingScreenshots || !isFormValid()}
                className="min-w-[120px]"
              >
                {loading ? (uploadingScreenshots ? 'Uploading Screenshots...' : (isEditing ? 'Updating...' : 'Creating...')) : (isEditing ? 'Update Trade' : 'Create Trade')}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/trades')}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default NewTrade;