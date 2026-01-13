# Polymarket Account Monitor

A TypeScript-based account monitor for tracking trading status on Polymarket. This tool allows you to monitor a target account's positions, trades, and overall trading activity in real-time.

## Features

- 📊 **Real-time Position Monitoring**: Track open positions and their current values
- 📈 **Trade History**: Monitor recent trades and trading activity
- 🔄 **Automatic Updates**: Poll-based monitoring with configurable intervals
- 📝 **Type-Safe**: Full TypeScript support with comprehensive type definitions
- 🎯 **Easy Integration**: Simple API for custom monitoring solutions

## Installation

```bash
npm install
```

## Configuration

The monitor uses Polymarket's public APIs. You may need an API key for certain endpoints (check Polymarket's documentation).

Set environment variables:
```bash
export TARGET_ADDRESS=0x...  # The Ethereum address to monitor
export POLYMARKET_API_KEY=...  # Optional: API key if required
```

## Usage

### Basic Usage

```typescript
import { AccountMonitor, PolymarketClient } from './src';

const client = new PolymarketClient({
  // Optional: apiKey: 'your-api-key'
});

const monitor = new AccountMonitor(client, {
  targetAddress: '0x...',
  pollInterval: 30000, // 30 seconds
  onUpdate: (status) => {
    console.log('Trading status updated:', status);
  },
  onError: (error) => {
    console.error('Error:', error);
  },
});

// Start monitoring
await monitor.start();
```

### Command Line Usage

```bash
# Set target address
export TARGET_ADDRESS=0x1234567890123456789012345678901234567890

# Run the monitor
npm run dev
```

### Programmatic Usage

```typescript
import { AccountMonitor, PolymarketClient, TradingStatus } from './src';

async function monitorAccount(address: string) {
  const client = new PolymarketClient();
  const monitor = new AccountMonitor(client, {
    targetAddress: address,
    pollInterval: 60000, // 1 minute
    onUpdate: (status: TradingStatus) => {
      // Custom handling
      console.log(`User: ${status.user}`);
      console.log(`Total Positions: ${status.totalPositions}`);
      console.log(`Total Value: $${status.totalValue}`);
      console.log(`Recent Trades: ${status.recentTrades.length}`);
      
      // Display recent trades
      status.recentTrades.forEach(trade => {
        console.log(`${trade.side}: ${trade.quantity} @ $${trade.price}`);
      });
    },
  });

  await monitor.start();
  
  // Monitor runs until stopped
  // monitor.stop();
}
```

## API Reference

### `PolymarketClient`

Main client for interacting with Polymarket APIs.

#### Constructor
```typescript
new PolymarketClient(config?: PolymarketConfig)
```

#### Methods

- `getUserPositions(userAddress: string): Promise<UserPositions>`
  - Fetches all open positions for a user

- `getUserTrades(userAddress: string, limit?: number): Promise<UserTrades>`
  - Fetches trade history for a user

- `getMarket(marketId: string): Promise<Market>`
  - Fetches market information

### `AccountMonitor`

Monitors a target account's trading activity.

#### Constructor
```typescript
new AccountMonitor(client: PolymarketClient, options: MonitorOptions)
```

#### Methods

- `start(): Promise<void>` - Start monitoring
- `stop(): void` - Stop monitoring
- `getStatus(): Promise<TradingStatus>` - Get current status
- `getFormattedStatus(status: TradingStatus): string` - Get formatted status string
- `isRunning(): boolean` - Check if monitor is running

## Types

### `TradingStatus`
```typescript
interface TradingStatus {
  user: string;
  totalPositions: number;
  totalValue: string;
  recentTrades: Trade[];
  openPositions: Position[];
  lastUpdated: string;
}
```

### `Position`
```typescript
interface Position {
  id: string;
  market: Market;
  outcome: string;
  quantity: string;
  price: string;
  value: string;
  timestamp: string;
}
```

### `Trade`
```typescript
interface Trade {
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
```

## Development

```bash
# Build TypeScript
npm run build

# Run in development mode
npm run dev

# Watch mode
npm run watch
```

## Project Structure

```
polymarket-account-monitor/
├── src/
│   ├── api/
│   │   └── polymarket-client.ts    # API client for Polymarket
│   ├── monitor/
│   │   └── account-monitor.ts      # Main monitor class
│   ├── types/
│   │   └── index.ts                # TypeScript type definitions
│   └── index.ts                     # Main entry point
├── dist/                            # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
└── README.md
```

## Polymarket APIs

This monitor uses Polymarket's public APIs:

- **Data API**: For fetching user positions and trade history
- **Gamma API**: For market discovery and metadata
- **CLOB API**: For real-time prices and order books

For more information, visit [Polymarket Developer Documentation](https://docs.polymarket.com/).

## Notes

- The monitor uses polling by default. WebSocket support can be added for real-time updates.
- API endpoints may require authentication depending on Polymarket's current API policies.
- Rate limiting: Be mindful of API rate limits when setting poll intervals.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
