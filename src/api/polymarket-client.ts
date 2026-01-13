import axios, { AxiosInstance } from 'axios';
import {
  Market,
  Position,
  Trade,
  UserPositions,
  UserTrades,
  PolymarketConfig,
} from '../types';

/**
 * Polymarket API Client
 * Handles communication with Polymarket's various APIs
 */
export class PolymarketClient {
  private client: AxiosInstance;
  private config: PolymarketConfig;

  constructor(config: PolymarketConfig = {}) {
    this.config = {
      baseUrl: 'https://clob.polymarket.com',
      dataApiUrl: 'https://data-api.polymarket.com',
      gammaApiUrl: 'https://gamma-api.polymarket.com',
      clobApiUrl: 'https://clob.polymarket.com',
      ...config,
    };

    this.client = axios.create({
      baseURL: this.config.dataApiUrl,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
      },
      timeout: 30000,
    });
  }

  /**
   * Get user positions for a specific address
   */
  async getUserPositions(userAddress: string): Promise<UserPositions> {
    try {
      // Try multiple possible endpoint formats
      let positions: Position[] = [];
      
      try {
        // Primary endpoint format
        const response = await this.client.get(`/users/${userAddress}/positions`, {
          params: {
            active: true,
          },
        });
        positions = response.data.positions || response.data?.data || response.data || [];
      } catch (primaryError: any) {
        // Try alternative endpoint format (GraphQL or different structure)
        try {
          const altResponse = await this.client.get(`/positions`, {
            params: {
              user: userAddress,
              active: true,
            },
          });
          positions = altResponse.data.positions || altResponse.data?.data || altResponse.data || [];
        } catch (altError: any) {
          // If both fail, check if it's a 404 (no positions) or actual error
          if (primaryError.response?.status === 404 || altError.response?.status === 404) {
            return {
              user: userAddress,
              positions: [],
              totalValue: '0',
              timestamp: new Date().toISOString(),
            };
          }
          throw primaryError;
        }
      }
      
      const normalizedPositions = this.normalizePositions(Array.isArray(positions) ? positions : []);
      
      return {
        user: userAddress,
        positions: normalizedPositions,
        totalValue: this.calculateTotalValue(normalizedPositions),
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        // User has no positions
        return {
          user: userAddress,
          positions: [],
          totalValue: '0',
          timestamp: new Date().toISOString(),
        };
      }
      throw new Error(`Failed to fetch user positions: ${error.message}`);
    }
  }

  /**
   * Get user trade history
   */
  async getUserTrades(userAddress: string, limit: number = 50): Promise<UserTrades> {
    try {
      // Try multiple possible endpoint formats
      let trades: Trade[] = [];
      
      try {
        // Primary endpoint format
        const response = await this.client.get(`/users/${userAddress}/trades`, {
          params: {
            limit,
            sort: 'desc',
          },
        });
        trades = response.data.trades || response.data?.data || response.data || [];
      } catch (primaryError: any) {
        // Try alternative endpoint format
        try {
          const altResponse = await this.client.get(`/trades`, {
            params: {
              user: userAddress,
              limit,
              sort: 'desc',
            },
          });
          trades = altResponse.data.trades || altResponse.data?.data || altResponse.data || [];
        } catch (altError: any) {
          // If both fail, check if it's a 404 (no trades) or actual error
          if (primaryError.response?.status === 404 || altError.response?.status === 404) {
            return {
              user: userAddress,
              trades: [],
              totalTrades: 0,
              timestamp: new Date().toISOString(),
            };
          }
          throw primaryError;
        }
      }

      const normalizedTrades = this.normalizeTrades(Array.isArray(trades) ? trades : []);

      return {
        user: userAddress,
        trades: normalizedTrades,
        totalTrades: normalizedTrades.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return {
          user: userAddress,
          trades: [],
          totalTrades: 0,
          timestamp: new Date().toISOString(),
        };
      }
      throw new Error(`Failed to fetch user trades: ${error.message}`);
    }
  }

  /**
   * Get market information by market ID
   */
  async getMarket(marketId: string): Promise<Market> {
    try {
      const response = await this.client.get(`/markets/${marketId}`);
      return this.normalizeMarket(response.data);
    } catch (error: any) {
      throw new Error(`Failed to fetch market: ${error.message}`);
    }
  }

  /**
   * Get multiple markets
   */
  async getMarkets(marketIds: string[]): Promise<Market[]> {
    try {
      const promises = marketIds.map(id => this.getMarket(id).catch(() => null));
      const results = await Promise.all(promises);
      return results.filter((m): m is Market => m !== null);
    } catch (error: any) {
      throw new Error(`Failed to fetch markets: ${error.message}`);
    }
  }

  /**
   * Normalize position data from API response
   */
  private normalizePositions(data: any[]): Position[] {
    return data.map((item: any) => ({
      id: item.id || item.positionId || '',
      market: this.normalizeMarket(item.market || item.marketData),
      outcome: item.outcome || item.outcomeToken || '',
      quantity: item.quantity || item.size || '0',
      price: item.price || item.lastPrice || '0',
      value: item.value || this.calculatePositionValue(item),
      timestamp: item.timestamp || item.createdAt || new Date().toISOString(),
    }));
  }

  /**
   * Normalize trade data from API response
   */
  private normalizeTrades(data: any[]): Trade[] {
    return data.map((item: any) => ({
      id: item.id || item.tradeId || '',
      market: this.normalizeMarket(item.market || item.marketData),
      outcome: item.outcome || item.outcomeToken || '',
      side: item.side || (item.isBuy ? 'buy' : 'sell'),
      quantity: item.quantity || item.size || '0',
      price: item.price || item.executionPrice || '0',
      timestamp: item.timestamp || item.createdAt || new Date().toISOString(),
      transactionHash: item.transactionHash || item.txHash,
      user: item.user || item.userAddress || '',
    }));
  }

  /**
   * Normalize market data from API response
   */
  private normalizeMarket(data: any): Market {
    return {
      id: data.id || data.marketId || '',
      question: data.question || data.title || '',
      slug: data.slug || '',
      description: data.description,
      endDate: data.endDate || data.endDateISO,
      image: data.image || data.imageUrl,
      icon: data.icon,
      resolutionSource: data.resolutionSource,
      tags: data.tags || [],
      liquidity: data.liquidity ? parseFloat(data.liquidity) : undefined,
      volume: data.volume ? parseFloat(data.volume) : undefined,
      active: data.active !== undefined ? data.active : true,
    };
  }

  /**
   * Calculate total value of positions
   */
  private calculateTotalValue(positions: Position[]): string {
    const total = positions.reduce((sum, pos) => {
      const value = parseFloat(pos.value || '0');
      return sum + (isNaN(value) ? 0 : value);
    }, 0);
    return total.toFixed(6);
  }

  /**
   * Calculate position value
   */
  private calculatePositionValue(item: any): string {
    const quantity = parseFloat(item.quantity || item.size || '0');
    const price = parseFloat(item.price || item.lastPrice || '0');
    const value = quantity * price;
    return isNaN(value) ? '0' : value.toFixed(6);
  }
}
