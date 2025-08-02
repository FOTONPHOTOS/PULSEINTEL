import React, { useState, useEffect } from 'react';
import { Bell, Plus, Settings, Trash2, Play, Pause, Check, AlertTriangle, Webhook, Mail } from 'lucide-react';
import { apiConfig } from '../apiConfig';
import { subscribeToTrades } from '../services/WebSocketService';

interface Alert {
  id: string;
  name: string;
  symbol: string;
  condition: string;
  value: number;
  operator: '>' | '<' | '=' | '>=' | '<=';
  type: 'price' | 'volume' | 'change' | 'rsi' | 'macd' | 'funding';
  active: boolean;
  triggered: boolean;
  triggerCount: number;
  createdAt: number;
  lastTriggered?: number;
  notification: {
    email: boolean;
    webhook: boolean;
    webhookUrl?: string;
    sound: boolean;
  };
  timeframe?: string;
}

interface AlertTemplate {
  name: string;
  description: string;
  type: Alert['type'];
  condition: string;
  operator: Alert['operator'];
  defaultValue: number;
}

interface AdvancedAlertSystemProps {
  className?: string;
}

const AdvancedAlertSystem: React.FC<AdvancedAlertSystemProps> = ({ className = "" }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [view, setView] = useState<'active' | 'triggered' | 'templates'>('active');
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(0);

  // Alert templates for quick setup
  const alertTemplates: AlertTemplate[] = [
    {
      name: "Price Breakout",
      description: "Alert when price breaks above resistance",
      type: "price",
      condition: "Price above",
      operator: ">",
      defaultValue: 50000
    },
    {
      name: "Support Test",
      description: "Alert when price approaches support",
      type: "price",
      condition: "Price below",
      operator: "<",
      defaultValue: 45000
    },
    {
      name: "Volume Spike",
      description: "Alert on unusual volume activity",
      type: "volume",
      condition: "Volume above",
      operator: ">",
      defaultValue: 1000000
    },
    {
      name: "Price Change",
      description: "Alert on significant price movement",
      type: "change",
      condition: "24h change above",
      operator: ">",
      defaultValue: 5
    },
    {
      name: "RSI Overbought",
      description: "Alert when RSI indicates overbought",
      type: "rsi",
      condition: "RSI above",
      operator: ">",
      defaultValue: 70
    },
    {
      name: "RSI Oversold",
      description: "Alert when RSI indicates oversold",
      type: "rsi",
      condition: "RSI below",
      operator: "<",
      defaultValue: 30
    },
    {
      name: "Funding Rate High",
      description: "Alert on high funding rates",
      type: "funding",
      condition: "Funding rate above",
      operator: ">",
      defaultValue: 0.01
    }
  ];

  useEffect(() => {
    const loadAlerts = async () => {
      try {
        setLoading(true);
        
        // Load alerts from localStorage
        const savedAlerts = localStorage.getItem('pulseintel_alerts');
        if (savedAlerts) {
          setAlerts(JSON.parse(savedAlerts));
        } else {
          // Generate initial mock alerts
          const mockAlerts: Alert[] = [
            {
              id: '1',
              name: 'BTC Price Alert',
              symbol: 'BTCUSDT',
              condition: 'Price above $46,000',
              value: 46000,
              operator: '>',
              type: 'price',
              active: true,
              triggered: false,
              triggerCount: 0,
              createdAt: Date.now() - 86400000,
              notification: {
                email: true,
                webhook: false,
                sound: true
              }
            },
            {
              id: '2',
              name: 'ETH Volume Spike',
              symbol: 'ETHUSDT',
              condition: 'Volume above 1M',
              value: 1000000,
              operator: '>',
              type: 'volume',
              active: true,
              triggered: false,
              triggerCount: 0,
              createdAt: Date.now() - 172800000,
              notification: {
                email: false,
                webhook: false,
                sound: true
              }
            }
          ];
          setAlerts(mockAlerts);
          localStorage.setItem('pulseintel_alerts', JSON.stringify(mockAlerts));
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading alerts:', error);
        setLoading(false);
      }
    };

    loadAlerts();
  }, []);

  // Monitor real-time data for alert triggers
  useEffect(() => {
    const activeAlerts = alerts.filter(alert => alert.active && !alert.triggered);
    if (activeAlerts.length === 0) return;

    const unsubscribeFunctions: (() => void)[] = [];

    // Subscribe to trade streams for price and volume alerts
    const symbols = [...new Set(activeAlerts.map(alert => alert.symbol))];
    
    symbols.forEach(symbol => {
      const unsubscribe = subscribeToTrades(symbol, (data) => {
        const price = parseFloat(data.price);
        const volume = parseFloat(data.quantity) || 0;
        
        activeAlerts.forEach(alert => {
          if (alert.symbol !== symbol) return;
          
          let shouldTrigger = false;
          
          if (alert.type === 'price') {
            shouldTrigger = checkCondition(price, alert.operator, alert.value);
          } else if (alert.type === 'volume') {
            shouldTrigger = checkCondition(volume, alert.operator, alert.value);
          }
          
          if (shouldTrigger) {
            triggerAlert(alert.id);
          }
        });
      });
      
      unsubscribeFunctions.push(unsubscribe);
    });

    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }, [alerts]);

  const checkCondition = (value: number, operator: Alert['operator'], threshold: number): boolean => {
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      case '=': return Math.abs(value - threshold) < 0.01;
      default: return false;
    }
  };

  const triggerAlert = (alertId: string) => {
    setAlerts(prev => {
      const updated = prev.map(alert => {
        if (alert.id === alertId) {
          const updatedAlert = {
            ...alert,
            triggered: true,
            triggerCount: alert.triggerCount + 1,
            lastTriggered: Date.now()
          };
          
          // Play sound if enabled
          if (alert.notification.sound) {
            try {
              new Audio('/alert-sound.mp3').play().catch(() => {
                console.log('Could not play alert sound');
              });
            } catch (e) {
              console.log('Audio not available');
            }
          }
          
          return updatedAlert;
        }
        return alert;
      });
      
      // Save to localStorage
      localStorage.setItem('pulseintel_alerts', JSON.stringify(updated));
      return updated;
    });
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'price': return 'text-blue-400 bg-blue-900/30';
      case 'volume': return 'text-green-400 bg-green-900/30';
      case 'change': return 'text-yellow-400 bg-yellow-900/30';
      case 'rsi': return 'text-purple-400 bg-purple-900/30';
      case 'macd': return 'text-pink-400 bg-pink-900/30';
      case 'funding': return 'text-orange-400 bg-orange-900/30';
      default: return 'text-gray-400 bg-gray-900/30';
    }
  };

  const getTimeAgo = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return `${Math.floor(diff / 60000)}m ago`;
  };

  const toggleAlert = (id: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === id ? { ...alert, active: !alert.active } : alert
    ));
  };

  const deleteAlert = (id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  };

  const createAlertFromTemplate = (template: AlertTemplate) => {
    const newAlert: Alert = {
      id: Date.now().toString(),
      name: template.name,
      symbol: 'BTCUSDT',
      condition: template.condition,
      value: template.defaultValue,
      operator: template.operator,
      type: template.type,
      active: true,
      triggered: false,
      triggerCount: 0,
      createdAt: Date.now(),
      notification: {
        email: true,
        webhook: false,
        sound: true
      }
    };

    setAlerts(prev => [newAlert, ...prev]);
    setShowCreateModal(false);
  };

  const activeAlerts = alerts.filter(alert => alert.active && !alert.triggered);
  const triggeredAlerts = alerts.filter(alert => alert.triggered);

  if (loading) {
    return (
      <div className={`bg-gray-900 border border-gray-700 rounded-xl p-6 ${className}`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <Bell className="w-5 h-5 mr-2 text-yellow-400" />
            Advanced Alert System
          </h3>
        </div>
        <div className="animate-pulse">
          <div className="h-48 bg-gray-800 rounded-lg mb-4"></div>
          <div className="grid grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-800 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-900 border border-gray-700 rounded-xl p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <Bell className="w-5 h-5 mr-2 text-yellow-400" />
          Advanced Alert System
        </h3>
        
        <div className="flex items-center space-x-3">
          <select
            value={view}
            onChange={(e) => setView(e.target.value as any)}
            className="bg-gray-800 text-white text-sm px-3 py-1 rounded border border-gray-600"
          >
            <option value="active">Active Alerts</option>
            <option value="triggered">Triggered</option>
            <option value="templates">Templates</option>
          </select>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Alert
          </button>
        </div>
      </div>

      {/* Alert Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Alerts</p>
              <p className="text-white text-lg font-semibold">{alerts.length}</p>
            </div>
            <Bell className="w-5 h-5 text-blue-400" />
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Active</p>
              <p className="text-green-400 text-lg font-semibold">{activeAlerts.length}</p>
            </div>
            <Play className="w-5 h-5 text-green-400" />
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Triggered</p>
              <p className="text-yellow-400 text-lg font-semibold">{triggeredAlerts.length}</p>
            </div>
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Triggers</p>
              <p className="text-white text-lg font-semibold">
                {alerts.reduce((sum, alert) => sum + alert.triggerCount, 0)}
              </p>
            </div>
            <Check className="w-5 h-5 text-purple-400" />
          </div>
        </div>
      </div>

      {view === 'active' && (
        <div className="bg-gray-800 p-4 rounded-lg">
          <h4 className="text-white font-medium mb-4">Active Alerts</h4>
          
          {activeAlerts.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No active alerts</p>
              <p className="text-gray-500 text-sm">Create an alert to get notified of market events</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeAlerts.map((alert) => (
                <div key={alert.id} className="p-4 bg-gray-700 rounded-lg border border-gray-600">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h5 className="text-white font-medium">{alert.name}</h5>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(alert.type)}`}>
                          {alert.type}
                        </span>
                        <span className="text-blue-400 text-sm">{alert.symbol}</span>
                      </div>
                      
                      <p className="text-gray-300 text-sm mb-2">{alert.condition}</p>
                      
                      <div className="flex items-center space-x-4 text-xs text-gray-400">
                        <span>Created {getTimeAgo(alert.createdAt)}</span>
                        {alert.notification.email && <Mail className="w-3 h-3" />}
                        {alert.notification.webhook && <Webhook className="w-3 h-3" />}
                        {alert.notification.sound && <Bell className="w-3 h-3" />}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => toggleAlert(alert.id)}
                        className={`p-2 rounded ${alert.active ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'} transition-colors`}
                      >
                        {alert.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      
                      <button
                        onClick={() => setSelectedAlert(alert)}
                        className="p-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => deleteAlert(alert.id)}
                        className="p-2 bg-red-600 hover:bg-red-700 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'triggered' && (
        <div className="bg-gray-800 p-4 rounded-lg">
          <h4 className="text-white font-medium mb-4">Recently Triggered Alerts</h4>
          
          {triggeredAlerts.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No triggered alerts</p>
              <p className="text-gray-500 text-sm">Triggered alerts will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {triggeredAlerts.map((alert) => (
                <div key={alert.id} className="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h5 className="text-white font-medium">{alert.name}</h5>
                        <span className="bg-yellow-900/30 text-yellow-400 px-2 py-1 rounded text-xs font-medium">
                          TRIGGERED
                        </span>
                        <span className="text-blue-400 text-sm">{alert.symbol}</span>
                      </div>
                      
                      <p className="text-gray-300 text-sm mb-2">{alert.condition}</p>
                      
                      <div className="flex items-center space-x-4 text-xs text-gray-400">
                        <span>Triggered {alert.lastTriggered ? getTimeAgo(alert.lastTriggered) : 'recently'}</span>
                        <span>Count: {alert.triggerCount}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setAlerts(prev => prev.map(a => 
                            a.id === alert.id ? { ...a, triggered: false } : a
                          ));
                        }}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
                      >
                        Reset
                      </button>
                      
                      <button
                        onClick={() => deleteAlert(alert.id)}
                        className="p-2 bg-red-600 hover:bg-red-700 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'templates' && (
        <div className="bg-gray-800 p-4 rounded-lg">
          <h4 className="text-white font-medium mb-4">Alert Templates</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {alertTemplates.map((template, index) => (
              <div key={index} className="p-4 bg-gray-700 rounded-lg border border-gray-600">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-white font-medium">{template.name}</h5>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(template.type)}`}>
                    {template.type}
                  </span>
                </div>
                
                <p className="text-gray-300 text-sm mb-3">{template.description}</p>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">{template.condition}</span>
                  <button
                    onClick={() => createAlertFromTemplate(template)}
                    className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded transition-colors"
                  >
                    Use Template
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Alert Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg w-full max-w-md">
            <h4 className="text-white font-medium mb-4">Create New Alert</h4>
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-2">Alert Name</label>
                <input
                  type="text"
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600"
                  placeholder="My Alert"
                />
              </div>
              
              <div>
                <label className="block text-gray-300 text-sm mb-2">Symbol</label>
                <select className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600">
                  <option value="BTCUSDT">BTCUSDT</option>
                  <option value="ETHUSDT">ETHUSDT</option>
                  <option value="SOLUSDT">SOLUSDT</option>
                </select>
              </div>
              
              <div>
                <label className="block text-gray-300 text-sm mb-2">Alert Type</label>
                <select className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600">
                  <option value="price">Price</option>
                  <option value="volume">Volume</option>
                  <option value="change">Price Change</option>
                  <option value="rsi">RSI</option>
                  <option value="funding">Funding Rate</option>
                </select>
              </div>
              
              <div className="flex space-x-2">
                <select className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600">
                  <option value=">">Above</option>
                  <option value="<">Below</option>
                  <option value=">=">Above or Equal</option>
                  <option value="<=">Below or Equal</option>
                </select>
                
                <input
                  type="number"
                  className="flex-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600"
                  placeholder="Value"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded transition-colors"
              >
                Create Alert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedAlertSystem; 