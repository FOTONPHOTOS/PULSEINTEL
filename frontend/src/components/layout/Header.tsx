import React, { useState } from 'react';
import { Search, Bell, Settings, HelpCircle, Sun, Moon, ChevronDown } from 'lucide-react';

export function Header() {
  const [darkMode, setDarkMode] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isExchangesOpen, setIsExchangesOpen] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');

  const popularSymbols = [
    { symbol: 'BTCUSDT', name: 'Bitcoin' },
    { symbol: 'ETHUSDT', name: 'Ethereum' },
    { symbol: 'SOLUSDT', name: 'Solana' },
    { symbol: 'BNBUSDT', name: 'BNB' },
    { symbol: 'DOGEUSDT', name: 'Dogecoin' },
    { symbol: 'XRPUSDT', name: 'XRP' },
    { symbol: 'ADAUSDT', name: 'Cardano' },
    { symbol: 'AVAXUSDT', name: 'Avalanche' },
  ];
  
  const exchanges = [
    { name: 'Binance', active: true },
    { name: 'Bybit', active: true },
    { name: 'Bitfinex', active: false },
    { name: 'OKX', active: false },
    { name: 'Coinbase', active: false },
    { name: 'KuCoin', active: false },
  ];
  
  const notifications = [
    { id: 1, message: 'New exchange added: Bybit', time: '2 hours ago', read: false },
    { id: 2, message: 'Large whale movement detected on BTCUSDT', time: '5 hours ago', read: false },
    { id: 3, message: 'System update completed successfully', time: 'Yesterday', read: true },
  ];
  
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    // In a real app, you'd apply the theme change here
  };

  const handleSymbolSelect = (symbol: string) => {
    setSelectedSymbol(symbol);
    // In a real app, you would store this in global state and use it across components
  };
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };
  
  const filteredSymbols = popularSymbols.filter(
    item => item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
            item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <header className="flex items-center justify-between h-14 px-4 border-b border-gray-800 bg-gray-900">
      {/* Left section - Symbol Selector */}
      <div className="flex items-center">
        <div className="relative">
          <button 
            onClick={() => setIsExchangesOpen(prev => !prev)}
            className="flex items-center mr-4 px-3 py-1 bg-gray-800 rounded-md border border-gray-700 hover:bg-gray-700 transition-colors"
          >
            <span className="text-sm text-gray-300 mr-1">Exchanges</span>
            <ChevronDown size={16} className="text-gray-400" />
          </button>
          
          {isExchangesOpen && (
            <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50 w-48">
              <div className="p-2 text-sm font-medium text-gray-300 border-b border-gray-700">
                Data Sources
              </div>
              <div className="p-2">
                {exchanges.map(exchange => (
                  <div key={exchange.name} className="flex items-center justify-between p-1">
                    <span className="text-sm text-gray-300">{exchange.name}</span>
                    {exchange.active ? (
                      <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                    ) : (
                      <span className="text-xs text-gray-500">Soon</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="relative mr-4">
          <button 
            className="flex items-center px-3 py-1 bg-blue-600/30 text-blue-300 rounded-md border border-blue-500/50 hover:bg-blue-500/20 transition-colors"
          >
            <span className="text-sm font-medium">{selectedSymbol}</span>
            <ChevronDown size={16} className="ml-1" />
          </button>
          
          <div className="hidden absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50 w-72">
            <div className="p-2 border-b border-gray-700">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1 text-sm text-white"
              />
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filteredSymbols.map(item => (
                <button
                  key={item.symbol}
                  onClick={() => handleSymbolSelect(item.symbol)}
                  className={`flex items-center w-full px-3 py-2 text-sm hover:bg-gray-700 
                    ${selectedSymbol === item.symbol ? 'bg-gray-700 text-blue-400' : 'text-gray-300'}`}
                >
                  <span>{item.symbol}</span>
                  <span className="ml-2 text-gray-500 text-xs">{item.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Middle section - Search */}
      <div className="flex-1 max-w-2xl mx-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Search markets, indicators, or analytics..."
            className="w-full bg-gray-800 border border-gray-700 rounded-md px-10 py-1.5 text-sm text-gray-300 focus:border-blue-500 focus:outline-none"
          />
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
        </div>
      </div>
      
      {/* Right section - Actions */}
      <div className="flex items-center space-x-2">
        {/* Theme toggle */}
        <button 
          onClick={toggleDarkMode}
          className="p-2 text-gray-400 hover:text-gray-300 rounded-full hover:bg-gray-800"
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        
        {/* Notifications */}
        <div className="relative">
          <button 
            onClick={() => setIsNotificationsOpen(prev => !prev)}
            className="p-2 text-gray-400 hover:text-gray-300 rounded-full hover:bg-gray-800 relative"
          >
            <Bell size={20} />
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            )}
          </button>
          
          {isNotificationsOpen && (
            <div className="absolute right-0 mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50 w-80">
              <div className="p-2 border-b border-gray-700 flex justify-between items-center">
                <h3 className="text-sm font-medium text-gray-300">Notifications</h3>
                <button className="text-xs text-blue-400 hover:underline">Mark all as read</button>
              </div>
              {notifications.length > 0 ? (
                <div className="max-h-96 overflow-y-auto">
                  {notifications.map(notification => (
                    <div 
                      key={notification.id}
                      className={`p-3 border-b border-gray-700 ${notification.read ? '' : 'bg-gray-700/30'}`}
                    >
                      <div className="flex justify-between">
                        <p className="text-sm text-gray-300">{notification.message}</p>
                        {!notification.read && <span className="w-2 h-2 bg-blue-500 rounded-full"></span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{notification.time}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-gray-400 text-sm">No notifications</div>
              )}
              <div className="p-2 border-t border-gray-700">
                <button className="w-full text-center text-xs text-blue-400 hover:underline">
                  View all notifications
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Help */}
        <button className="p-2 text-gray-400 hover:text-gray-300 rounded-full hover:bg-gray-800">
          <HelpCircle size={20} />
        </button>
        
        {/* Settings */}
        <button className="p-2 text-gray-400 hover:text-gray-300 rounded-full hover:bg-gray-800">
          <Settings size={20} />
        </button>
        
        {/* User button */}
        <button className="ml-2 flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-md border border-gray-700 text-sm text-gray-300">
          <span>Demo User</span>
          <ChevronDown size={16} className="text-gray-500" />
        </button>
      </div>
    </header>
  );
}
