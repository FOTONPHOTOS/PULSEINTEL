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
import { Loader2, Plus, Trash2, Eye, Star } from 'lucide-react';

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

// Types for watchlist data
interface WatchlistItem {
  symbol: string;
  added: number;
  price?: number;
  change_24h?: number;
  volume_24h?: number;
}

interface Watchlist {
  id: string;
  name: string;
  description?: string;
  items: WatchlistItem[];
  created: number;
  isDefault: boolean;
}

export default function Watchlists() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWatchlist, setSelectedWatchlist] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [showAddSymbolForm, setShowAddSymbolForm] = useState<boolean>(false);
  
  // Form state for creating new watchlists
  const [newWatchlist, setNewWatchlist] = useState({
    name: '',
    description: ''
  });
  
  // Form state for adding symbols
  const [newSymbol, setNewSymbol] = useState('BTCUSDT');
  
  // Available symbols
  const availableSymbols = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT',
    'ADAUSDT', 'XRPUSDT', 'DOTUSDT', 'LTCUSDT', 'AVAXUSDT'
  ];
  
  // Load watchlists from backend
  const loadWatchlists = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
              const response = await fetch('/api/watchlists');
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      setWatchlists(data.watchlists || []);
      
      // Set first watchlist as selected if none selected
      if (data.watchlists && data.watchlists.length > 0 && !selectedWatchlist) {
        setSelectedWatchlist(data.watchlists[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch watchlists:', err);
      setError('Failed to load watchlists. Please ensure the backend server is running.');
      setWatchlists([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Create new watchlist
  const createWatchlist = async () => {
    if (!newWatchlist.name.trim()) {
      alert('Please enter a name for the watchlist');
      return;
    }
    
    try {
      const response = await fetch('/api/watchlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newWatchlist.name.trim(),
          description: newWatchlist.description.trim() || undefined
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create watchlist: ${response.status}`);
      }
      
      // Reset form and reload watchlists
      setNewWatchlist({ name: '', description: '' });
      setShowCreateForm(false);
      await loadWatchlists();
    } catch (err) {
      console.error('Failed to create watchlist:', err);
      alert('Failed to create watchlist. Please try again.');
    }
  };
  
  // Add symbol to watchlist
  const addSymbolToWatchlist = async () => {
    if (!selectedWatchlist || !newSymbol) {
      alert('Please select a watchlist and symbol');
      return;
    }
    
    try {
      // For now, this is just a placeholder since backend doesn't support individual symbol management
      alert('Symbol addition functionality will be available when backend endpoints are fully implemented');
      setShowAddSymbolForm(false);
    } catch (err) {
      console.error('Failed to add symbol:', err);
      alert('Failed to add symbol. Please try again.');
    }
  };
  
  // Get selected watchlist
  const getSelectedWatchlist = (): Watchlist | null => {
    return watchlists.find(w => w.id === selectedWatchlist) || null;
  };
  
  // Format timestamp
  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };
  
  // Format price change
  const formatChange = (change: number): string => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };
  
  // Get change color
  const getChangeColor = (change: number): string => {
    if (change > 0) return 'text-green-600 dark:text-green-400';
    if (change < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };
  
  // Load watchlists on mount
  useEffect(() => {
    loadWatchlists();
  }, []);
  
  if (isLoading && watchlists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading watchlists...</p>
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
            onClick={loadWatchlists}
            className="ml-4 underline text-sm text-primary"
          >
            Retry
          </button>
        </AlertDescription>
      </Alert>
    );
  }
  
  const selectedWatchlistData = getSelectedWatchlist();
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Watchlists</h1>
          <p className="text-muted-foreground">
            Organize and track your favorite trading pairs
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Watchlist
          </Button>
          
          {selectedWatchlist && (
            <Button 
              variant="outline"
              onClick={() => setShowAddSymbolForm(!showAddSymbolForm)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Symbol
            </Button>
          )}
        </div>
      </div>
      
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Watchlist</CardTitle>
            <CardDescription>
              Create a new watchlist to organize your favorite trading pairs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Watchlist Name</Label>
                <Input
                  id="name"
                  value={newWatchlist.name}
                  onChange={(e) => setNewWatchlist({...newWatchlist, name: e.target.value})}
                  placeholder="e.g., DeFi Tokens, Top 10, High Volume"
                />
              </div>
              
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  value={newWatchlist.description}
                  onChange={(e) => setNewWatchlist({...newWatchlist, description: e.target.value})}
                  placeholder="Brief description of this watchlist"
                />
              </div>
            </div>
            
            <div className="flex gap-2 mt-4">
              <Button onClick={createWatchlist}>
                Create Watchlist
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {showAddSymbolForm && selectedWatchlist && (
        <Card>
          <CardHeader>
            <CardTitle>Add Symbol to Watchlist</CardTitle>
            <CardDescription>
              Add a new trading pair to {selectedWatchlistData?.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="symbol">Select Symbol</Label>
                <Select value={newSymbol} onValueChange={setNewSymbol}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSymbols.map(symbol => (
                      <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button onClick={addSymbolToWatchlist}>
                Add Symbol
              </Button>
              <Button variant="outline" onClick={() => setShowAddSymbolForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Watchlist Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Your Watchlists
            </CardTitle>
          </CardHeader>
          <CardContent>
            {watchlists.length === 0 ? (
              <div className="text-center py-8">
                <Star className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No watchlists yet</p>
                <p className="text-xs text-muted-foreground">Create your first watchlist</p>
              </div>
            ) : (
              <div className="space-y-2">
                {watchlists.map((watchlist) => (
                  <div
                    key={watchlist.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedWatchlist === watchlist.id
                        ? 'bg-primary/10 border border-primary/20'
                        : 'bg-muted/50 hover:bg-muted'
                    }`}
                    onClick={() => setSelectedWatchlist(watchlist.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-sm">{watchlist.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          {watchlist.items.length} symbols
                        </p>
                      </div>
                      {watchlist.isDefault && (
                        <Badge variant="secondary" className="text-xs">Default</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Watchlist Content */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                {selectedWatchlistData?.name || 'Select a Watchlist'}
              </CardTitle>
              <CardDescription>
                {selectedWatchlistData?.description || 'Track your favorite trading pairs'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedWatchlistData ? (
                <div className="text-center py-12">
                  <Eye className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Select a watchlist to view symbols</p>
                </div>
              ) : selectedWatchlistData.items.length === 0 ? (
                <div className="text-center py-12">
                  <Star className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No symbols in this watchlist</p>
                  <p className="text-sm text-muted-foreground">Add symbols to get started</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>24h Change</TableHead>
                      <TableHead>24h Volume</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedWatchlistData.items.map((item) => (
                      <TableRow key={item.symbol}>
                        <TableCell className="font-medium">{item.symbol}</TableCell>
                        <TableCell>
                          {item.price ? `$${item.price.toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell>
                          {item.change_24h !== undefined ? (
                            <span className={getChangeColor(item.change_24h)}>
                              {formatChange(item.change_24h)}
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {item.volume_24h ? `$${(item.volume_24h / 1e6).toFixed(1)}M` : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatTimestamp(item.added)}
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
      </div>
    </div>
  );
} 