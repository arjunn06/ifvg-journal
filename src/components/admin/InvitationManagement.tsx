import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Mail, Plus, Copy, RefreshCw } from 'lucide-react';

interface Invitation {
  id: string;
  email: string;
  status: string;
  token: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
  premium_access: boolean;
  notes: string | null;
}

export function InvitationManagement() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [premiumAccess, setPremiumAccess] = useState(false);
  const [inviteNotes, setInviteNotes] = useState('');
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (error) {
      console.error('Error fetching invitations:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch invitations',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const createInvitation = async () => {
    if (!newEmail.trim()) return;

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from('invitations')
        .insert({
          email: newEmail.trim().toLowerCase(),
          invited_by: user?.id,
          premium_access: premiumAccess,
          notes: inviteNotes.trim() || null
        })
        .select()
        .single();

      if (error) throw error;

      // Send invitation email
      await supabase.functions.invoke('send-invitation', {
        body: {
          email: newEmail.trim().toLowerCase(),
          token: data.token,
          inviterName: user?.user_metadata?.display_name || 'IFVG Journal Team'
        }
      });

      setInvitations([data, ...invitations]);
      setNewEmail('');
      setPremiumAccess(false);
      setInviteNotes('');
      setIsDialogOpen(false);

      toast({
        title: 'Success',
        description: 'Invitation sent successfully',
      });
    } catch (error: any) {
      console.error('Error creating invitation:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create invitation',
        variant: 'destructive'
      });
    } finally {
      setIsCreating(false);
    }
  };

  const copyInviteLink = (token: string) => {
    const inviteUrl = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(inviteUrl);
    
    toast({
      title: 'Copied!',
      description: 'Invitation link copied to clipboard',
    });
  };

  const resendInvitation = async (invitation: Invitation) => {
    try {
      await supabase.functions.invoke('send-invitation', {
        body: {
          email: invitation.email,
          token: invitation.token,
          inviterName: user?.user_metadata?.display_name || 'IFVG Journal Team'
        }
      });

      toast({
        title: 'Success',
        description: 'Invitation resent successfully',
      });
    } catch (error) {
      console.error('Error resending invitation:', error);
      toast({
        title: 'Error',
        description: 'Failed to resend invitation',
        variant: 'destructive'
      });
    }
  };

  const getStatusBadge = (invitation: Invitation) => {
    if (invitation.used_at) {
      return <Badge variant="default">Used</Badge>;
    }
    
    const isExpired = new Date(invitation.expires_at) < new Date();
    if (isExpired) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    
    return <Badge variant="secondary">Pending</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Invitation Management
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Send Invitation
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Beta Invitation</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter email address..."
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && createInvitation()}
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="premium"
                    checked={premiumAccess}
                    onCheckedChange={(checked) => setPremiumAccess(checked as boolean)}
                  />
                  <Label htmlFor="premium">Grant Premium Access</Label>
                </div>

                <div>
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add notes about this invitation..."
                    value={inviteNotes}
                    onChange={(e) => setInviteNotes(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createInvitation} disabled={isCreating || !newEmail.trim()}>
                    {isCreating ? 'Sending...' : 'Send Invitation'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Premium</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Loading invitations...
                  </TableCell>
                </TableRow>
              ) : invitations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    No invitations sent yet
                  </TableCell>
                </TableRow>
              ) : (
                invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">
                      {invitation.email}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(invitation)}
                    </TableCell>
                    <TableCell>
                      {invitation.premium_access ? (
                        <Badge variant="default">Premium</Badge>
                      ) : (
                        <Badge variant="outline">Standard</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(invitation.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {new Date(invitation.expires_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyInviteLink(invitation.token)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        {!invitation.used_at && new Date(invitation.expires_at) > new Date() && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => resendInvitation(invitation)}
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        )}
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
  );
}