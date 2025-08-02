import React from 'react';

const EducationPanel: React.FC = () => (
  <div className="bg-blue-50 dark:bg-blue-900 rounded shadow p-4 mb-4">
    <h2 className="font-bold text-lg mb-2">📚 PulseIntel Dashboard Guide</h2>
    <ul className="list-disc pl-5 space-y-2">
      <li>
        <b>Liquidity Heatmap:</b> Shows where the most buy and sell orders are stacked in the orderbook. Bright spots = lots of liquidity. Use this to spot support/resistance zones.
      </li>
      <li>
        <b>Orderbook Depth:</b> Visualizes the size of buy (bids) and sell (asks) orders at different prices. Steep areas = strong interest. Flat = thin liquidity.
      </li>
      <li>
        <b>Liquidation Feed:</b> Lists recent forced liquidations. Big spikes can signal market stress or opportunity.
      </li>
      <li>
        <b>How to Use:</b> Click on any chart for more info. Hover for tooltips. Use the light/dark mode toggle for your preferred view.
      </li>
    </ul>
    <div className="mt-4 text-sm text-gray-600 dark:text-gray-300">
      <b>Tip:</b> Start with BTCUSDT for the most liquidity and action!
    </div>
  </div>
);

export default EducationPanel; 