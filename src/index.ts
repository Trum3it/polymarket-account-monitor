/**
 * Polymarket Account Monitor
 * Main entry point for the application
 */

export { AccountMonitor } from './monitor/account-monitor';
export { PolymarketClient } from './api/polymarket-client';
export * from './types';

// Example usage
if (require.main === module) {
  const targetAddress = process.env.TARGET_ADDRESS || '';
  
  if (!targetAddress) {
    console.error('Please set TARGET_ADDRESS environment variable');
    console.log('Usage: TARGET_ADDRESS=0x... npm run dev');
    process.exit(1);
  }

  const client = new PolymarketClient({
    // Add API key if needed
    // apiKey: process.env.POLYMARKET_API_KEY,
  });

  const monitor = new AccountMonitor(client, {
    targetAddress,
    pollInterval: 30000, // Poll every 30 seconds
    enableWebSocket: false,
    onUpdate: (status) => {
      console.log(monitor.getFormattedStatus(status));
    },
    onError: (error) => {
      console.error('Monitor error:', error.message);
    },
  });

  // Start monitoring
  monitor.start().catch((error) => {
    console.error('Failed to start monitor:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down monitor...');
    monitor.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\nShutting down monitor...');
    monitor.stop();
    process.exit(0);
  });
}
