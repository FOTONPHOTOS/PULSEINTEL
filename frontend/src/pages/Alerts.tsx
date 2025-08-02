import React, { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { apiConfig } from '../apiConfig';

interface Alert {
  id: string;
  symbol: string;
  condition: string;
  value: number;
  enabled: boolean;
  created: number;
  triggered: boolean;
}

export function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${apiConfig.REST_API_SERVICE}/api/alerts`);
        
        if (response.ok) {
          const data = await response.json();
          setAlerts(data.alerts || []);
        } else {
          // If API not available, show placeholder
          setAlerts([]);
        }
      } catch (err) {
        console.error('Failed to fetch alerts:', err);
        setError('Alert system temporarily unavailable');
        setAlerts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Bell className="h-8 w-8 text-blue-400" />
            Alert Management Center
          </h1>
          <p className="text-gray-400 mt-2">Create, manage, and monitor your trading alerts</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Alert
        </button>
      </div>

      {error && (
        <Card className="mb-6 border-yellow-500/20 bg-yellow-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-yellow-400">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Active Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 mx-auto text-gray-600 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No alerts configured</h3>
              <p className="text-gray-400">Create your first alert to get started with notifications</p>
            </div>
          ) : (
            <div className="space-y-4">
              {alerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                  <div>
                    <div className="font-medium text-white">{alert.symbol}</div>
                    <div className="text-sm text-gray-400">{alert.condition}: {alert.value}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      alert.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {alert.enabled ? 'Active' : 'Disabled'}
                    </span>
                    <button className="text-red-400 hover:text-red-300">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}