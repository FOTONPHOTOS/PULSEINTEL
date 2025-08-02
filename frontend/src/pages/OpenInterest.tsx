import React, { useState } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/Select';
import { Target } from 'lucide-react';
import OpenInterestTracker from '../components/OpenInterestTracker';

export default function OpenInterest() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTCUSDT');

  const symbols = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 
    'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'MATICUSDT'
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Target className="h-8 w-8 text-orange-400" />
            Open Interest Analysis
          </h1>
          <p className="text-slate-400 mt-2">
            Tracking futures open interest across major exchanges for {selectedSymbol}.
          </p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <label className="text-sm font-medium text-slate-300 mb-2 block">
            Select Asset
          </label>
          <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
            <SelectTrigger>
              <SelectValue placeholder="Select symbol" />
            </SelectTrigger>
            <SelectContent>
              {symbols.map((symbol) => (
                <SelectItem key={symbol} value={symbol}>
                  {symbol.replace('USDT', '/USDT')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Open Interest Tracker Component */}
      {/* This component is now self-contained and handles its own data fetching */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-2">
          <OpenInterestTracker selectedAsset={selectedSymbol} />
        </div>
      </div>
    </div>
  );
} 