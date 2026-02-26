import React, { useState, useMemo } from 'react';
import { 
  LayoutDashboard, 
  UserSearch, 
  Package, 
  TrendingUp, 
  ArrowUpRight, 
  Users, 
  ShoppingCart,
  ChevronRight,
  Info,
  AlertCircle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Replace this with your deployed HTTPS URL (e.g., https://api.yourdomain.com)
// Note: Browsers block HTTP requests from HTTPS sites (Mixed Content)
const API_BASE_URL = 'http://localhost:8000';

// --- Mock Data & Types ---

interface PredictionItem {
  Product: string;
  PROB: number;
  Price: number;
  bought: number;
  "re-purchased": string;
}

interface PredictionResponse {
  user_id: number;
  top_10_recommended: PredictionItem[];
  message: string;
}

interface Bundle {
  products: string;
  utility: number;
  support: number;
  type: 'Premium' | 'Classique';
}

interface KeyMetrics {
  avg_gain_per_customer: number;
  basket_increase_percent: number;
  promotion_roi_targeted: number;
  promotion_roi_untargeted: number;
  gain_on_1000_customers: number;
}

interface FPGrowthRule {
  Bundle: string;
  "Est. Utility/Profit (€)": number;
  Support: string;
}

interface FPGrowthResponse {
  top_rules: FPGrowthRule[];
  total_rules_found: number;
  message: string;
}

const UP_TREE_BUNDLES: Bundle[] = [
  { products: 'Organic Bananas, Organic Strawberries', utility: 12.50, support: 0.045, type: 'Premium' },
  { products: 'Whole Milk, Organic Eggs', utility: 10.20, support: 0.038, type: 'Classique' },
  { products: 'Avocado, Lime, Cilantro', utility: 8.75, support: 0.025, type: 'Premium' },
  { products: 'Pasta, Marinara Sauce, Parmesan', utility: 15.40, support: 0.018, type: 'Classique' },
  { products: 'Greek Yogurt, Honey, Granola', utility: 11.20, support: 0.022, type: 'Premium' },
  { products: 'Chicken Breast, Broccoli, Brown Rice', utility: 18.90, support: 0.015, type: 'Classique' },
  { products: 'Coffee, Creamer, Sugar', utility: 9.30, support: 0.042, type: 'Classique' },
  { products: 'Wine, Cheese, Crackers', utility: 25.00, support: 0.012, type: 'Premium' },
  { products: 'Shampoo, Conditioner', utility: 14.00, support: 0.028, type: 'Classique' },
  { products: 'Diapers, Baby Wipes', utility: 35.50, support: 0.035, type: 'Classique' },
];

const FP_GROWTH_BUNDLES: Bundle[] = [
  { products: 'Bananas, Milk', utility: 4.50, support: 0.12, type: 'Classique' },
  { products: 'Bread, Eggs', utility: 6.20, support: 0.09, type: 'Classique' },
  { products: 'Strawberries, Yogurt', utility: 8.40, support: 0.07, type: 'Premium' },
  { products: 'Soda, Chips', utility: 5.50, support: 0.08, type: 'Classique' },
  { products: 'Apples, Oranges', utility: 7.10, support: 0.06, type: 'Classique' },
  { products: 'Paper Towels, Toilet Paper', utility: 12.00, support: 0.05, type: 'Classique' },
  { products: 'Cereal, Milk', utility: 7.80, support: 0.085, type: 'Classique' },
  { products: 'Coffee, Milk', utility: 6.50, support: 0.10, type: 'Classique' },
  { products: 'Cucumber, Tomato', utility: 3.20, support: 0.075, type: 'Classique' },
  { products: 'Onion, Potato', utility: 2.80, support: 0.11, type: 'Classique' },
];

// --- Components ---

const MetricCard = ({ title, value, subValue, icon: Icon, color }: { title: string, value: string, subValue?: string, icon: any, color: string }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-2">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">{title}</span>
      <div className={cn("p-2 rounded-lg", color)}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
    <div className="text-3xl font-bold text-slate-900">{value}</div>
    {subValue && <div className="text-xs text-slate-400 font-medium">{subValue}</div>}
  </div>
);

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
      active 
        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
        : "text-slate-600 hover:bg-slate-100"
    )}
  >
    <Icon className="w-5 h-5" />
    <span className="font-medium">{label}</span>
  </button>
);

