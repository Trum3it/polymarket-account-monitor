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
      const [positions, trades] = await Promise.all([
        this.client.getUserPositions(this.options.targetAddress),
        this.client.getUserTrades(this.options.targetAddress, 20),
      ]);

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
   * Get formatted status string for display
   */
  getFormattedStatus(status: TradingStatus): string {
    const lines = [
      `\n=== Polymarket Account Monitor ===`,
      `User: ${status.user}`,
      `Last Updated: ${new Date(status.lastUpdated).toLocaleString()}`,
      `\n📊 Positions:`,
      `  Total Open Positions: ${status.totalPositions}`,
      `  Total Value: $${parseFloat(status.totalValue).toFixed(2)}`,
      `\n📈 Recent Trades: ${status.recentTrades.length}`,
    ];

    if (status.recentTrades.length > 0) {
      status.recentTrades.slice(0, 5).forEach((trade, index) => {
        lines.push(
          `  ${index + 1}. ${trade.side.toUpperCase()} ${trade.quantity} @ $${parseFloat(trade.price).toFixed(4)} - ${trade.market.question.substring(0, 50)}...`
        );
      });
    }

    if (status.openPositions.length > 0) {
      lines.push(`\n💼 Open Positions:`);
      status.openPositions.slice(0, 5).forEach((position, index) => {
        lines.push(
          `  ${index + 1}. ${position.outcome}: ${position.quantity} @ $${parseFloat(position.price).toFixed(4)} (Value: $${parseFloat(position.value).toFixed(2)})`
        );
        lines.push(`     Market: ${position.market.question.substring(0, 60)}...`);
      });
    }

    lines.push(`\n================================\n`);

    return lines.join('\n');
  }

  /**
   * Check if monitor is currently running
   */
  isRunning(): boolean {
    return this.isMonitoring;
  }
}
