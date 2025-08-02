import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { 
  MarketState, 
  MarketData, 
  FundingRateData, 
  LiquidationEvent,
  ExchangeData,
  OrderBookEntry
} from '../types/index';

const useMarketStore = create<MarketState>((set) => ({
  activeTab: 'dashboard',
  marketData: {},
  orderBook: {
    bids: [],
    asks: [],
  },
  alerts: [],
  fundingRates: {},
  liquidations: [],
  exchanges: [],
  setActiveTab: (tab) => set({ activeTab: tab }),
  updateMarketData: (data) =>
    set((state) => ({
      marketData: {
        ...state.marketData,
        ...Object.entries(data).reduce(
          (acc, [symbol, value]) => ({
            ...acc,
            [symbol]: { ...value, symbol },
          }),
          {}
        ),
      },
    })),
  addAlert: (alert) =>
    set((state) => ({
      alerts: [
        {
          ...alert,
          id: uuidv4(),
          read: false,
        },
        ...state.alerts,
      ],
    })),
  markAlertAsRead: (alertId) =>
    set((state) => ({
      alerts: state.alerts.map((alert) =>
        alert.id === alertId ? { ...alert, read: true } : alert
      ),
    })),
  updateFundingRates: (symbol, data) =>
    set((state) => ({
      fundingRates: {
        ...state.fundingRates,
        [symbol]: data,
      },
    })),
  updateLiquidations: (data) =>
    set({
      liquidations: data,
    }),
  updateExchanges: (data) =>
    set({
      exchanges: data,
    }),
  updateOrderBook: (data) =>
    set({
      orderBook: data,
    }),
}));

export default useMarketStore;
export { useMarketStore };
