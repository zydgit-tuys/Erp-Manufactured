import { useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function ShipmentDetails() {
    const { id } = useParams();
    const navigate = useNavigate();

    return (
        <AppLayout>
            <div className="space-y-6 animate-fade-in">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => navigate('/sales/shipments')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Shipment Details</h1>
                        <p className="text-muted-foreground">
                            Process delivery for Order #{id ? id.slice(0, 8) : '...'}
                        </p>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Truck className="h-5 w-5" />
                            Delivery Note
                        </CardTitle>
                        <CardDescription>
                            Shipment processing interface is under construction.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="h-64 flex items-center justify-center text-muted-foreground bg-muted/10 border-2 border-dashed rounded-lg">
                        <div className="text-center">
                            <p>This module is currently being implemented.</p>
                            <p className="text-sm mt-2">Will handle delivery note creation and inventory deduction.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
