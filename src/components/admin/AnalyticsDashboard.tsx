import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { BarChart3, Activity, AlertTriangle, Eye, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AnalyticsEvent {
  id: string;
  event_type: string;
  event_data: any;
  user_id: string | null;
  session_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface AnalyticsStats {
  totalEvents: number;
  uniqueUsers: number;
  crashEvents: number;
  pageViews: number;
}

export function AnalyticsDashboard() {
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [stats, setStats] = useState<AnalyticsStats>({
    totalEvents: 0,
    uniqueUsers: 0,
    crashEvents: 0,
    pageViews: 0
  });
  const [loading, setLoading] = useState(true);
  const [eventFilter, setEventFilter] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchAnalytics();
  }, [eventFilter]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // Fetch analytics events
      let query = supabase
        .from('app_analytics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (eventFilter !== 'all') {
        query = query.eq('event_type', eventFilter);
      }

      const { data: eventsData, error: eventsError } = await query;
      if (eventsError) throw eventsError;

      // Fetch stats
      const { data: totalEvents } = await supabase
        .from('app_analytics')
        .select('id', { count: 'exact' });

      const { data: uniqueUsers } = await supabase
        .from('app_analytics')
        .select('user_id')
        .not('user_id', 'is', null);

      const { data: crashEvents } = await supabase
        .from('app_analytics')
        .select('id', { count: 'exact' })
        .or('event_type.eq.error,event_type.eq.crash');

      const { data: pageViews } = await supabase
        .from('app_analytics')
        .select('id', { count: 'exact' })
        .eq('event_type', 'page_view');

      const uniqueUserIds = new Set(uniqueUsers?.map(u => u.user_id) || []);

      setEvents(eventsData || []);
      setStats({
        totalEvents: totalEvents?.length || 0,
        uniqueUsers: uniqueUserIds.size,
        crashEvents: crashEvents?.length || 0,
        pageViews: pageViews?.length || 0
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch analytics data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getEventBadgeVariant = (eventType: string) => {
    switch (eventType) {
      case 'error':
      case 'crash':
        return 'destructive';
      case 'page_view':
        return 'default';
      case 'user_action':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatEventData = (data: any) => {
    if (!data) return 'N/A';
    if (typeof data === 'string') return data;
    return JSON.stringify(data, null, 2);
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '-' : stats.totalEvents}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '-' : stats.uniqueUsers}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Crash Events</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {loading ? '-' : stats.crashEvents}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Page Views</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '-' : stats.pageViews}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Events Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Events
            </CardTitle>
            <div className="flex gap-2">
              <Select value={eventFilter} onValueChange={setEventFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter events" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  <SelectItem value="page_view">Page Views</SelectItem>
                  <SelectItem value="user_action">User Actions</SelectItem>
                  <SelectItem value="error">Errors</SelectItem>
                  <SelectItem value="crash">Crashes</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={fetchAnalytics}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      Loading events...
                    </TableCell>
                  </TableRow>
                ) : events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      No events found
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <Badge variant={getEventBadgeVariant(event.event_type)}>
                          {event.event_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate" title={formatEventData(event.event_data)}>
                          {formatEventData(event.event_data)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {event.user_id ? (
                          <span className="text-sm text-muted-foreground">
                            {event.user_id.substring(0, 8)}...
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Anonymous</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {event.ip_address || 'N/A'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(event.created_at).toLocaleString()}
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