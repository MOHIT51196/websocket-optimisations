#!/bin/bash

echo "WebSocket Benchmark"
echo "=================="

# Function to wait for server to be ready
wait_for_server() {
    local port=$1
    local server_name=$2
    
    for i in {1..30}; do
        if curl -s http://localhost:$port/stats > /dev/null 2>&1; then
            return 0
        fi
        sleep 1
    done
    return 1
}

# Function to run benchmark
run_benchmark() {
    local port=$1
    local server_name=$2
    
    echo "Testing $server_name (port $port)..."
    echo "Testing $server_name (port $port)..." >> logs/benchmark-results.log
    echo "=========================================" >> logs/benchmark-results.log
    npx ws-benchmark ws://localhost:$port -c 10000 -m 100 --interval 10 2>&1 | tee -a logs/benchmark-results.log
    echo "" >> logs/benchmark-results.log
    echo ""
}

# Start servers
nohup npm run server:start > logs/dev-server.log 2>&1 &
DEV_PID=$!

nohup npm run server:test > logs/test-server.log 2>&1 &
TEST_PID=$!

sleep 3

# Clear previous results
echo "WebSocket Benchmark Results - $(date)" > logs/benchmark-results.log
echo "=====================================" >> logs/benchmark-results.log
echo "" >> logs/benchmark-results.log

# Run benchmarks
if wait_for_server 8080 "Development Server"; then
    run_benchmark 8080 "Development Server"
else
    echo "Error: Development server not ready"
    echo "Error: Development server not ready" >> logs/benchmark-results.log
fi

if wait_for_server 8081 "Test Server"; then
    run_benchmark 8081 "Test Server"
else
    echo "Error: Test server not ready"
    echo "Error: Test server not ready" >> logs/benchmark-results.log
fi

# Cleanup
kill $DEV_PID 2>/dev/null
kill $TEST_PID 2>/dev/null

echo "Benchmark completed"
echo "Results saved to logs/benchmark-results.log" 