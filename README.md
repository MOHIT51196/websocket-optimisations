# WebSocket Server Optimization Project

A Node.js WebSocket server implementation comparing clustered vs single-threaded performance under high load. Built to understand when clustering actually helps and when it doesn't.

## What This Project Does

I built this to answer a simple question: **Does clustering improve WebSocket server performance?** The answer is more nuanced than you might think.

### Key Findings
- **Clustering = Better reliability** (100% success rate under stress)
- **Single-threaded = Faster responses** (but fails under high load)
- **The sweet spot**: 100-500 concurrent connections
- **Beyond 1000 connections**: Clustering becomes essential

## Project Structure

```
ws-optimisation/
├── server/
│   ├── server.js          # Main server (supports both clustered/standalone)
│   └── connection.js      # WebSocket message handler
├── client/
│   ├── app.js             # Client manager (HTTP API for sending messages)
│   └── client.js          # WebSocket client implementation
├── env/
│   ├── server.dev.env     # Clustered server config (port 8080)
│   ├── server.test.env    # Standalone server config (port 8081)
│   └── client.dev.env     # Client config
├── utils/
│   └── logger.js          # Pino logger setup
├── logs/                  # Generated during benchmarks
├── benchmark.sh           # Automated load testing
└── package.json
```

## Quick Start

```bash
# Install dependencies
npm install

# Run clustered server (8 workers on M1 Mac)
npm run server:start

# Run standalone server (single thread)
npm run server:test

# Run benchmark (kills existing processes, starts fresh servers)
./benchmark.sh
```

## Benchmark Results

### Test Machine Specifications
- **Hardware**: Apple M1 MacBook Air (2020)
- **Architecture**: ARM64 (Apple Silicon)
- **CPU**: Apple M1 (8 cores)
- **Memory**: 8 GB unified memory
- **OS**: macOS 22.6.0 (Darwin)
- **Node.js**: v22.3.0
- **Architecture**: ARM64_T8103

### Stress Test: 1,000 Concurrent Connections, 500,000 Total Requests

| Metric | Clustered (8 workers) | Standalone (1 thread) |
|--------|----------------------|----------------------|
| **Success Rate** | 100% | 56.5% |
| **Total Completed** | 500,000 | 282,500 |
| **Failed Requests** | 0 | 217,500 |
| **Avg Response Time** | 11.5ms | 6.3ms |
| **Max Response Time** | 13.6ms | 2.7ms |

### The Trade-off
- **Clustered**: Slower but bulletproof (100% success)
- **Standalone**: Faster but breaks under load (43.5% failure rate)

### Performance Notes
- **8 worker processes** match the M1's 8 CPU cores
- **ARM64 architecture** shows excellent single-threaded performance
- **Unified memory** reduces inter-process communication overhead
- **Apple Silicon** provides consistent performance under load

## Configuration

### Server Environment Variables
```bash
# server.dev.env (clustered)
PORT=8080
LOG_LEVEL='debug'
CLUSTER_ENABLED=true
CLUSTER_CACHE_ENABLED=false

# server.test.env (standalone)  
PORT=8081
LOG_LEVEL='debug'
CLUSTER_ENABLED=false
CLUSTER_CACHE_ENABLED=false
```

### Benchmark Configuration
```bash
# benchmark.sh - modify these for different tests
CONCURRENCY=1000          # Concurrent connections
TOTAL_REQUESTS=500000     # Total requests across all connections
```

## How the Benchmark Works

The `benchmark.sh` script:

1. **Kills existing processes** on ports 8080/8081 (prevents conflicts)
2. **Starts fresh servers** using `nohup` (non-blocking)
3. **Waits for servers** to be ready (port connectivity check)
4. **Runs ws-benchmark** with specified concurrency/requests
5. **Saves results** to `logs/benchmark-results.log`
6. **Cleans up** processes

### Load Test Scenarios
```bash
# Light: 10 connections, 1K requests
CONCURRENCY=10; TOTAL_REQUESTS=1000

# Medium: 100 connections, 10K requests  
CONCURRENCY=100; TOTAL_REQUESTS=10000

# Heavy: 500 connections, 50K requests
CONCURRENCY=500; TOTAL_REQUESTS=50000

# Stress: 1K connections, 500K requests
CONCURRENCY=1000; TOTAL_REQUESTS=500000
```

## Server Architecture

### Clustered Server (server.dev.env)
- **8 worker processes** (based on `os.availableParallelism()`)
- **Shared connection counting** via Memcached (optional)
- **Automatic worker management** with restart on failure
- **Load distribution** across workers

### Standalone Server (server.test.env)
- **Single-threaded** event loop
- **Direct connection handling**
- **No inter-process overhead**
- **Simpler memory management**

## Message Processing

Both servers handle WebSocket messages the same way:
```javascript
ws.on("message", (msg) => {
    logger.debug(`Message received from client : ${msg.toString()}`);
    ws.send(JSON.stringify({
        sha: crypto.createHash("sha256").update(msg.toString()).digest("hex"),
    }));
});
```

Simple SHA256 hash calculation - intentionally lightweight to focus on connection handling.

## Monitoring

### Log Files
- `logs/dev-server.log` - Clustered server (8 workers)
- `logs/test-server.log` - Standalone server
- `logs/benchmark-results.log` - Benchmark results

### Key Metrics
- Connection count per worker
- Message processing times
- Memory usage per process
- Error rates and types

## When to Use Clustering

**Use Clustering When:**
- Concurrent connections > 500
- Need 100% reliability under load
- Have multiple CPU cores
- Processing is CPU-intensive

**Use Single-threaded When:**
- Concurrent connections < 100
- Simple message processing
- Memory is constrained
- Single CPU core available

## Dependencies

```json
{
  "express": "^5.1.0",
  "ws": "^8.18.3", 
  "pino": "^9.7.0",
  "memcached": "^2.2.2",
  "morgan": "^1.10.1"
}
```

## Development

```bash
# Development mode with auto-restart
npm run server:dev

# Client development
npm run client:dev

# Manual testing
curl http://localhost:8080/stats
curl http://localhost:8081/stats
```

## Lessons Learned

1. **Clustering isn't always faster** - but it's more reliable
2. **Connection limits matter** - single-threaded breaks around 500-1000 connections
3. **Memory per worker** - each worker has its own memory space
4. **Inter-process communication** - adds overhead but provides stability
5. **Load testing is crucial** - you won't see the difference until you stress test

## Next Steps

- Add Redis for shared state instead of Memcached
- Implement sticky sessions for WebSocket clustering
- Add more complex message processing scenarios
- Test with actual network latency
- Compare with other WebSocket libraries

---

Built with Node.js, Express, and the `ws` library. Benchmarking with `ws-benchmark`. 