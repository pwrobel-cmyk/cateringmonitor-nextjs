'use client';

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bell, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDiscountAlerts } from "@/hooks/useDiscountAlerts";

interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
}

interface DiscountAlertsProps {
  brands: Brand[];
}

export function DiscountAlerts({ brands }: DiscountAlertsProps) {
  const { alerts, addAlert, removeAlert } = useDiscountAlerts();
  const [selectedBrandName, setSelectedBrandName] = useState<string>("");
  const [threshold, setThreshold] = useState<string>("10");

  const handleAddAlert = () => {
    if (!selectedBrandName) {
      toast.error("Wybierz markę");
      return;
    }

    const thresholdNum = parseInt(threshold);
    if (isNaN(thresholdNum) || thresholdNum < 1 || thresholdNum > 100) {
      toast.error("Próg rabatu musi być liczbą od 1 do 100");
      return;
    }

    if (alerts.some(a => a.brandName === selectedBrandName)) {
      toast.error(`Alert dla marki ${selectedBrandName} już istnieje`);
      return;
    }

    addAlert({ brandName: selectedBrandName, minDiscount: thresholdNum });
    toast.success(`Alert dla ${selectedBrandName} został utworzony`);
    setSelectedBrandName("");
    setThreshold("10");
  };

  const handleDeleteAlert = (alertId: string) => {
    const alert = alerts.find(a => a.id === alertId);
    removeAlert(alertId);
    if (alert) toast.success(`Alert dla ${alert.brandName} został usunięty`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Utwórz nowy alert
          </CardTitle>
          <CardDescription>
            Otrzymaj powiadomienie gdy pojawi się rabat dla wybranej marki
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brand-select">Marka</Label>
              <select
                id="brand-select"
                value={selectedBrandName}
                onChange={e => setSelectedBrandName(e.target.value)}
                className="flex h-8 w-full items-center rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                <option value="">Wybierz markę</option>
                {brands.map(brand => (
                  <option key={brand.id} value={brand.name}>{brand.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="threshold">Próg rabatu (%)</Label>
              <Input
                id="threshold"
                type="number"
                min="1"
                max="100"
                value={threshold}
                onChange={e => setThreshold(e.target.value)}
                placeholder="10"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAddAlert} className="w-full">
                <Bell className="h-4 w-4 mr-2" />
                Dodaj alert
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Twoje alerty ({alerts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nie masz jeszcze żadnych alertów</p>
              <p className="text-sm">Dodaj alert aby otrzymywać powiadomienia o rabatach</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map(alert => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex-1">
                    <h3 className="font-semibold">{alert.brandName}</h3>
                    <p className="text-sm text-muted-foreground">
                      Próg rabatu: {alert.minDiscount}% lub więcej
                      {alert.packageFilter && ` · Pakiet: ${alert.packageFilter}`}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteAlert(alert.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Bell className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Jak działają alerty?</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Otrzymasz powiadomienie gdy pojawi się nowy rabat dla wybranej marki</li>
                <li>Alert uruchomi się tylko gdy rabat przekroczy ustawiony próg</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