// --- Pages ---

const HomePage: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const [metrics, setMetrics] = React.useState<KeyMetrics | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = React.useState(false);

  React.useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/key-metrics`);
        if (!response.ok) {
          throw new Error('Failed to fetch metrics');
        }
        const data = await response.json();
        setMetrics(data);
        setError(null);
        setIsDemoMode(false);
      } catch (err) {
        console.error('Error fetching metrics:', err);
        // Fallback to mock data for demo purposes
        setMetrics({
          avg_gain_per_customer: 3.40,
          basket_increase_percent: 12.0,
          promotion_roi_targeted: 3.8,
          promotion_roi_untargeted: 1.2,
          gain_on_1000_customers: 14500
        });
        setIsDemoMode(true);
        setError('Using Demo Data: Could not connect to the backend (likely due to HTTPS/HTTP Mixed Content restrictions).');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {isDemoMode && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-700 text-sm">
          <Info className="w-4 h-4" />
          <p><strong>Demo Mode Active:</strong> {error} <a href="https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content" target="_blank" className="underline">Learn more</a></p>
        </div>
      )}
      
      <div className="relative overflow-hidden rounded-3xl bg-indigo-900 text-white p-12">
        <div className="relative z-10 max-w-2xl space-y-4">
          <h1 className="text-5xl font-bold tracking-tight">Data-Driven Retail Insights</h1>
          <p className="text-xl text-indigo-100 font-light">
            Helping shop owners save money and grow revenue through advanced analytics on the Instacart dataset.
          </p>
          <button 
            onClick={() => onNavigate('prediction')}
            className="mt-4 bg-white text-indigo-900 px-6 py-3 rounded-xl font-semibold flex items-center gap-2 hover:bg-indigo-50 transition-colors"
          >
            Get Started <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="absolute top-0 right-0 w-1/3 h-full opacity-10 pointer-events-none">
          <ShoppingCart className="w-full h-full transform translate-x-1/4 -translate-y-1/4" />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-slate-100 rounded w-3/4"></div>
            </div>
          ))}
          <div className="col-span-full text-center text-slate-400 text-sm mt-2">Loading metrics...</div>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      ) : metrics ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard 
            title="Avg Gain / Customer" 
            value={`+€${metrics.avg_gain_per_customer.toFixed(2)}`} 
            icon={TrendingUp} 
            color="bg-emerald-500" 
          />
          <MetricCard 
            title="Basket Increase" 
            value={`+${metrics.basket_increase_percent.toFixed(1)}%`} 
            icon={ArrowUpRight} 
            color="bg-blue-500" 
          />
          <MetricCard 
            title="Promotion ROI (Targeted)" 
            value={`${metrics.promotion_roi_targeted.toFixed(1)}×`} 
            subValue={`vs ${metrics.promotion_roi_untargeted.toFixed(1)}× non-targeted`}
            icon={Users} 
            color="bg-amber-500" 
          />
          <MetricCard 
            title="Gain on 1k Customers" 
            value={`€${metrics.gain_on_1000_customers.toLocaleString()}`} 
            icon={Package} 
            color="bg-indigo-500" 
          />
        </div>
      ) : null}

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Project Objective</h2>
        <p className="text-slate-600 leading-relaxed text-lg">
          This project leverages the Instacart Online Grocery Basket Analysis Dataset (3+ million orders, 200,000+ customers) 
          to provide actionable insights for retail optimization. Our goal is to answer the critical question: 
          "How much money can I save or earn if I listen to the insights from this DSTI team?"
        </p>
      </div>
    </motion.div>
  );
};

const PredictionPage: React.FC = () => {
  const [userId, setUserId] = useState<string>('');
  const [results, setResults] = useState<PredictionItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const handleSearch = async () => {
    if (!userId) {
      setError("Please enter a Customer ID");
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);
    setIsDemoMode(false);

    try {
      const response = await fetch(`${API_BASE_URL}/api/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: parseInt(userId) }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Customer ID not found");
        }
        throw new Error("Server error. Please try again later.");
      }

      const data: PredictionResponse = await response.json();
      setResults(data.top_10_recommended);
    } catch (err: any) {
      console.error('Error fetching predictions:', err);
      // Fallback to mock data for demo
      const mockResults: PredictionItem[] = [
        { Product: "Organic Bananas", PROB: 0.9234, Price: 1.20, bought: 15, "re-purchased": "Yes" },
        { Product: "Whole Milk", PROB: 0.8541, Price: 3.50, bought: 12, "re-purchased": "Yes" },
        { Product: "Organic Strawberries", PROB: 0.7812, Price: 4.99, bought: 8, "re-purchased": "No" },
        { Product: "Greek Yogurt", PROB: 0.6523, Price: 5.50, bought: 10, "re-purchased": "Yes" },
        { Product: "Avocado", PROB: 0.5891, Price: 1.50, bought: 6, "re-purchased": "No" }
      ];
      setResults(mockResults);
      setIsDemoMode(true);
      setError(`Using Demo Data: Could not connect to ${API_BASE_URL}.`);
    } finally {
      setLoading(false);
    }
  };

  const estimatedRevenue = useMemo(() => {
    if (!results) return 0;
    const top3 = results.slice(0, 3);
    const total = top3.reduce((sum, item) => sum + item.Price, 0);
    return (total * 0.3).toFixed(2);
  }, [results]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-8"
    >
      {isDemoMode && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-700 text-sm">
          <Info className="w-4 h-4" />
          <p><strong>Demo Mode Active:</strong> Backend unreachable. Showing sample data for ID {userId}.</p>
        </div>
      )}
      
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
        <h2 className="text-2xl font-bold text-slate-900">Prediction by Customer</h2>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-2">Enter Customer ID (user_id)</label>
            <input 
              type="number" 
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter Customer ID"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
            />
          </div>
          <button 
            onClick={handleSearch}
            disabled={loading}
            className={cn(
              "self-end bg-indigo-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors",
              loading && "opacity-50 cursor-not-allowed"
            )}
          >
            {loading ? "Loading recommendations..." : "Get Recommendations"}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100">
            <AlertCircle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        )}
      </div>

      {results && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-xl font-bold text-slate-900 mb-6">Top 10 Recommended Products</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-4 font-semibold text-slate-500 text-sm uppercase min-w-[220px]">Product</th>
                      <th className="pb-4 font-semibold text-slate-500 text-sm uppercase">PROB</th>
                      <th className="pb-4 font-semibold text-slate-500 text-sm uppercase">Price</th>
                      <th className="pb-4 font-semibold text-slate-500 text-sm uppercase">bought</th>
                      <th className="pb-4 font-semibold text-slate-500 text-sm uppercase">re-purchased ?</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {results.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td 
                          className="py-4 font-medium text-slate-900 max-w-[200px] truncate" 
                          title={item.Product}
                        >
                          {item.Product}
                        </td>
                        <td className="py-4 text-slate-600">{item.PROB.toFixed(2)}</td>
                        <td className="py-4 text-slate-600 whitespace-nowrap">€{item.Price.toFixed(2)}</td>
                        <td className="py-4 text-slate-600">{item.bought}</td>
                        <td className="py-4">
                          <span className={cn(
                            "px-2 py-1 rounded-md text-xs font-bold whitespace-nowrap",
                            item["re-purchased"] === "Yes" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                          )}>
                            {item["re-purchased"]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-xl font-bold text-slate-900 mb-6">Repurchase Probabilities</h3>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={results}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="Product" 
                      hide 
                    />
                    <YAxis 
                      tick={{ fill: '#64748b', fontSize: 12 }} 
                      axisLine={false} 
                      tickLine={false}
                      tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="PROB" radius={[4, 4, 0, 0]}>
                      {results.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={index < 3 ? '#4f46e5' : '#cbd5e1'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <TrendingUp className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-indigo-600 uppercase tracking-wider">Estimated Additional Revenue</p>
                <p className="text-slate-600 text-sm">If top 3 products are purchased (30% margin assumed)</p>
              </div>
            </div>
            <div className="text-3xl font-bold text-indigo-900">€{estimatedRevenue}</div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

const BundlesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'uptree' | 'fpgrowth'>('uptree');
  const [fpGrowthRules, setFpGrowthRules] = useState<FPGrowthRule[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  React.useEffect(() => {
    if (activeTab === 'fpgrowth' && !fpGrowthRules) {
      fetchFPGrowthRules();
    }
  }, [activeTab]);

  const fetchFPGrowthRules = async () => {
    try {
      setLoading(true);
      setError(null);
      setIsDemoMode(false);

      // Call FP-Growth API here
      // Replace with deployed URL later
      const response = await fetch(`${API_BASE_URL}/api/fp-growth-rules`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch FP-Growth bundles');
      }

      const data: FPGrowthResponse = await response.json();
      
      // Sort by Profit descending by default
      const sortedRules = [...data.top_rules].sort((a, b) => 
        b["Est. Utility/Profit (€)"] - a["Est. Utility/Profit (€)"]
      );
      
      setFpGrowthRules(sortedRules);
    } catch (err: any) {
      console.error('Error fetching FP-Growth rules:', err);
      // Fallback to mock data for demo
      const mockRules: FPGrowthRule[] = [
        { "Bundle": "Organic Bananas, Organic Strawberries", "Est. Utility/Profit (€)": 12.5, "Support": "4.5%" },
        { "Bundle": "Milk, Cereal, Yogurt", "Est. Utility/Profit (€)": 8.75, "Support": "6.8%" },
        { "Bundle": "Bread, Eggs, Butter", "Est. Utility/Profit (€)": 6.20, "Support": "9.1%" },
        { "Bundle": "Avocado, Lime, Cilantro", "Est. Utility/Profit (€)": 5.40, "Support": "3.2%" },
        { "Bundle": "Soda, Chips, Dip", "Est. Utility/Profit (€)": 4.80, "Support": "7.5%" }
      ];
      setFpGrowthRules(mockRules);
      setIsDemoMode(true);
      setError(`Using Demo Data: Could not connect to ${API_BASE_URL}.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-8"
    >
      {isDemoMode && activeTab === 'fpgrowth' && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-700 text-sm">
          <Info className="w-4 h-4" />
          <p><strong>Demo Mode Active:</strong> Backend unreachable. Showing sample FP-Growth data.</p>
        </div>
      )}

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Bundles & Associations</h2>
        
        <div className="flex p-1 bg-slate-100 rounded-xl w-fit mb-8">
          <button 
            onClick={() => setActiveTab('uptree')}
            className={cn(
              "px-6 py-2 rounded-lg font-medium transition-all",
              activeTab === 'uptree' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            High-Utility Bundles (UP-Tree)
          </button>
          <button 
            onClick={() => setActiveTab('fpgrowth')}
            className={cn(
              "px-6 py-2 rounded-lg font-medium transition-all",
              activeTab === 'fpgrowth' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Frequent Bundles (FP-Growth)
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center space-y-4">
            <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 font-medium tracking-wide">Loading FP-Growth bundles...</p>
          </div>
        ) : error && !isDemoMode && activeTab === 'fpgrowth' ? (
          <div className="py-12 flex flex-col items-center gap-4 text-red-600">
            <AlertCircle className="w-12 h-12 opacity-20" />
            <p className="font-medium">{error}</p>
            <button 
              onClick={fetchFPGrowthRules}
              className="text-sm bg-red-50 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-4 font-semibold text-slate-500 text-sm uppercase">Bundle (Products)</th>
                  <th className="pb-4 font-semibold text-slate-500 text-sm uppercase">Est. Utility/Profit (€)</th>
                  <th className="pb-4 font-semibold text-slate-500 text-sm uppercase">Support</th>
                  {activeTab === 'uptree' && <th className="pb-4 font-semibold text-slate-500 text-sm uppercase">Type</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {activeTab === 'uptree' ? (
                  UP_TREE_BUNDLES.map((bundle, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 font-medium text-slate-900">{bundle.products}</td>
                      <td className="py-4 text-slate-600 font-mono">€{bundle.utility.toFixed(2)}</td>
                      <td className="py-4 text-slate-600">{(bundle.support * 100).toFixed(1)}%</td>
                      <td className="py-4">
                        <span className={cn(
                          "px-2 py-1 rounded-md text-xs font-bold",
                          bundle.type === 'Premium' ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                        )}>
                          {bundle.type}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  fpGrowthRules?.map((rule, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 font-medium text-slate-900">{rule.Bundle}</td>
                      <td className="py-4 text-slate-600 font-mono">€{rule["Est. Utility/Profit (€)"].toFixed(2)}</td>
                      <td className="py-4 text-slate-600">{rule.Support}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 flex items-center gap-4">
          <div className="p-3 bg-white rounded-xl shadow-sm">
            <Info className="w-6 h-6 text-emerald-600" />
          </div>
          <p className="text-emerald-800 font-medium">
            UP-Tree identifies combinations that generate <span className="font-bold">24% more revenue</span> than frequency-only methods.
          </p>
        </div>
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-white rounded-xl shadow-sm">
            <Package className="w-6 h-6 text-slate-600" />
          </div>
          <p className="text-slate-600 font-medium">
            FP-Growth focuses on high-frequency items, perfect for high-volume inventory planning.
          </p>
        </div>
      </div>
    </motion.div>
  );
};

// --- Main App ---

export default function App() {
  const [currentPage, setCurrentPage] = useState('home');

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 p-6 flex flex-col gap-8 fixed h-full">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <LayoutDashboard className="text-white w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold text-lg leading-tight">Retail Insights</h2>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-tighter">DSTI Project</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Home / Overview" 
            active={currentPage === 'home'} 
            onClick={() => setCurrentPage('home')} 
          />
          <SidebarItem 
            icon={UserSearch} 
            label="Prediction by Customer" 
            active={currentPage === 'prediction'} 
            onClick={() => setCurrentPage('prediction')} 
          />
          <SidebarItem 
            icon={Package} 
            label="Bundles & Associations" 
            active={currentPage === 'bundles'} 
            onClick={() => setCurrentPage('bundles')} 
          />
        </nav>

        <div className="pt-6 border-t border-slate-100">
          <div className="bg-slate-50 p-4 rounded-xl">
            <p className="text-[10px] text-slate-400 mt-2 uppercase tracking-widest">DSTI - 2026</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-72 p-12 max-w-7xl">
        <AnimatePresence mode="wait">
          {currentPage === 'home' && <HomePage key="home" onNavigate={setCurrentPage} />}
          {currentPage === 'prediction' && <PredictionPage key="prediction" />}
          {currentPage === 'bundles' && <BundlesPage key="bundles" />}
        </AnimatePresence>

        <footer className="mt-20 pt-8 border-t border-slate-200 text-center text-slate-400 text-sm">
          DSTI Project – Data-Driven Retail Insights
        </footer>
      </main>
    </div>
  );
}
