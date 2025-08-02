import React, { useState } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/Select';
import { Eye } from 'lucide-react';
import WhaleTracker from '../components/WhaleTracker';

export default function WhaleTracking() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTCUSDT');
  const [minTradeSize, setMinTradeSize] = useState<number>(100000); // $100K minimum

  const symbols = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
    'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'MATICUSDT'
  ];

  const whaleThresholds = [
    { value: 50000, label: '$50K+' },
    { value: 100000, label: '$100K+' },
    { value: 250000, label: '$250K+' },
    { value: 500000, label: '$500K+' },
    { value: 1000000, label: '$1M+' }
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Eye className="h-8 w-8 text-blue-400" />
            Real-time Whale Tracking
          </h1>
          <p className="text-slate-400 mt-2">
            Live whale trade detection powered by the real-time WebSocket trade stream.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-4">
            <label className="text-sm font-medium text-slate-300 mb-2 block">Symbol</label>
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

        <Card>
          <CardContent className="p-4">
            <label className="text-sm font-medium text-slate-300 mb-2 block">Minimum Trade Size</label>
            <Select value={String(minTradeSize)} onValueChange={(value) => setMinTradeSize(Number(value))}>
              <SelectTrigger>
                <SelectValue placeholder="Select minimum size" />
              </SelectTrigger>
              <SelectContent>
                {whaleThresholds.map((threshold) => (
                  <SelectItem key={threshold.value} value={String(threshold.value)}>
                    {threshold.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Whale Tracker Component */}
      <div className="grid grid-cols-1">
        <WhaleTracker 
          symbol={selectedSymbol} 
          whaleThreshold={minTradeSize}
          megaWhaleThreshold={minTradeSize * 10}
          institutionalThreshold={minTradeSize * 50}
        />
      </div>
    </div>
  );
} 