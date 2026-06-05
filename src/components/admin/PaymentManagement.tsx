import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, DollarSign, Plus, Settings, RefreshCw } from 'lucide-react';

interface Subscriber {
  id: string;
  user_id: string;
  email: string;
  subscribed: boolean;
  subscription_tier: string | null;
  subscription_end: string | null;
  created_at: string;
  updated_at: string;
}

interface PaymentStats {
  totalSubscribers: number;
  activeSubscriptions: number;
  monthlyRevenue: number;
  cancelledSubscriptions: number;
}

export function PaymentManagement() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [stats, setStats] = useState<PaymentStats>({
    totalSubscribers: 0,
    activeSubscriptions: 0,
    monthlyRevenue: 0,
    cancelledSubscriptions: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isStripeConfigOpen, setIsStripeConfigOpen] = useState(false);
  const [stripeConfig, setStripeConfig] = useState({
    publishableKey: '',
    secretKey: '',
    webhookSecret: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchPaymentData();
  }, []);

  const fetchPaymentData = async () => {
    try {
      setLoading(true);
      
      // Fetch subscribers
      const { data: subscribersData, error: subscribersError } = await supabase
        .from('subscribers')
        .select('id, user_id, email, subscribed, subscription_tier, subscription_end, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (subscribersError) throw subscribersError;

      // Calculate stats
      const totalSubscribers = subscribersData?.length || 0;
      const activeSubscriptions = subscribersData?.filter(s => s.subscribed).length || 0;
      const cancelledSubscriptions = subscribersData?.filter(s => !s.subscribed).length || 0;
      
      // Estimate monthly revenue (this would need actual Stripe data for accuracy)
      const estimatedRevenue = activeSubscriptions * 29.99; // Assuming $29.99/month average

      setSubscribers(subscribersData || []);
      setStats({
        totalSubscribers,
        activeSubscriptions,
        monthlyRevenue: estimatedRevenue,
        cancelledSubscriptions
      });
    } catch (error) {
      console.error('Error fetching payment data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch payment data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const grantPremiumAccess = async (userId: string, email: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ premium_access_override: true })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Premium access granted to ${email}`,
      });

      // Refresh data
      fetchPaymentData();
    } catch (error) {
      console.error('Error granting premium access:', error);
      toast({
        title: 'Error',
        description: 'Failed to grant premium access',
        variant: 'destructive'
      });
    }
  };

  const revokePremiumAccess = async (userId: string, email: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ premium_access_override: false })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Premium access revoked for ${email}`,
      });

      // Refresh data
      fetchPaymentData();
    } catch (error) {
      console.error('Error revoking premium access:', error);
      toast({
        title: 'Error',
        description: 'Failed to revoke premium access',
        variant: 'destructive'
      });
    }
  };

  const filteredSubscribers = subscribers.filter(subscriber =>
    subscriber.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getSubscriptionBadge = (subscriber: Subscriber) => {
    if (subscriber.subscribed) {
      return <Badge variant="default">Active</Badge>;
    }
    return <Badge variant="outline">Free</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Subscribers</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '-' : stats.totalSubscribers}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <Badge className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {loading ? '-' : stats.activeSubscriptions}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '-' : `$${stats.monthlyRevenue.toFixed(2)}`}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {loading ? '-' : stats.cancelledSubscriptions}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Management
            </CardTitle>
            <div className="flex gap-2">
              <Dialog open={isStripeConfigOpen} onOpenChange={setIsStripeConfigOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Settings className="h-4 w-4 mr-2" />
                    Stripe Config
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Stripe Configuration</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="publishableKey">Publishable Key</Label>
                      <Input
                        id="publishableKey"
                        placeholder="pk_test_..."
                        value={stripeConfig.publishableKey}
                        onChange={(e) => setStripeConfig(prev => ({ ...prev, publishableKey: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="secretKey">Secret Key</Label>
                      <Input
                        id="secretKey"
                        type="password"
                        placeholder="sk_test_..."
                        value={stripeConfig.secretKey}
                        onChange={(e) => setStripeConfig(prev => ({ ...prev, secretKey: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="webhookSecret">Webhook Secret</Label>
                      <Input
                        id="webhookSecret"
                        type="password"
                        placeholder="whsec_..."
                        value={stripeConfig.webhookSecret}
                        onChange={(e) => setStripeConfig(prev => ({ ...prev, webhookSecret: e.target.value }))}
                      />
                    </div>
                    <Button className="w-full">
                      Save Configuration
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button onClick={fetchPaymentData}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div>
            <Input
              placeholder="Search subscribers by email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Subscribers Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Subscription End</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      Loading subscribers...
                    </TableCell>
                  </TableRow>
                ) : filteredSubscribers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      No subscribers found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSubscribers.map((subscriber) => (
                    <TableRow key={subscriber.id}>
                      <TableCell className="font-medium">
                        {subscriber.email}
                      </TableCell>
                      <TableCell>
                        {getSubscriptionBadge(subscriber)}
                      </TableCell>
                      <TableCell>
                        {subscriber.subscription_tier ? (
                          <Badge variant="secondary">
                            {subscriber.subscription_tier}
                          </Badge>
                        ) : (
                          'Free'
                        )}
                      </TableCell>
                      <TableCell>
                        {subscriber.subscription_end ? 
                          new Date(subscriber.subscription_end).toLocaleDateString() : 
                          'N/A'
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => grantPremiumAccess(subscriber.user_id, subscriber.email)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Grant Premium
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => revokePremiumAccess(subscriber.user_id, subscriber.email)}
                          >
                            Revoke
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}