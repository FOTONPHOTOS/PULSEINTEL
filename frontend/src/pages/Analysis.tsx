import { BarChart3 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';

export function Analysis() {
  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="text-center">
              <BarChart3 size={48} className="text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Advanced Market Analysis</h3>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400 text-center">Comprehensive charting and technical analysis tools coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
