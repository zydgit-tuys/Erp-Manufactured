import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany, useUpdateCompanySettings, useUpdateCompanyProfile } from '@/hooks/useCompany';
import { useToast } from '@/hooks/use-toast';
import { Building2, User, Shield, Layers, Loader2, Factory } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MasterDataTab } from '@/components/settings/MasterDataTab';

export default function Settings() {
  const { user } = useAuth();
  const { data: company, isLoading } = useCompany();
  const updateSettings = useUpdateCompanySettings();
  const updateProfile = useUpdateCompanyProfile();
  const { toast } = useToast();

  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Local state for company profile form
  const [companyName, setCompanyName] = useState('');
  const [companyIndustry, setCompanyIndustry] = useState('');

  // Sync local state with fetched data
  useEffect(() => {
    if (company) {
      setCompanyName(company.name);
      setCompanyIndustry(company.industry || '');
    }
  }, [company]);

  const handleModuleToggle = async (module: 'marketplace' | 'finance' | 'analytics' | 'manufacturing', enabled: boolean) => {
    if (!company) return;

    const currentSettings = company.settings || {};
    const currentModules = currentSettings.modules || {};

    const newSettings = {
      ...currentSettings,
      modules: {
        ...currentModules,
        [module]: enabled,
      },
    };

    try {
      await updateSettings.mutateAsync({ id: company.id, settings: newSettings });
      toast({
        title: 'Settings Updated',
        description: `Module ${module} has been ${enabled ? 'enabled' : 'disabled'}.`,
      });
    } catch (error: any) {
      console.error('Failed to update settings:', error);
      toast({
        variant: 'destructive',
        title: 'Error updating settings',
        description: error.message || 'Failed to update settings.',
      });
    }
  };

  const handleProfileSave = async () => {
    if (!company) return;

    try {
      await updateProfile.mutateAsync({
        id: company.id,
        updates: {
          name: companyName,
          industry: companyIndustry
        }
      });
      toast({
        title: 'Profile Updated',
        description: 'Company information has been saved.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update company profile.',
      });
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Passwords do not match.',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Password must be at least 6 characters.',
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Password updated successfully.',
      });
      setIsPasswordOpen(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update password.',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const modules = company?.settings?.modules || {};

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account, company, and system modules
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Company Profile */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Company Profile
              </CardTitle>
              <CardDescription>
                Your organization information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input value={company?.name || 'Loading...'} disabled />
              </div>
              <div className="space-y-2">
                <Label>Company Code</Label>
                <Input value={company?.code || 'N/A'} disabled className="font-mono bg-muted" />
                <p className="text-[0.8rem] text-muted-foreground">
                  Unique identifier (cannot be changed)
                </p>
              </div>
              <Separator />
              <p className="text-sm text-muted-foreground">
                Contact system admin to update legal details.
              </p>
            </CardContent>
          </Card>

          {/* Module Management */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                System Modules
              </CardTitle>
              <CardDescription>
                Enable or disable ERP features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label className="text-base">Marketplace Integration (M6)</Label>
                  <CardDescription>
                    Sync orders from Shopee/Tokopedia
                  </CardDescription>
                </div>
                <Switch
                  checked={modules.marketplace ?? false}
                  onCheckedChange={(c) => handleModuleToggle('marketplace', c)}
                  disabled={updateSettings.isPending}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Factory className="h-4 w-4 text-orange-500" />
                    <Label className="text-base">Manufacturing (M3)</Label>
                  </div>
                  <CardDescription>
                    Production, BOMs, Work Orders
                  </CardDescription>
                </div>
                <Switch
                  checked={modules.manufacturing ?? false}
                  onCheckedChange={(c) => handleModuleToggle('manufacturing', c)}
                  disabled={updateSettings.isPending}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label className="text-base">Finance & Accounting (M7)</Label>
                  <CardDescription>
                    Journal entries, Validations, Closing
                  </CardDescription>
                </div>
                <Switch
                  checked={modules.finance ?? false}
                  onCheckedChange={(c) => handleModuleToggle('finance', c)}
                  disabled={updateSettings.isPending}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label className="text-base">Analytics & Reports (M8)</Label>
                  <CardDescription>
                    OLAP Dashboards and Metrics
                  </CardDescription>
                </div>
                <Switch
                  checked={modules.analytics ?? false}
                  onCheckedChange={(c) => handleModuleToggle('analytics', c)}
                  disabled={updateSettings.isPending}
                />
              </div>
            </CardContent>
          </Card>

          {/* User Profile */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Your Profile
              </CardTitle>
              <CardDescription>
                Your account information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={user?.user_metadata?.full_name || 'Not set'} disabled />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email || ''} disabled />
              </div>
              <div className="space-y-2">
                <Label>User ID</Label>
                <Input value={user?.id || ''} disabled className="font-mono text-xs" />
              </div>
              <Separator />

              <Dialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    Change Password
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Change Password</DialogTitle>
                    <DialogDescription>
                      Enter your new password below.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>New Password</Label>
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Confirm Password</Label>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsPasswordOpen(false)}>Cancel</Button>
                    <Button onClick={handlePasswordChange} disabled={isChangingPassword}>
                      {isChangingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Update Password
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

            </CardContent>
          </Card>

          {/* Master Data Management */}
          <MasterDataTab />

          {/* Role & Permissions (Static for now, referencing M0) */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Role & Permissions
              </CardTitle>
              <CardDescription>
                Access Control
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Current Role</Label>
                  <span className="font-medium capitalize">
                    {company?.user_company_mapping?.[0]?.role || 'User'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  (Role management is handled in the Admin Console)
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
