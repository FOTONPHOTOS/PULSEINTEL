import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  CardDescription 
} from '../components/ui/Card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/Select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../components/ui/Table';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Loader2, Plus, Trash2, Bell } from 'lucide-react';

// Create local Alert components
interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  variant?: "default" | "destructive";
}

const Alert: React.FC<AlertProps> = ({
  className = "",
  variant = "default",
  ...props
}) => {
  const variantClasses: Record<string, string> = {
    default: "bg-background text-foreground",
    destructive: "bg-red-500/15 text-red-500 border-red-500/50"
  };

  return (
    <div
      role="alert"
      className={`relative w-full rounded-lg border p-4 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
};

interface AlertTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  className?: string;
}

const AlertTitle: React.FC<AlertTitleProps> = ({
  className = "",
  ...props
}) => {
  return (
    <h5
      className={`mb-1 font-medium leading-none tracking-tight ${className}`}
      {...props}
    />
  );
};

interface AlertDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  className?: string;
}

const AlertDescription: React.FC<AlertDescriptionProps> = ({
  className = "",
  ...props
}) => {
  return (
    <div
      className={`text-sm ${className}`}
      {...props}
    />
  );
};

// Create local Label component
interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  className?: string;
}

const Label: React.FC<LabelProps> = ({
  className = "",
  ...props
}) => {
  return (
    <label
      className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}
      {...props}
    />
  );
};

// Types for alerts data
interface CustomAlert {
  id: string;
  symbol: string;
  condition: 'price_above' | 'price_below' | 'volume_spike' | 'change_above' | 'change_below';
  value: number;
  enabled: boolean;
  created: number;
  triggered: boolean;
  webhook_url?: string;
}

export default function CustomAlerts() {
  const [alerts, setAlerts] = useState<CustomAlert[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  
  // Form state for creating new alerts
  const [newAlert, setNewAlert] = useState({
    symbol: 'BTCUSDT',
    condition: 'price_above' as const,
    value: '',
    webhook_url: ''
  });
  
  // Available symbols
  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT'];
  
  // Available conditions
  const conditions = [
    { value: 'price_above', label: 'Price Above' },
    { value: 'price_below', label: 'Price Below' },
    { value: 'volume_spike', label: 'Volume Spike' },
    { value: 'change_above', label: 'Change Above %' },
    { value: 'change_below', label: 'Change Below %' }
  ];
  
  // Load alerts from backend
  const loadAlerts = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
              const response = await fetch('/api/alerts');
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      setAlerts(data.alerts || []);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
      setError('Failed to load alerts. Please ensure the backend server is running.');
      setAlerts([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Create new alert
  const createAlert = async () => {
    if (!newAlert.value) {
      alert('Please enter a value for the alert');
      return;
    }
    
    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol: newAlert.symbol,
          condition: newAlert.condition,
          value: parseFloat(newAlert.value),
          webhook_url: newAlert.webhook_url || undefined
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create alert: ${response.status}`);
      }
      
      // Reset form and reload alerts
      setNewAlert({
        symbol: 'BTCUSDT',
        condition: 'price_above',
        value: '',
        webhook_url: ''
      });
      setShowCreateForm(false);
      await loadAlerts();
    } catch (err) {
      console.error('Failed to create alert:', err);
      alert('Failed to create alert. Please try again.');
    }
  };
  
  // Format timestamp
  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };
  
  // Get condition label
  const getConditionLabel = (condition: string): string => {
    const found = conditions.find(c => c.value === condition);
    return found ? found.label : condition;
  };
  
  // Get condition color
  const getConditionColor = (condition: string): string => {
    switch (condition) {
      case 'price_above':
      case 'change_above':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'price_below':
      case 'change_below':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'volume_spike':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };
  
  // Load alerts on mount
  useEffect(() => {
    loadAlerts();
  }, []);
  
  if (isLoading && alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading alerts...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <Alert variant="destructive" className="mx-auto my-8 max-w-2xl">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          {error}
          <button 
            onClick={loadAlerts}
            className="ml-4 underline text-sm text-primary"
          >
            Retry
          </button>
        </AlertDescription>
      </Alert>
    );
  }
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Custom Alerts</h1>
          <p className="text-muted-foreground">
            Set up custom price and volume alerts for your trading pairs
          </p>
        </div>
        
        <Button 
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Alert
        </Button>
      </div>
      
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Alert</CardTitle>
            <CardDescription>
              Set up a new alert to get notified when market conditions are met
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="symbol">Symbol</Label>
                <Select value={newAlert.symbol} onValueChange={(value) => setNewAlert({...newAlert, symbol: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {symbols.map(symbol => (
                      <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="condition">Condition</Label>
                <Select value={newAlert.condition} onValueChange={(value: any) => setNewAlert({...newAlert, condition: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {conditions.map(condition => (
                      <SelectItem key={condition.value} value={condition.value}>
                        {condition.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="value">Value</Label>
                <Input
                  id="value"
                  type="number"
                  value={newAlert.value}
                  onChange={(e) => setNewAlert({...newAlert, value: e.target.value})}
                  placeholder="Enter threshold value"
                />
              </div>
              
              <div className="flex items-end">
                <Button onClick={createAlert} className="w-full">
                  Create Alert
                </Button>
              </div>
            </div>
            
            <div className="mt-4">
              <Label htmlFor="webhook">Webhook URL (Optional)</Label>
              <Input
                id="webhook"
                type="url"
                value={newAlert.webhook_url}
                onChange={(e) => setNewAlert({...newAlert, webhook_url: e.target.value})}
                placeholder="https://your-webhook-url.com"
              />
            </div>
          </CardContent>
        </Card>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Active Alerts
          </CardTitle>
          <CardDescription>
            {alerts.length === 0 ? (
              "No alerts configured. Create your first alert above."
            ) : (
              `You have ${alerts.length} alert${alerts.length !== 1 ? 's' : ''} configured.`
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No alerts configured yet</p>
              <p className="text-sm text-muted-foreground">Create your first alert to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell className="font-medium">{alert.symbol}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getConditionColor(alert.condition)}>
                        {getConditionLabel(alert.condition)}
                      </Badge>
                    </TableCell>
                    <TableCell>{alert.value.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={alert.enabled ? "default" : "secondary"}>
                        {alert.enabled ? 'Active' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatTimestamp(alert.created)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 