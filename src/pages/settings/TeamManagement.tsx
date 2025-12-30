import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';
import { useTeamMembers, useTeamInvites, useCancelInvite } from '@/hooks/useTeam';
import { InviteUserDialog } from './InviteUserDialog';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { User, Mail, Shield, UserX } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { EmptyState } from '@/components/ui/empty-state';

export default function TeamManagement() {
    const { companyId } = useApp();
    const { data: members, isLoading: loadingMembers } = useTeamMembers(companyId);
    const { data: invites, isLoading: loadingInvites } = useTeamInvites(companyId);
    const cancelInvite = useCancelInvite();

    return (
        <AppLayout>
            <div className="space-y-6 animate-fade-in">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Team Management</h1>
                        <p className="text-muted-foreground">
                            Manage users, roles, and invitations
                        </p>
                    </div>
                    <InviteUserDialog />
                </div>

                <Tabs defaultValue="members">
                    <TabsList>
                        <TabsTrigger value="members">Members</TabsTrigger>
                        <TabsTrigger value="invites">Invitations</TabsTrigger>
                    </TabsList>

                    <TabsContent value="members" className="space-y-4">
                        <Card className="shadow-card">
                            <CardHeader>
                                <CardTitle>Team Members</CardTitle>
                                <CardDescription>People with access to this company</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loadingMembers ? (
                                    <TableSkeleton rows={3} columns={4} />
                                ) : !members || members.length === 0 ? (
                                    <EmptyState icon={User} title="No members found" description="This should not happen." />
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>User</TableHead>
                                                <TableHead>Role</TableHead>
                                                <TableHead>Joined</TableHead>
                                                <TableHead>Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {members.map((member) => (
                                                <TableRow key={member.mapping_id}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                                {member.full_name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div className="font-medium">{member.full_name}</div>
                                                                <div className="text-xs text-muted-foreground">{member.email}</div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="capitalize">
                                                            <Shield className="w-3 h-3 mr-1" />
                                                            {member.role}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>{format(new Date(member.joined_at), 'MMM dd, yyyy')}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={member.is_active ? 'default' : 'secondary'}>
                                                            {member.is_active ? 'Active' : 'Inactive'}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="invites" className="space-y-4">
                        <Card className="shadow-card">
                            <CardHeader>
                                <CardTitle>Pending Invitations</CardTitle>
                                <CardDescription>Invites sent but not yet accepted</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loadingInvites ? (
                                    <TableSkeleton rows={3} columns={4} />
                                ) : !invites || invites.length === 0 ? (
                                    <EmptyState
                                        icon={Mail}
                                        title="No pending invites"
                                        description="Invite new members to see them here"
                                    />
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Email</TableHead>
                                                <TableHead>Role</TableHead>
                                                <TableHead>Sent</TableHead>
                                                <TableHead className="text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {invites.map((invite) => (
                                                <TableRow key={invite.id}>
                                                    <TableCell className="font-medium">{invite.email}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="capitalize">
                                                            {invite.role}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>{format(new Date(invite.created_at), 'MMM dd, yyyy')}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => cancelInvite.mutate(invite.id)}
                                                        >
                                                            <UserX className="w-4 h-4 mr-1" /> Revoke
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}
