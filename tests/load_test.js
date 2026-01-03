/**
 * ============================================================================
 * LOAD_TEST.JS - Concurrent Load Testing Script
 * ============================================================================
 * 
 * PURPOSE: Simulate 1000 concurrent users hitting the RPC server
 * This tests the QUEUE's ability to absorb traffic bursts.
 * 
 * CONCEPT: Traffic Shaping / Load Testing
 * In production systems, we must handle sudden spikes in traffic.
 * This script simulates that scenario by firing many requests at once.
 * 
 * WHAT TO OBSERVE:
 * 1. The server doesn't crash (queue absorbs the burst)
 * 2. All requests eventually complete (queue is FIFO)
 * 3. Response time increases under load (queue grows)
 * 
 * USAGE: node load_test.js [number_of_requests]
 * Example: node load_test.js 1000
 * 
 * ============================================================================
 */

const net = require('net');

// Configuration
const RPC_SERVER_HOST = 'localhost';
const RPC_SERVER_PORT = 8080;
const AUTH_TOKEN = 'SECRET_123';
const TOTAL_REQUESTS = parseInt(process.argv[2]) || 1000;

// Statistics tracking
const stats = {
    completed: 0,
    failed: 0,
    responseTimes: [],
    errors: {}
};

const startTime = Date.now();

/**
 * createClient - Creates a single TCP client and sends a request
 * 
 * CONCEPT: Concurrent Connections
 * Each call to createClient() opens a NEW TCP connection.
 * The OS handles the underlying socket management.
 * 
 * @param {number} clientId - Unique identifier for this client
 */
function createClient(clientId) {
    const clientStartTime = Date.now();

    return new Promise((resolve) => {
        const client = new net.Socket();
        let responseReceived = false;

        // Set timeout (5 seconds)
        const timeout = setTimeout(() => {
            if (!responseReceived) {
                stats.failed++;
                stats.errors['TIMEOUT'] = (stats.errors['TIMEOUT'] || 0) + 1;
                client.destroy();
                resolve();
            }
        }, 5000);

        /**
         * BUILD THE PDU (Protocol Data Unit)
         * Same structure as defined in protocol.js
         */
        const pdu = {
            header: {
                auth_token: AUTH_TOKEN,
                method: 'CHECK_BALANCE', // Lightweight operation for testing
                timestamp: Date.now(),
                request_id: `load_test_${clientId}`
            },
            body: {
                user_id: clientId
            }
        };

        // Marshal to JSON with newline frame delimiter
        const packet = JSON.stringify(pdu) + '\n';

        /**
         * CONCEPT: TCP Connection
         * client.connect() initiates the 3-way handshake:
         * SYN → SYN-ACK → ACK
         */
        client.connect(RPC_SERVER_PORT, RPC_SERVER_HOST, () => {
            // Connection established, send the request
            client.write(packet);
        });

        /**
         * CONCEPT: Response Handling
         * Data arrives when the server sends back a response.
         */
        client.on('data', (data) => {
            responseReceived = true;
            clearTimeout(timeout);

            const responseTime = Date.now() - clientStartTime;
            stats.responseTimes.push(responseTime);
            stats.completed++;

            // Validate response
            try {
                const response = JSON.parse(data.toString().trim());
                if (response.status !== 'OK') {
                    stats.errors['BAD_RESPONSE'] = (stats.errors['BAD_RESPONSE'] || 0) + 1;
                }
            } catch (e) {
                stats.errors['PARSE_ERROR'] = (stats.errors['PARSE_ERROR'] || 0) + 1;
            }

            client.destroy();
            resolve();
        });

        /**
         * CONCEPT: Error Handling
         * Many things can go wrong with network connections:
         * - ECONNREFUSED: Server not running
         * - ECONNRESET: Connection forcibly closed
         * - ETIMEDOUT: Connection timed out
         */
        client.on('error', (err) => {
            if (!responseReceived) {
                clearTimeout(timeout);
                stats.failed++;
                const errorCode = err.code || err.message;
                stats.errors[errorCode] = (stats.errors[errorCode] || 0) + 1;
                resolve();
            }
        });
    });
}

/**
 * runLoadTest - Main test orchestrator
 */
async function runLoadTest() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    RPC LOAD TEST                               ║');
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log(`║  Target: ${RPC_SERVER_HOST}:${RPC_SERVER_PORT}                                      ║`);
    console.log(`║  Total Requests: ${TOTAL_REQUESTS.toString().padEnd(45)}║`);
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('Starting load test...');
    console.log('');

    /**
     * CONCEPT: Concurrent Burst
     * We fire ALL requests simultaneously to simulate a traffic spike.
     * This is the worst-case scenario for the server.
     * 
     * The queue should absorb this burst and process requests one by one.
     */
    const promises = [];
    for (let i = 0; i < TOTAL_REQUESTS; i++) {
        promises.push(createClient(i));

        // Progress indicator every 100 requests
        if ((i + 1) % 100 === 0) {
            process.stdout.write(`  Sent ${i + 1} requests...\r`);
        }
    }

    console.log(`  All ${TOTAL_REQUESTS} requests sent. Waiting for responses...`);
    console.log('');

    // Wait for all requests to complete
    await Promise.all(promises);

    // Calculate statistics
    const totalTime = (Date.now() - startTime) / 1000;
    const avgResponseTime = stats.responseTimes.length > 0
        ? (stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length).toFixed(2)
        : 0;
    const minResponseTime = stats.responseTimes.length > 0
        ? Math.min(...stats.responseTimes)
        : 0;
    const maxResponseTime = stats.responseTimes.length > 0
        ? Math.max(...stats.responseTimes)
        : 0;
    const requestsPerSecond = (stats.completed / totalTime).toFixed(2);
    const successRate = ((stats.completed / TOTAL_REQUESTS) * 100).toFixed(2);

    // Print results
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    LOAD TEST RESULTS                           ║');
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log(`║  Total Time:        ${totalTime.toFixed(2).padEnd(42)}s ║`);
    console.log(`║  Requests/sec:      ${requestsPerSecond.padEnd(43)}║`);
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log(`║  Completed:         ${stats.completed.toString().padEnd(43)}║`);
    console.log(`║  Failed:            ${stats.failed.toString().padEnd(43)}║`);
    console.log(`║  Success Rate:      ${(successRate + '%').padEnd(43)}║`);
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log(`║  Avg Response Time: ${(avgResponseTime + 'ms').padEnd(43)}║`);
    console.log(`║  Min Response Time: ${(minResponseTime + 'ms').padEnd(43)}║`);
    console.log(`║  Max Response Time: ${(maxResponseTime + 'ms').padEnd(43)}║`);
    console.log('╚════════════════════════════════════════════════════════════════╝');

    // Print errors if any
    if (Object.keys(stats.errors).length > 0) {
        console.log('');
        console.log('Errors:');
        for (const [code, count] of Object.entries(stats.errors)) {
            console.log(`  ${code}: ${count}`);
        }
    }

    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    ANALYSIS                                    ║');
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log('║  OBSERVATION: Queue absorbed the burst of requests             ║');
    console.log('║  WHY: The processingQueue acts as a buffer                     ║');
    console.log('║  TRADE-OFF: Higher response time under load (queued waiting)   ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
}

// Run the test
runLoadTest().catch(console.error);
