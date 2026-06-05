import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Plus, Settings, CheckCircle, XCircle, Target, TrendingUp, AlertTriangle, ArrowRight, RotateCcw } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { LoadingCard, LoadingTable } from '@/components/ui/loading-spinner';

interface ConfluenceItem {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  weight: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ChecklistSession {
  checkedItems: Set<string>;
  timestamp: Date;
  symbol?: string;
  direction?: 'long' | 'short';
}

const categories = [
  'Technical Analysis',
  'Fundamental Analysis',
  'Market Structure',
  'Risk Management',
  'Sentiment Analysis',
  'Time-based',
  'Other'
];

const STARTER_CONFLUENCE_ITEMS = [
  { name: 'Risk-Reward Ratio', category: 'Risk Management', weight: 2.5, description: 'Risk-reward ratio is at least 1:2 or better' },
  { name: 'Stop Loss Defined', category: 'Risk Management', weight: 2.0, description: 'Clear stop loss level identified and acceptable' },
  { name: 'Position Size Calculated', category: 'Risk Management', weight: 2.0, description: 'Position size calculated based on risk percentage' }
];

export default function Confluence() {
  const [confluenceItems, setConfluenceItems] = useState<ConfluenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ConfluenceItem | null>(null);
  const [currentSession, setCurrentSession] = useState<ChecklistSession>({
    checkedItems: new Set(),
    timestamp: new Date()
  });
  const [tradeSetup, setTradeSetup] = useState({
    symbol: '',
    direction: '',
    entry: '',
    stopLoss: '',
    takeProfit: '',
    notes: ''
  });
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    weight: 1.0,
    is_active: true
  });
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchConfluenceItems();
    }
  }, [user]);

  const fetchConfluenceItems = async () => {
    try {
      const { data, error } = await supabase
        .from('confluence_items')
        .select('*')
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('weight', { ascending: false });

      if (error) throw error;
      
      if (!data || data.length === 0) {
        await createDefaultItems();
      } else {
        setConfluenceItems(data || []);
      }
    } catch (error) {
      console.error('Error fetching confluence items:', error);
      toast({
        title: "Error",
        description: "Failed to fetch confluence items",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createDefaultItems = async () => {
    try {
      const starterItems = STARTER_CONFLUENCE_ITEMS.map(item => ({
        ...item,
        user_id: user?.id,
        is_active: true
      }));

      const { error } = await supabase
        .from('confluence_items')
        .insert(starterItems);

      if (error) throw error;
      
      fetchConfluenceItems();
      toast({
        title: "Welcome!",
        description: "Starter confluence items have been created. You can customize them anytime!",
      });
    } catch (error) {
      console.error('Error creating starter items:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingItem) {
        const { error } = await supabase
          .from('confluence_items')
          .update({
            name: formData.name,
            category: formData.category || null,
            description: formData.description || null,
            weight: formData.weight,
            is_active: formData.is_active
          })
          .eq('id', editingItem.id)
          .eq('user_id', user?.id);

        if (error) throw error;
        toast({ title: "Success", description: "Confluence item updated" });
      } else {
        const { error } = await supabase
          .from('confluence_items')
          .insert({
            user_id: user?.id,
            name: formData.name,
            category: formData.category || null,
            description: formData.description || null,
            weight: formData.weight,
            is_active: formData.is_active
          });

        if (error) throw error;
        toast({ title: "Success", description: "Confluence item created" });
      }

      setFormData({ name: '', category: '', description: '', weight: 1.0, is_active: true });
      setEditingItem(null);
      setIsDialogOpen(false);
      fetchConfluenceItems();
    } catch (error) {
      console.error('Error saving confluence item:', error);
      toast({
        title: "Error",
        description: "Failed to save confluence item",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (item: ConfluenceItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category || '',
      description: item.description || '',
      weight: Number(item.weight),
      is_active: item.is_active
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this confluence item?')) return;

    try {
      const { error } = await supabase
        .from('confluence_items')
        .delete()
        .eq('id', itemId)
        .eq('user_id', user?.id);

      if (error) throw error;
      toast({ title: "Success", description: "Confluence item deleted" });
      fetchConfluenceItems();
    } catch (error) {
      console.error('Error deleting confluence item:', error);
      toast({
        title: "Error",
        description: "Failed to delete confluence item",
        variant: "destructive"
      });
    }
  };

  const handleItemCheck = (itemId: string, checked: boolean) => {
    const newCheckedItems = new Set(currentSession.checkedItems);
    if (checked) {
      newCheckedItems.add(itemId);
    } else {
      newCheckedItems.delete(itemId);
    }
    
    setCurrentSession({
      ...currentSession,
      checkedItems: newCheckedItems,
      timestamp: new Date()
    });
  };

  const resetChecklist = () => {
    setCurrentSession({
      checkedItems: new Set(),
      timestamp: new Date(),
      symbol: tradeSetup.symbol,
      direction: tradeSetup.direction as 'long' | 'short'
    });
    setTradeSetup({
      symbol: '',
      direction: '',
      entry: '',
      stopLoss: '',
      takeProfit: '',
      notes: ''
    });
  };

  const proceedToTrade = () => {
    const checkedWeight = confluenceItems
      .filter(item => currentSession.checkedItems.has(item.id))
      .reduce((sum, item) => sum + Number(item.weight), 0);
    
    if (checkedWeight < 5) {
      toast({
        title: "Insufficient Confluence",
        description: "You should have at least 5.0 points of confluence before trading",
        variant: "destructive"
      });
      return;
    }

    // Store confluence data in session storage for the new trade page
    sessionStorage.setItem('confluenceData', JSON.stringify({
      checkedItems: Array.from(currentSession.checkedItems),
      totalWeight: checkedWeight,
      setup: tradeSetup
    }));

    navigate('/trades/new');
  };

  const groupedItems = confluenceItems.reduce((acc, item) => {
    const category = item.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, ConfluenceItem[]>);

  const totalWeight = confluenceItems.reduce((sum, item) => sum + Number(item.weight), 0);
  const checkedWeight = confluenceItems
    .filter(item => currentSession.checkedItems.has(item.id))
    .reduce((sum, item) => sum + Number(item.weight), 0);
  const confluenceProgress = totalWeight > 0 ? (checkedWeight / totalWeight) * 100 : 0;
  const checkedCount = currentSession.checkedItems.size;
  const totalCount = confluenceItems.length;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-8 bg-muted rounded w-56 animate-pulse"></div>
              <div className="h-4 bg-muted rounded w-80 animate-pulse"></div>
            </div>
            <div className="flex gap-2">
              <div className="h-10 bg-muted rounded w-32 animate-pulse"></div>
              <div className="h-10 bg-muted rounded w-24 animate-pulse"></div>
            </div>
          </div>
          
          {/* Trade Setup Skeleton */}
          <LoadingCard className="h-48" />
          
          {/* Confluence Score Skeleton */}
          <LoadingCard className="h-40" />
          
          {/* Checklist Items Skeleton */}
          <div className="grid gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <LoadingCard key={i} className="h-64" />
            ))}
          </div>
          
          {/* Action Buttons Skeleton */}
          <LoadingCard className="h-20" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Confluence Checklist</h1>
            <p className="text-muted-foreground">
              Check all confluence factors before placing your trade
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsSettingsOpen(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Manage Items
            </Button>
            <Button variant="outline" onClick={resetChecklist}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>

        {/* Trade Setup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Trade Setup
            </CardTitle>
            <CardDescription>
              Enter your trade details to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="symbol">Symbol</Label>
                <Input
                  id="symbol"
                  placeholder="e.g., EURUSD"
                  value={tradeSetup.symbol}
                  onChange={(e) => setTradeSetup({ ...tradeSetup, symbol: e.target.value.toUpperCase() })}
                />
              </div>
              <div>
                <Label htmlFor="direction">Direction</Label>
                <Select 
                  value={tradeSetup.direction} 
                  onValueChange={(value) => setTradeSetup({ ...tradeSetup, direction: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select direction" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="long">Long (Buy)</SelectItem>
                    <SelectItem value="short">Short (Sell)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="entry">Entry Price</Label>
                <Input
                  id="entry"
                  type="number"
                  step="any"
                  placeholder="0.00000"
                  value={tradeSetup.entry}
                  onChange={(e) => setTradeSetup({ ...tradeSetup, entry: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Confluence Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Confluence Score
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">
                  {checkedWeight.toFixed(1)} / {totalWeight.toFixed(1)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {checkedCount} of {totalCount} items
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={confluenceProgress} className="h-3" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{confluenceProgress.toFixed(1)}%</span>
            </div>
            
            {checkedWeight >= 7 && (
              <div className="flex items-center gap-2 text-profit text-sm">
                <CheckCircle className="h-4 w-4" />
                Excellent confluence! Strong setup detected.
              </div>
            )}
            {checkedWeight >= 5 && checkedWeight < 7 && (
              <div className="flex items-center gap-2 text-yellow-600 text-sm">
                <Target className="h-4 w-4" />
                Good confluence. Consider the trade carefully.
              </div>
            )}
            {checkedWeight < 5 && checkedWeight > 0 && (
              <div className="flex items-center gap-2 text-loss text-sm">
                <AlertTriangle className="h-4 w-4" />
                Low confluence. Consider waiting for a better setup.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Confluence Checklist */}
        <div className="grid gap-6">
          {Object.entries(groupedItems).map(([category, items]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-lg">{category}</CardTitle>
                <CardDescription>
                  {items.filter(item => currentSession.checkedItems.has(item.id)).length} of {items.length} checked
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => handleItemCheck(item.id, !currentSession.checkedItems.has(item.id))}
                    >
                      <Checkbox
                        checked={currentSession.checkedItems.has(item.id)}
                        onCheckedChange={(checked) => handleItemCheck(item.id, checked as boolean)}
                        className="mt-1"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{item.name}</div>
                          <Badge variant="outline" className="ml-2">
                            {Number(item.weight).toFixed(1)}
                          </Badge>
                        </div>
                        {item.description && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {item.description}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Action Buttons */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {checkedWeight >= 5 ? (
                  <span className="text-profit">✓ Sufficient confluence to proceed with trade</span>
                ) : (
                  <span className="text-loss">⚠ Need at least 5.0 points to proceed</span>
                )}
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={resetChecklist}
                >
                  Reset Checklist
                </Button>
                <Button 
                  onClick={proceedToTrade}
                  disabled={checkedWeight < 5 || !tradeSetup.symbol || !tradeSetup.direction}
                  className="gap-2"
                >
                  <TrendingUp className="h-4 w-4" />
                  Proceed to Trade
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Settings Dialog */}
        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manage Confluence Items</DialogTitle>
              <DialogDescription>
                Add, edit, or remove confluence factors for your checklist
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Current Items</h3>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setEditingItem(null);
                      setFormData({ name: '', category: '', description: '', weight: 1.0, is_active: true });
                    }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingItem ? 'Edit' : 'Add'} Confluence Item
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                      <div className="grid gap-4 py-4">
                        <div>
                          <Label htmlFor="name">Name *</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="category">Category</Label>
                          <Select
                            value={formData.category}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((category) => (
                                <SelectItem key={category} value={category}>
                                  {category}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="description">Description</Label>
                          <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="weight">Weight (0.1 - 10.0)</Label>
                          <Input
                            id="weight"
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="10"
                            value={formData.weight}
                            onChange={(e) => setFormData(prev => ({ ...prev, weight: parseFloat(e.target.value) || 1.0 }))}
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={formData.is_active}
                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                          />
                          <Label>Active</Label>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="submit">
                          {editingItem ? 'Update' : 'Create'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {confluenceItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.category} • Weight: {Number(item.weight).toFixed(1)}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(item)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(item.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}