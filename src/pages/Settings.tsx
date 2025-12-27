import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany, useUpdateCompanySettings } from '@/hooks/useCompany';
import { useToast } from '@/hooks/use-toast';
import { Building2, User, Shield, Layers, Loader2, Factory, Store } from 'lucide-react';

export default function Settings() {
  const { user } = useAuth();
  const { data: company, isLoading } = useCompany();
  const updateSettings = useUpdateCompanySettings();
  const { toast } = useToast();

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
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update settings.',
      });
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
                <Input value={company?.code || 'N/A'} disabled className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label>Industry</Label>
                <Input value={company?.industry || 'Manufacturing'} disabled />
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
              <Button variant="outline" className="w-full">
                Change Password
              </Button>
            </CardContent>
          </Card>

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
