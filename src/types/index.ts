/**
 * Polymarket API Types and Interfaces
 */

export interface Market {
  id: string;
  question: string;
  slug: string;
  description?: string;
  endDate?: string;
  image?: string;
  icon?: string;
  resolutionSource?: string;
  tags?: string[];
  liquidity?: number;
  volume?: number;
  active?: boolean;
}

export interface Position {
  id: string;
  market: Market;
  outcome: string;
  quantity: string;
  price: string;
  value: string;
  timestamp: string;
}

export interface Trade {
  id: string;
  market: Market;
  outcome: string;
  side: 'buy' | 'sell';
  quantity: string;
  price: string;
  timestamp: string;
  transactionHash?: string;
  user: string;
}

export interface UserPositions {
  user: string;
  positions: Position[];
  totalValue: string;
  timestamp: string;
}

export interface UserTrades {
  user: string;
  trades: Trade[];
  totalTrades: number;
  timestamp: string;
}

export interface TradingStatus {
  user: string;
  totalPositions: number;
  totalValue: string;
  recentTrades: Trade[];
  openPositions: Position[];
  lastUpdated: string;
}

export interface PolymarketConfig {
  apiKey?: string;
  baseUrl?: string;
  dataApiUrl?: string;
  gammaApiUrl?: string;
  clobApiUrl?: string;
}

export interface MonitorOptions {
  targetAddress: string;
  pollInterval?: number; // in milliseconds
  enableWebSocket?: boolean;
  onUpdate?: (status: TradingStatus) => void;
  onError?: (error: Error) => void;
}
