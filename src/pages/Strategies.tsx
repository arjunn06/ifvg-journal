import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Target, Edit, Trash2, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { LoadingCard } from '@/components/ui/loading-spinner';
import { useSubscription } from '@/hooks/useSubscription';
import { PremiumFeature } from '@/components/PremiumFeature';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import CriteriaManager from '@/components/CriteriaManager';

interface Strategy {
  id: string;
  name: string;
  description: string;
  rules: string;
  entry_criteria: string;
  exit_criteria: string;
  partial_criteria: string;
  be_criteria: string;
  risk_per_trade: number;
  max_daily_risk: number;
  min_risk_reward: number;
  max_risk_reward: number;
  timeframe: string;
  market_conditions: string;
  is_active: boolean;
  created_at: string;
}

const Strategies = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isPremium } = useSubscription();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    rules: [] as string[],
    entry_criteria: [] as string[],
    exit_criteria: [] as string[],
    partial_criteria: [] as string[],
    be_criteria: [] as string[],
    risk_per_trade: '',
    max_daily_risk: '',
    min_risk_reward: '',
    max_risk_reward: '',
    timeframe: '',
    market_conditions: ''
  });

  // Premium limits for basic users  
  const BASIC_STRATEGY_LIMIT = 3;

  useEffect(() => {
    if (user) {
      fetchStrategies();
    }
  }, [user]);

  const fetchStrategies = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('strategies')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStrategies(data || []);
    } catch (error) {
      console.error('Error fetching strategies:', error);
      toast({
        title: "Error",
        description: "Failed to fetch strategies",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const strategyData = {
        name: formData.name,
        description: formData.description,
        rules: formData.rules.length > 0 ? formData.rules.join('\n') : null,
        entry_criteria: formData.entry_criteria.length > 0 ? formData.entry_criteria.join('\n') : null,
        exit_criteria: formData.exit_criteria.length > 0 ? formData.exit_criteria.join('\n') : null,
        partial_criteria: formData.partial_criteria.length > 0 ? formData.partial_criteria.join('\n') : null,
        be_criteria: formData.be_criteria.length > 0 ? formData.be_criteria.join('\n') : null,
        risk_per_trade: formData.risk_per_trade ? parseFloat(formData.risk_per_trade) : null,
        max_daily_risk: formData.max_daily_risk ? parseFloat(formData.max_daily_risk) : null,
        min_risk_reward: formData.min_risk_reward ? parseFloat(formData.min_risk_reward) : null,
        max_risk_reward: formData.max_risk_reward ? parseFloat(formData.max_risk_reward) : null,
        timeframe: formData.timeframe || null,
        market_conditions: formData.market_conditions || null,
        user_id: user.id
      };

      if (editingStrategy) {
        const { error } = await supabase
          .from('strategies')
          .update(strategyData)
          .eq('id', editingStrategy.id);

        if (error) {
          console.error('Update error details:', error);
          throw error;
        }
        toast({ title: "Success", description: "Strategy updated successfully" });
      } else {
        const { error } = await supabase
          .from('strategies')
          .insert([strategyData]);

        if (error) {
          console.error('Insert error details:', error);
          throw error;
        }
        toast({ title: "Success", description: "Strategy created successfully" });
      }

      setDialogOpen(false);
      setEditingStrategy(null);
      resetForm();
      fetchStrategies();
    } catch (error: any) {
      console.error('Error saving strategy:', error);
      const errorMessage = error?.message || 'Failed to save strategy';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const handleEdit = (strategy: Strategy) => {
    setEditingStrategy(strategy);
    setFormData({
      name: strategy.name,
      description: strategy.description || '',
      rules: strategy.rules ? strategy.rules.split('\n').filter(Boolean) : [],
      entry_criteria: strategy.entry_criteria ? strategy.entry_criteria.split('\n').filter(Boolean) : [],
      exit_criteria: strategy.exit_criteria ? strategy.exit_criteria.split('\n').filter(Boolean) : [],
      partial_criteria: strategy.partial_criteria ? strategy.partial_criteria.split('\n').filter(Boolean) : [],
      be_criteria: strategy.be_criteria ? strategy.be_criteria.split('\n').filter(Boolean) : [],
      risk_per_trade: strategy.risk_per_trade ? strategy.risk_per_trade.toString() : '',
      max_daily_risk: strategy.max_daily_risk ? strategy.max_daily_risk.toString() : '',
      min_risk_reward: strategy.min_risk_reward ? strategy.min_risk_reward.toString() : '',
      max_risk_reward: strategy.max_risk_reward ? strategy.max_risk_reward.toString() : '',
      timeframe: strategy.timeframe || '',
      market_conditions: strategy.market_conditions || ''
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('strategies')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Success", description: "Strategy deleted successfully" });
      fetchStrategies();
    } catch (error) {
      console.error('Error deleting strategy:', error);
      toast({
        title: "Error",
        description: "Failed to delete strategy",
        variant: "destructive"
      });
    }
  };

  const toggleActive = async (strategy: Strategy) => {
    try {
      const { error } = await supabase
        .from('strategies')
        .update({ is_active: !strategy.is_active })
        .eq('id', strategy.id);

      if (error) throw error;
      toast({ 
        title: "Success", 
        description: `Strategy ${!strategy.is_active ? 'activated' : 'deactivated'} successfully` 
      });
      fetchStrategies();
    } catch (error) {
      console.error('Error toggling strategy:', error);
      toast({
        title: "Error",
        description: "Failed to update strategy",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      rules: [],
      entry_criteria: [],
      exit_criteria: [],
      partial_criteria: [],
      be_criteria: [],
      risk_per_trade: '',
      max_daily_risk: '',
      min_risk_reward: '',
      max_risk_reward: '',
      timeframe: '',
      market_conditions: ''
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-8 bg-muted rounded w-40 animate-pulse"></div>
              <div className="h-4 bg-muted rounded w-64 animate-pulse"></div>
            </div>
            <div className="h-10 bg-muted rounded w-40 animate-pulse"></div>
          </div>
          
          {/* Strategies Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <LoadingCard key={i} className="h-40" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Trading Strategies</h1>
            <p className="text-muted-foreground">Create and manage your trading strategies</p>
          </div>
          {!isPremium && strategies.length >= BASIC_STRATEGY_LIMIT ? (
            <PremiumFeature
              feature="Unlimited Strategies"
              description="Basic users can create 3 strategies. Upgrade to premium for unlimited strategies."
              showUpgrade={false}
              fallback={
                <Button disabled variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Upgrade for More Strategies
                </Button>
              }
            />
          ) : (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { resetForm(); setEditingStrategy(null); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Strategy
                </Button>
              </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingStrategy ? 'Edit' : 'Add'} Trading Strategy</DialogTitle>
              <DialogDescription>
                {editingStrategy ? 'Update' : 'Create'} your comprehensive trading strategy
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Strategy Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="timeframe">Timeframe</Label>
                  <Input
                    id="timeframe"
                    placeholder="e.g., 4H, Daily, 15min"
                    value={formData.timeframe}
                    onChange={(e) => setFormData({ ...formData, timeframe: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="market_conditions">Market Conditions</Label>
                <Textarea
                  id="market_conditions"
                  placeholder="Describe when this strategy works best (trending, ranging, volatile markets...)"
                  value={formData.market_conditions}
                  onChange={(e) => setFormData({ ...formData, market_conditions: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CriteriaManager
                  title="Entry Criteria"
                  items={formData.entry_criteria}
                  onItemsChange={(items) => setFormData({ ...formData, entry_criteria: items })}
                  placeholder="Add entry signal..."
                />
                <CriteriaManager
                  title="Exit Criteria"
                  items={formData.exit_criteria}
                  onItemsChange={(items) => setFormData({ ...formData, exit_criteria: items })}
                  placeholder="Add exit condition..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CriteriaManager
                  title="Partial Exit Criteria"
                  items={formData.partial_criteria}
                  onItemsChange={(items) => setFormData({ ...formData, partial_criteria: items })}
                  placeholder="Add partial profit rule..."
                />
                <CriteriaManager
                  title="Break-Even Criteria"
                  items={formData.be_criteria}
                  onItemsChange={(items) => setFormData({ ...formData, be_criteria: items })}
                  placeholder="Add break-even condition..."
                />
              </div>

              <CriteriaManager
                title="Additional Trading Rules"
                items={formData.rules}
                onItemsChange={(items) => setFormData({ ...formData, rules: items })}
                placeholder="Add trading rule..."
              />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="risk_per_trade">Risk Per Trade (%)</Label>
                  <Input
                    id="risk_per_trade"
                    type="number"
                    step="0.1"
                    placeholder="2.0"
                    value={formData.risk_per_trade}
                    onChange={(e) => setFormData({ ...formData, risk_per_trade: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="max_daily_risk">Max Daily Risk (%)</Label>
                  <Input
                    id="max_daily_risk"
                    type="number"
                    step="0.1"
                    placeholder="6.0"
                    value={formData.max_daily_risk}
                    onChange={(e) => setFormData({ ...formData, max_daily_risk: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="min_risk_reward">Min Risk:Reward</Label>
                  <Input
                    id="min_risk_reward"
                    type="number"
                    step="0.1"
                    placeholder="1.5"
                    value={formData.min_risk_reward}
                    onChange={(e) => setFormData({ ...formData, min_risk_reward: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="max_risk_reward">Max Risk:Reward</Label>
                  <Input
                    id="max_risk_reward"
                    type="number"
                    step="0.1"
                    placeholder="3.0"
                    value={formData.max_risk_reward}
                    onChange={(e) => setFormData({ ...formData, max_risk_reward: e.target.value })}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full">
                {editingStrategy ? 'Update' : 'Create'} Strategy
              </Button>
            </form>
            </DialogContent>
          </Dialog>
          )}
        </div>

      {strategies.length === 0 ? (
        <div className="text-center py-12">
          <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No strategies yet</h3>
          <p className="text-muted-foreground mb-4">Create your first trading strategy to organize your approach</p>
          {!isPremium && strategies.length >= BASIC_STRATEGY_LIMIT ? (
            <PremiumFeature
              feature="Unlimited Strategies"
              description="Upgrade to premium to create unlimited trading strategies."
            />
          ) : (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Strategy
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {strategies.map((strategy) => (
            <Card key={strategy.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{strategy.name}</CardTitle>
                  <div className="flex space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/strategies/${strategy.id}/analytics`)}>
                      <BarChart3 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(strategy)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(strategy.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={strategy.is_active ? 'default' : 'secondary'}>
                    {strategy.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleActive(strategy)}
                  >
                    {strategy.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {strategy.description && (
                  <p className="text-sm text-muted-foreground">{strategy.description}</p>
                )}
                
                <div className="space-y-2">
                  {strategy.timeframe && (
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Timeframe:</span>
                      <span className="text-xs font-medium">{strategy.timeframe}</span>
                    </div>
                  )}
                  {strategy.min_risk_reward && strategy.max_risk_reward && (
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Risk:Reward:</span>
                      <span className="text-xs font-medium">1:{strategy.min_risk_reward} - 1:{strategy.max_risk_reward}</span>
                    </div>
                  )}
                </div>

                {strategy.entry_criteria && (
                  <div>
                    <p className="text-sm font-medium mb-1">Entry Criteria:</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{strategy.entry_criteria}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                  {strategy.risk_per_trade && (
                    <div>
                      <p className="text-xs text-muted-foreground">Risk per trade</p>
                      <p className="font-medium">{strategy.risk_per_trade}%</p>
                    </div>
                  )}
                  {strategy.max_daily_risk && (
                    <div>
                      <p className="text-xs text-muted-foreground">Max daily risk</p>
                      <p className="font-medium">{strategy.max_daily_risk}%</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </div>
    </DashboardLayout>
  );
};

export default Strategies;