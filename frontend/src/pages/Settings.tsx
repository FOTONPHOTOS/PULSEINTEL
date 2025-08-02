import React from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '../components/ui/Card';

const Settings: React.FC = () => {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Platform Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Platform settings will be available in the next update. 
            Here you'll be able to customize your experience, set default symbols, 
            timeframes, and notification preferences.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings; 