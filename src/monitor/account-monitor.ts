import { PolymarketClient } from '../api/polymarket-client';
import {
  TradingStatus,
  MonitorOptions,
  Position,
  Trade,
} from '../types';

/**
 * Polymarket Account Monitor
 * Monitors a target account's trading status and provides real-time updates
 */
export class AccountMonitor {
  private client: PolymarketClient;
  private options: Required<MonitorOptions>;
  private pollIntervalId?: NodeJS.Timeout;
  private isMonitoring: boolean = false;
  private lastStatus?: TradingStatus;
  private lastTradeIds: Set<string> = new Set();

  constructor(client: PolymarketClient, options: MonitorOptions) {
    this.client = client;
    this.options = {
      pollInterval: options.pollInterval || 30000, // Default 30 seconds
      enableWebSocket: options.enableWebSocket || false,
      onUpdate: options.onUpdate || (() => {}),
      onError: options.onError || ((error) => console.error('Monitor error:', error)),
      targetAddress: options.targetAddress,
    };

    if (!this.options.targetAddress) {
      throw new Error('Target address is required');
    }
  }

  /**
   * Start monitoring the target account
   */
  async start(): Promise<void> {
    if (this.isMonitoring) {
      console.warn('Monitor is already running');
      return;
    }

    this.isMonitoring = true;
    console.log(`Starting monitor for address: ${this.options.targetAddress}`);

    // Initial fetch
    await this.updateStatus();

    // Start polling
    this.pollIntervalId = setInterval(
      () => this.updateStatus(),
      this.options.pollInterval
    );

    if (this.options.enableWebSocket) {
      // WebSocket monitoring would be implemented here
      // For now, we use polling
      console.log('WebSocket monitoring not yet implemented, using polling');
    }
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = undefined;
    }
    console.log('Monitor stopped');
  }

  /**
   * Get current trading status
   */
  async getStatus(): Promise<TradingStatus> {
    try {
      // Use allSettled so one failure doesn't break the other
      const [positionsResult, tradesResult] = await Promise.allSettled([
        this.client.getUserPositions(this.options.targetAddress),
        this.client.getUserTrades(this.options.targetAddress, 20),
      ]);

      // Extract positions (handle both success and failure)
      const positions = positionsResult.status === 'fulfilled' 
        ? positionsResult.value 
        : {
            user: this.options.targetAddress,
            positions: [],
            totalValue: '0',
            timestamp: new Date().toISOString(),
          };

      // Extract trades (handle both success and failure)
      const trades = tradesResult.status === 'fulfilled'
        ? tradesResult.value
        : {
            user: this.options.targetAddress,
            trades: [],
            totalTrades: 0,
            timestamp: new Date().toISOString(),
          };

      // Log warnings for failures
      if (positionsResult.status === 'rejected') {
        console.warn('Failed to fetch positions:', positionsResult.reason?.message || 'Unknown error');
      }
      if (tradesResult.status === 'rejected') {
        console.warn('Failed to fetch trades:', tradesResult.reason?.message || 'Unknown error');
      }

      const status: TradingStatus = {
        user: this.options.targetAddress,
        totalPositions: positions.positions.length,
        totalValue: positions.totalValue,
        recentTrades: trades.trades.slice(0, 10), // Last 10 trades
        openPositions: positions.positions,
        lastUpdated: new Date().toISOString(),
      };

      return status;
    } catch (error: any) {
      this.options.onError(error);
      throw error;
    }
  }

  /**
   * Update status and notify if there are changes
   */
  private async updateStatus(): Promise<void> {
    try {
      const status = await this.getStatus();
      const hasChanges = this.detectChanges(status);

      if (hasChanges || !this.lastStatus) {
        this.lastStatus = status;
        this.options.onUpdate(status);
      }
    } catch (error: any) {
      this.options.onError(error);
    }
  }

  /**
   * Detect if there are significant changes in the status
   */
  private detectChanges(status: TradingStatus): boolean {
    if (!this.lastStatus) {
      return true;
    }

    // Check for new trades
    const currentTradeIds = new Set(status.recentTrades.map(t => t.id));
    const hasNewTrades = status.recentTrades.some(
      trade => !this.lastTradeIds.has(trade.id)
    );

    if (hasNewTrades) {
      this.lastTradeIds = currentTradeIds;
      return true;
    }

    // Check for position changes
    if (status.totalPositions !== this.lastStatus.totalPositions) {
      return true;
    }

    // Check for value changes (more than 1% difference)
    const lastValue = parseFloat(this.lastStatus.totalValue);
    const currentValue = parseFloat(status.totalValue);
    if (Math.abs(currentValue - lastValue) / Math.max(lastValue, 0.01) > 0.01) {
      return true;
    }

    return false;
  }

  /**
   * Get formatted status string for display (simplified, user-friendly)
   */
  getFormattedStatus(status: TradingStatus): string {
    const totalValue = parseFloat(status.totalValue);
    const lines = [
      `\n╔══════════════════════════════════════════════════════════╗`,
      `║     Polymarket Account Monitor - Trading Status            ║`,
      `╚══════════════════════════════════════════════════════════╝`,
      `\n👤 Account: ${status.user.substring(0, 10)}...${status.user.substring(status.user.length - 8)}`,
      `🕐 Last Updated: ${new Date(status.lastUpdated).toLocaleString()}`,
      `\n📊 Portfolio Summary:`,
      `   • Open Positions: ${status.totalPositions}`,
      `   • Total Value: $${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    ];

    // Recent Trades (historical/completed trades)
    if (status.recentTrades.length > 0) {
      lines.push(`\n📈 Recent Trading Activity (Completed Trades - Last ${Math.min(5, status.recentTrades.length)}):`);
      status.recentTrades.slice(0, 5).forEach((trade, index) => {
        const side = trade.side.toUpperCase();
        const sideIcon = trade.side === 'buy' ? '🟢' : '🔴';
        const quantity = parseFloat(trade.quantity).toLocaleString('en-US', { maximumFractionDigits: 2 });
        const price = parseFloat(trade.price).toFixed(4);
        const marketTitle = trade.market.question || 'Unknown Market';
        const shortTitle = marketTitle.length > 45 ? marketTitle.substring(0, 42) + '...' : marketTitle;
        
        lines.push(
          `   ${index + 1}. ${sideIcon} ${side} ${quantity} shares @ $${price}`
        );
        lines.push(`      ${shortTitle}`);
        if (trade.transactionHash) {
          lines.push(`      TX: ${trade.transactionHash.substring(0, 10)}...${trade.transactionHash.substring(trade.transactionHash.length - 8)}`);
        }
      });
    } else {
      lines.push(`\n📈 Recent Trading Activity: No completed trades found`);
    }

    // Top Positions (currently open/active positions)
    if (status.openPositions.length > 0) {
      lines.push(`\n💼 Currently Open Positions (Active - showing ${Math.min(5, status.openPositions.length)} of ${status.openPositions.length}):`);
      status.openPositions.slice(0, 5).forEach((position, index) => {
        const outcome = position.outcome;
        const quantity = parseFloat(position.quantity).toLocaleString('en-US', { maximumFractionDigits: 2 });
        const price = parseFloat(position.price).toFixed(4);
        const value = parseFloat(position.value);
        const valueStr = value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const marketTitle = position.market.question || 'Unknown Market';
        const shortTitle = marketTitle.length > 50 ? marketTitle.substring(0, 47) + '...' : marketTitle;
        
        lines.push(
          `   ${index + 1}. ${outcome}: ${quantity} shares @ $${price}`
        );
        lines.push(`      Current Value: $${valueStr}`);
        lines.push(`      Market: ${shortTitle}`);
      });
    } else {
      lines.push(`\n💼 Currently Open Positions: No active positions`);
    }

    lines.push(`\n╚══════════════════════════════════════════════════════════╝\n`);

    return lines.join('\n');
  }

  /**
   * Check if monitor is currently running
   */
  isRunning(): boolean {
    return this.isMonitoring;
  }
}
