#!/bin/bash

echo "WebSocket Benchmark"
echo "=================="

CONCURRENCY=1000          # Number of concurrent connections
TOTAL_REQUESTS=1000000     # Total number of requests to send

# Load test scenarios - mac M1 
# LIGHT_LOAD: CONCURRENCY=10; TOTAL_REQUESTS=1000
# MEDIUM_LOAD: CONCURRENCY=100; TOTAL_REQUESTS=10000  
# HEAVY_LOAD: CONCURRENCY=100; TOTAL_REQUESTS=100000
# STRESS_TEST: CONCURRENCY=1000; TOTAL_REQUESTS=500000
# EXTREME STRESS_TEST: CONCURRENCY=1000; TOTAL_REQUESTS=1000000
# EXTREME STRESS_TEST: CONCURRENCY=1000; TOTAL_REQUESTS=1000000

echo "Configuration:"
echo "- Concurrency: $CONCURRENCY connections"
echo "- Total Requests: $TOTAL_REQUESTS"
echo ""

# Function to setup log files
setup_logs() {
    echo "Setting up log files..."
    
    # Create logs directory if it doesn't exist
    if [ ! -d logs ]; then
        mkdir logs
        echo "Created logs directory"
    else
        echo "Logs directory already exists"
    fi
    
    # Remove existing log files if they exist
    if [ -f logs/dev-server.log ]; then
        rm logs/dev-server.log
        echo "Removed existing dev-server.log"
    fi
    if [ -f logs/test-server.log ]; then
        rm logs/test-server.log
        echo "Removed existing test-server.log"
    fi
    if [ -f logs/benchmark-results.log ]; then
        rm logs/benchmark-results.log
        echo "Removed existing benchmark-results.log"
    fi
    
    # Create fresh log files
    touch logs/dev-server.log
    touch logs/test-server.log
    touch logs/benchmark-results.log
    echo "Created fresh log files"
}

# Function to wait for server to be ready
wait_for_server() {
    local port=$1
    local server_name=$2
    
    for i in {1..30}; do
        if nc -z localhost $port 2>/dev/null; then
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
    
    npx ws-benchmark ws://localhost:$port -c $CONCURRENCY -n $TOTAL_REQUESTS 2>&1 | tee -a logs/benchmark-results.log
    echo "" >> logs/benchmark-results.log
    echo ""
}

# Setup log files
setup_logs

# Kill existing processes on ports 8080 and 8081
echo "Cleaning up existing processes..."
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
lsof -ti:8081 | xargs kill -9 2>/dev/null || true
sleep 2

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
if wait_for_server 8080 "Clustered Server"; then
    run_benchmark 8080 "Clustered Server"
else
    echo "Error: Clustered Server not ready"
    echo "Error: Clustered Server not ready" >> logs/benchmark-results.log
fi

if wait_for_server 8081 "Standalone Server"; then
    run_benchmark 8081 "Standalone Server"
else
    echo "Error: Standalone Server not ready"
    echo "Error: Standalone Server not ready" >> logs/benchmark-results.log
fi

# Cleanup
# kill $DEV_PID 2>/dev/null
# kill $TEST_PID 2>/dev/null

# echo "Benchmark completed"
# echo "Results saved to logs/benchmark-results.log" 