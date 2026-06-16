export interface Position {
  id: string;
  pair: string;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  quantity: number; // in lots or direct size
  leverage: number;
  sl?: number;
  tp?: number;
  timestamp: number;
  status: 'ACTIVE' | 'CLOSED';
  closePrice?: number;
  pnl: number;
}

export interface Asset {
  symbol: string;         // e.g. "XAUUSD"
  name: string;           // e.g. "Gold / US Dollar"
  category: 'FOREX' | 'CRYPTO' | 'STOCKS' | 'INDEX';
  price: number;
  prevPrice: number;
  change24h: number;
  high24h: number;
  low24h: number;
  dexScreenerId?: string;
  coinGeckoId?: string;
  tradingViewSymbol: string;
  rating: string;         // e.g. "4.8" or "BELUM RATING"
  creator: string;        // e.g. "COINGECKO" or "DEXSCREENER"
  volume: string;         // trade or view count, e.g. "131"
  theme: 'pink' | 'purple' | 'blue' | 'yellow' | 'green'; // card header styling
  tags: string[];         // e.g. ["hot", "trending", "new"]
  description: string;
}

export interface TerminalLog {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'trade';
  message: string;
}
