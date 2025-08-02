import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  BarChart2, 
  TrendingUp, 
  BarChart, 
  AlertTriangle, 
  Zap, 
  Activity, 
  Layers, 
  Briefcase, 
  RefreshCcw, 
  Clock, 
  Settings, 
  Disc,
  GitMerge,
  Grid,
  PieChart,
  Hash,
  Eye,
  List,
  FileText,
  Code,
  BarChart3,
  Monitor
} from 'lucide-react';

type SidebarLink = {
  name: string;
  icon: React.ReactNode;
  path: string;
  isNew?: boolean;
  isComingSoon?: boolean;
};

type SidebarCategory = {
  title: string;
  links: SidebarLink[];
};

export const Sidebar: React.FC = () => {
  const sidebarCategories: SidebarCategory[] = [
    {
      title: "Dashboard",
      links: [
        {
          name: "Overview",
          icon: <BarChart2 size={20} />,
          path: "/dashboard",
        }
      ]
    },
    {
      title: "Trading Charts",
      links: [
        {
          name: "SuperChart",
          icon: <BarChart3 size={20} />,
          path: "/supercharts",
          isNew: true,
        },
        {
          name: "🔥 Alpha Terminal",
          icon: <Monitor size={20} />,
          path: "/alpha-terminal",
          isNew: true,
        }
      ]
    },
    {
      title: "Market Data",
      links: [
        {
          name: "Funding Rates",
          icon: <RefreshCcw size={20} />,
          path: "/funding-rates",
        },
        {
          name: "Liquidations",
          icon: <AlertTriangle size={20} />,
          path: "/liquidations",
        },
        {
          name: "Exchanges",
          icon: <Briefcase size={20} />,
          path: "/exchanges",
        },
        {
          name: "Open Interest",
          icon: <Layers size={20} />,
          path: "/open-interest",
        },
        {
          name: "Order Flow",
          icon: <Activity size={20} />,
          path: "/order-flow",
        }
      ]
    },
    {
      title: "Analysis",
      links: [
        {
          name: "Market Scanner",
          icon: <Disc size={20} />,
          path: "/market-scanner",
          isNew: true,
        },
        {
          name: "Market Analyzer",
          icon: <GitMerge size={20} />,
          path: "/market-analyzer",
          isNew: true,
        },
        {
          name: "Correlation Matrix",
          icon: <Grid size={20} />,
          path: "/correlation-matrix",
          isNew: true,
        },
        {
          name: "Liquidity Heatmaps",
          icon: <PieChart size={20} />,
          path: "/liquidity-heatmaps",
          isNew: true,
        },
        {
          name: "Whale Tracking",
          icon: <BarChart size={20} />,
          path: "/whale-tracking",
        },
        {
          name: "Sentiment",
          icon: <TrendingUp size={20} />,
          path: "/sentiment",
        },
        {
          name: "Arbitrage",
          icon: <Zap size={20} />,
          path: "/arbitrage",
        }
      ]
    },
    {
      title: "🚀 Order Flow Suite",
      links: [
        {
          name: "CVD Analysis",
          icon: <BarChart3 size={20} />,
          path: "/cvd",
          isNew: true,
        },
        {
          name: "Volume Profile",
          icon: <PieChart size={20} />,
          path: "/volume-profile",
          isNew: true,
        },
        {
          name: "Advanced Delta",
          icon: <Activity size={20} />,
          path: "/advanced-delta",
          isNew: true,
        },
        {
          name: "VWAP Suite",
          icon: <TrendingUp size={20} />,
          path: "/vwap-suite",
          isNew: true,
        },
        {
          name: "Market Profile",
          icon: <Grid size={20} />,
          path: "/market-profile",
          isNew: true,
        }
      ]
    },
    {
      title: "Trading Tools",
      links: [
        {
          name: "Signals",
          icon: <Hash size={20} />,
          path: "/signals",
        },
        {
          name: "Custom Alerts",
          icon: <Eye size={20} />,
          path: "/custom-alerts",
        },
        {
          name: "Watchlists",
          icon: <List size={20} />,
          path: "/watchlists",
        }
      ]
    },
    {
      title: "Developer",
      links: [
        {
          name: "Data Export",
          icon: <FileText size={20} />,
          path: "/data-export",
        },
        {
          name: "API Access",
          icon: <Code size={20} />,
          path: "/api-access",
        },
        {
          name: "Settings",
          icon: <Settings size={20} />,
          path: "/settings",
        }
      ]
    }
  ];

  return (
    <aside className="w-56 h-full bg-gray-900 border-r border-gray-800 overflow-y-auto">
      <div className="px-4 py-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center">
            <Clock className="h-5 w-5 text-blue-500 mr-2" />
            <span>PulseIntel</span>
          </h2>
          <span className="bg-blue-600 text-[10px] font-bold text-white px-1.5 py-0.5 rounded">BETA</span>
        </div>
        <p className="text-gray-500 text-xs mt-1">Real-time Market Intelligence</p>
      </div>
      
      <div className="mt-2">
        {sidebarCategories.map((category, index) => (
          <div key={index} className="mb-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase px-4 my-2">{category.title}</h3>
            <ul className="space-y-1">
              {category.links.map((link, linkIndex) => (
                <li key={linkIndex}>
                  <NavLink
                    to={link.path}
                    className={({ isActive }) =>
                      `flex items-center px-4 py-2 text-sm ${
                        isActive
                          ? 'text-white bg-gray-800'
                          : 'text-gray-400 hover:bg-gray-800/40 hover:text-gray-300'
                      } transition-colors rounded-lg mx-2 relative`
                    }
                  >
                    <span className="mr-3 text-gray-500">{link.icon}</span>
                    {link.name}
                    {link.isNew && (
                      <span className="ml-2 bg-green-600/30 text-green-400 text-[9px] font-bold uppercase rounded px-1 py-0.5">
                        New
                      </span>
                    )}
                    {link.isComingSoon && (
                      <span className="ml-2 bg-gray-700 text-gray-400 text-[9px] font-bold uppercase rounded px-1 py-0.5">
                        Soon
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      
      <div className="border-t border-gray-800 mt-4 pt-4 px-4 pb-6">
        <div className="flex flex-col space-y-2">
          <div className="text-xs font-bold text-gray-500">DATA SOURCES</div>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
            <span className="text-xs text-gray-400">Binance</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
            <span className="text-xs text-gray-400">Bybit</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-gray-600 rounded-full mr-2"></div>
            <span className="text-xs text-gray-400">Bitfinex (Coming Soon)</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-gray-600 rounded-full mr-2"></div>
            <span className="text-xs text-gray-400">OKX (Coming Soon)</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-gray-500">Realtime Updates</span>
            <div className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
              <span className="text-xs text-green-500">Active</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
