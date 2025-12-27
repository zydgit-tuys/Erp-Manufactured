import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { Plus, LucideIcon } from 'lucide-react';

interface QuickAction {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
}

interface QuickActionsProps {
  actions: QuickAction[];
}

export function QuickActions({ actions }: QuickActionsProps) {
  const navigate = useNavigate();

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {actions.map((action) => (
          <Button
            key={action.href}
            variant="outline"
            className="justify-start h-auto py-3 px-4"
            onClick={() => navigate(action.href)}
          >
            <action.icon className="h-4 w-4 mr-3 text-primary" />
            <div className="text-left">
              <div className="font-medium">{action.title}</div>
              <div className="text-xs text-muted-foreground">{action.description}</div>
            </div>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
