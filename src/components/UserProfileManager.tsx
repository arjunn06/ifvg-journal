import { useState, useRef, useEffect } from 'react';
import { User, Settings, LogOut, Crown, Mail, Lock, Camera, Plus, Key, Eye, EyeOff, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/ThemeToggle';
import { secureLocalStorage } from '@/utils/secureStorage';
interface UserProfileManagerProps {
  collapsed?: boolean;
}
export function UserProfileManager({
  collapsed
}: UserProfileManagerProps) {
  const {
    user,
    signOut
  } = useAuth();
  const {
    isPremium
  } = useSubscription();
  const {
    toast
  } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [displayName, setDisplayName] = useState(user?.user_metadata?.display_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [uploading, setUploading] = useState(false);
  const [updating, setUpdating] = useState(false);

  // OpenAI API key management
  const [openAIKey, setOpenAIKey] = useState('');
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [openAIKeyExists, setOpenAIKeyExists] = useState(false);

  // Check if OpenAI key exists on component mount
  useEffect(() => {
    (async () => {
      // Migrate legacy key from localStorage to encrypted secure storage
      const legacy = localStorage.getItem('openai_api_key');
      if (legacy) {
        await secureLocalStorage.setItem('openai_api_key', legacy, {
          encrypt: true
        });
        localStorage.removeItem('openai_api_key');
      }
      const existing = await secureLocalStorage.getItem('openai_api_key');
      if (existing) {
        setOpenAIKeyExists(true);
        setOpenAIKey(existing.substring(0, 8) + '...' + existing.substring(existing.length - 4));
      }
    })();
  }, []);
  const handleSaveOpenAIKey = async () => {
    if (!openAIKey.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a valid OpenAI API key."
      });
      return;
    }
    await secureLocalStorage.setItem('openai_api_key', openAIKey, {
      encrypt: true
    });
    setOpenAIKeyExists(true);
    const maskedKey = openAIKey.substring(0, 8) + '...' + openAIKey.substring(openAIKey.length - 4);
    setOpenAIKey(maskedKey);
    setShowOpenAIKey(false);
    toast({
      title: "API Key saved",
      description: "Your OpenAI API key has been stored securely (encrypted)."
    });
  };
  const handleDeleteOpenAIKey = async () => {
    secureLocalStorage.removeItem('openai_api_key');
    setOpenAIKey('');
    setOpenAIKeyExists(false);
    setShowOpenAIKey(false);
    toast({
      title: "API Key removed",
      description: "Your OpenAI API key has been removed."
    });
  };
  const handleEditOpenAIKey = async () => {
    const existingKey = await secureLocalStorage.getItem('openai_api_key');
    setOpenAIKey(existingKey || '');
    setShowOpenAIKey(true);
  };
  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed out",
      description: "You have been successfully signed out."
    });
  };
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Please select an image under 5MB."
      });
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please select an image file."
      });
      return;
    }
    setUploading(true);
    try {
      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;
      const {
        error: uploadError
      } = await supabase.storage.from('avatars').upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });
      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data
      } = supabase.storage.from('avatars').getPublicUrl(filePath);

      // Update user metadata
      const {
        error: updateError
      } = await supabase.auth.updateUser({
        data: {
          avatar_url: data.publicUrl
        }
      });
      if (updateError) throw updateError;
      toast({
        title: "Photo updated",
        description: "Your profile photo has been updated successfully."
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message || "Failed to upload photo."
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  const handleUpdateProfile = async () => {
    if (!user) return;
    setUpdating(true);
    try {
      // Update user metadata
      const updates: any = {};
      if (displayName !== user.user_metadata?.display_name) {
        updates.display_name = displayName;
      }
      if (email !== user.email) {
        updates.email = email;
      }
      if (Object.keys(updates).length > 0) {
        if (updates.email) {
          // Email update requires separate call
          const {
            error: emailError
          } = await supabase.auth.updateUser({
            email: updates.email
          });
          if (emailError) throw emailError;
          delete updates.email;
        }
        if (Object.keys(updates).length > 0) {
          const {
            error: metadataError
          } = await supabase.auth.updateUser({
            data: updates
          });
          if (metadataError) throw metadataError;
        }
      }

      // Update profiles table if it exists
      try {
        await supabase.from('profiles').upsert({
          user_id: user.id,
          display_name: displayName,
          email: email
        });
      } catch (error) {
        // Profiles table might not exist, that's okay
        // Profile update is optional, don't log errors in production
      }
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully."
      });
      setProfileDialogOpen(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message || "Failed to update profile."
      });
    } finally {
      setUpdating(false);
    }
  };
  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Passwords do not match."
      });
      return;
    }
    if (newPassword.length < 6) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Password must be at least 6 characters long."
      });
      return;
    }
    try {
      const {
        error
      } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;
      toast({
        title: "Password changed",
        description: "Your password has been changed successfully."
      });
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Password change failed",
        description: error.message || "Failed to change password."
      });
    }
  };
  const getInitials = (name?: string) => {
    if (!name) return user?.email?.charAt(0).toUpperCase() || 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };
  const getDisplayName = () => {
    return user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  };
  if (collapsed) {
    return <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full relative">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.user_metadata?.avatar_url} />
              <AvatarFallback className="text-xs">
                {getInitials(user?.user_metadata?.display_name)}
              </AvatarFallback>
            </Avatar>
            {isPremium && <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full flex items-center justify-center">
                <Crown className="h-2.5 w-2.5 text-white" />
              </div>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex items-center gap-2">
            <span>My Account</span>
            {isPremium && <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
                <Crown className="h-3 w-3 mr-1" />
                Premium
              </Badge>}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
            <DialogTrigger asChild>
              <DropdownMenuItem onSelect={e => e.preventDefault()}>
                <Settings className="h-4 w-4 mr-2" />
                Profile Settings
              </DropdownMenuItem>
            </DialogTrigger>
          </Dialog>
          <ThemeToggle collapsed={true} />
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>;
  }
  return <div className="space-y-2">
      <div className="flex items-center gap-3 p-3 rounded-lg bg-sidebar-accent/50">
        <div className="relative">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user?.user_metadata?.avatar_url} />
            <AvatarFallback>
              {getInitials(user?.user_metadata?.display_name)}
            </AvatarFallback>
          </Avatar>
          {isPremium && <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
              <Crown className="h-3 w-3 text-white" />
            </div>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-sidebar-foreground truncate">
            {getDisplayName()}
          </p>
          <p className="text-xs text-sidebar-foreground/60 truncate">
            {user?.email}
          </p>
        </div>
      </div>

      <div className="flex gap-1">
        <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" className="flex-1 justify-start text-sidebar-foreground hover:bg-sidebar-accent">
              <Settings className="h-4 w-4 mr-3" />
              Profile Settings
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Profile Settings</DialogTitle>
              <DialogDescription>
                Make changes to your profile here. Click save when you're done.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* Profile Photo */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={user?.user_metadata?.avatar_url} />
                    <AvatarFallback className="text-lg">
                      {getInitials(user?.user_metadata?.display_name)}
                    </AvatarFallback>
                  </Avatar>
                  {isPremium && <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                      <Crown className="h-3.5 w-3.5 text-white" />
                    </div>}
                </div>
                <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Camera className="h-4 w-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Change Photo'}
                </Button>
              </div>

              {/* Display Name */}
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input id="displayName" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Enter your display name" />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="flex gap-2">
                  <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email" />
                  <Button variant="outline" size="sm">
                    <Mail className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Password Change */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  <Label className="text-sm font-medium">Change Password</Label>
                </div>
                <div className="space-y-2">
                  <Input type="password" placeholder="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                  <Input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                  {newPassword && <Button variant="outline" size="sm" onClick={handlePasswordChange} disabled={!newPassword || !confirmPassword}>
                      Update Password
                    </Button>}
                </div>
              </div>

              {/* OpenAI API Key Management */}
              

              <div className="flex gap-3 pt-4 border-t">
                <Button onClick={handleUpdateProfile} className="flex-1" disabled={updating}>
                  {updating ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button variant="outline" onClick={() => setProfileDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="ghost" onClick={handleSignOut} size="sm">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <ThemeToggle collapsed={false} />
      </div>

    </div>;
}