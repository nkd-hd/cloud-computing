/**
 * ============================================================================
 * SERVER.JS - The RPC Server (The "Skeleton")
 * ============================================================================
 * 
 * ARCHITECTURE ROLE: This is the SERVER-SIDE component that:
 * 1. Listens for incoming TCP connections (Socket)
 * 2. Receives requests from clients (Stub)
 * 3. Processes them through a queue (Traffic Shaping)
 * 4. Returns responses (Marshalled data)
 * 
 * CONCEPT: Stub vs Skeleton
 * ┌─────────────┐         ┌─────────────┐
 * │   CLIENT    │         │   SERVER    │
 * │  ┌───────┐  │ Network │  ┌───────┐  │
 * │  │ STUB  │◄─┼────────►┼─►│SKELETON│  │
 * │  └───────┘  │   TCP   │  └───────┘  │
 * │     ▲       │         │      │      │
 * │     │       │         │      ▼      │
 * │  App Code   │         │  Real Logic │
 * └─────────────┘         └─────────────┘
 * 
 * The STUB (client-side) pretends the function is local.
 * The SKELETON (server-side) receives calls and dispatches to real code.
 * 
 * ============================================================================
 */

const net = require('net');
const { parseMessage, createResponse, RPC_METHODS } = require('./protocol');
const { ConvexHttpClient } = require("convex/browser");
require("dotenv").config();

// Initialize Convex Client
// NOTE: We use the local URL for this academic demo. 
// In production, this would be process.env.CONVEX_URL
const CONVEX_URL = "http://127.0.0.1:3210";
const convex = new ConvexHttpClient(CONVEX_URL);

// Server configuration
const PORT = 8080;
const AUTH_TOKEN = 'SECRET_123'; // In production, use proper auth (JWT, OAuth)

/**
 * ============================================================================
 * SECTION 1: THE QUEUE (Non-Persistent, In-Memory)
 * ============================================================================
 * 
 * CONCEPT: Message Queue / Job Queue
 * When many requests arrive at once, we don't process them all simultaneously.
 * Instead, we add them to a QUEUE and process one-by-one (or in batches).
 * 
 * WHY QUEUE?
 * 1. TRAFFIC SHAPING: Prevents server overload during traffic bursts
 * 2. FAIRNESS: First-come-first-served (FIFO)
 * 3. BUFFERING: Absorbs temporary spikes in demand
 * 
 * TRADE-OFF: This queue is NON-PERSISTENT (stored in RAM)
 * - PRO: Very fast access (microseconds)
 * - CON: Lost if server crashes (no durability)
 * 
 * For PERSISTENT queuing, we use Convex (see Phase 4)
 */
const processingQueue = [];
let isProcessing = false;

// Statistics for monitoring
const stats = {
    totalReceived: 0,
    totalProcessed: 0,
    totalErrors: 0,
    startTime: Date.now()
};

/**
 * ============================================================================
 * SECTION 2: THE WORKER (Simulated Thread)
 * ============================================================================
 * 
 * CONCEPT: Worker Threads / Thread Pool
 * In real systems, multiple threads pick jobs off the queue in parallel.
 * Node.js is single-threaded, so we simulate this with async processing.
 * 
 * FLOW:
 * 1. Check if already processing (prevent race conditions)
 * 2. Take first job from queue (FIFO - First In, First Out)
 * 3. Execute the job
 * 4. Send response to client
 * 5. Check for next job
 */
async function processQueue() {
    // Guard: Only one "worker" at a time (in real system, you'd have a pool)
    if (isProcessing || processingQueue.length === 0) {
        return;
    }

    isProcessing = true;

    // FIFO: Take the oldest job first
    const job = processingQueue.shift();
    console.log(`[Worker] Processing job: ${job.method} | Queue remaining: ${processingQueue.length}`);

    try {
        /**
         * CONCEPT: I/O Blocking Simulation
         * Real operations (database, file system) take time.
         * This setTimeout simulates that latency.
         * In production, this would be actual async I/O.
         */
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Execute the RPC method
        const result = await executeMethod(job.method, job.payload);

        // Send response back to the client's socket
        if (job.socket && !job.socket.destroyed) {
            const response = createResponse('OK', result, job.requestId);
            job.socket.write(response);
        }

        stats.totalProcessed++;
        console.log(`[Worker] Completed: ${job.method} | Total processed: ${stats.totalProcessed}`);

    } catch (error) {
        stats.totalErrors++;
        console.error(`[Worker] Error processing ${job.method}:`, error.message);

        if (job.socket && !job.socket.destroyed) {
            const response = createResponse('ERROR', error.message, job.requestId);
            job.socket.write(response);
        }
    }

    // Ready for next job
    isProcessing = false;

    // Recursively check for more jobs (event loop optimization)
    setImmediate(processQueue);
}

/**
 * ============================================================================
 * SECTION 3: METHOD DISPATCHER (Business Logic)
 * ============================================================================
 * 
 * CONCEPT: Method Dispatch / RPC Registry
 * The skeleton must know which function to call for each method name.
 * This is similar to a router in web frameworks.
 */
async function executeMethod(method, payload) {
    console.log(`[Dispatch] Executing method: ${method}`);

    switch (method) {
        case RPC_METHODS.UPLOAD_FILE:
            /**
             * UPLOAD_FILE: Simulates saving a file
             * In production: Save to filesystem or cloud storage (S3, GCS)
             * Here: We just acknowledge receipt (actual storage via Convex)
             */
            /**
             * UPLOAD_FILE: Persist to Convex
             */
            console.log(`[Convex] Logging upload: ${payload.filename}`);
            try {
                await convex.mutation("uploads:logUpload", {
                    filename: payload.filename,
                    fileSize: payload.content ? payload.content.length : 0,
                    contentPreview: payload.content ? payload.content.substring(0, 50) : "",
                    status: "completed"
                });
            } catch (err) {
                console.error("[Convex] Failed to log upload:", err.message);
                // We don't crash, but we log the error (Best Effort)
            }

            return {
                message: 'File uploaded successfully',
                filename: payload.filename,
                size: payload.content ? payload.content.length : 0,
                storedAt: new Date().toISOString()
            };

        case RPC_METHODS.LIST_FILES:
            /**
             * LIST_FILES: Returns all stored files
             * In production: Query from database
             * Here: Return mock data (real data comes from Convex)
             */
            return {
                files: [
                    { name: 'example.txt', size: 1024, modified: Date.now() }
                ],
                message: 'Files retrieved from RPC server'
            };

        case RPC_METHODS.DELETE_FILE:
            /**
             * DELETE_FILE: Removes a file
             */
            return {
                message: 'File deleted successfully',
                filename: payload.filename,
                deletedAt: new Date().toISOString()
            };

        case RPC_METHODS.CHECK_BALANCE:
            /**
             * CHECK_BALANCE: Utility method for load testing
             * Simulates a lightweight operation
             */
            return {
                user_id: payload.user_id,
                balance: Math.floor(Math.random() * 10000),
                currency: 'USD'
            };

        case RPC_METHODS.PING:
            /**
             * PING: Health check
             * Used to verify server is responsive
             */
            return {
                pong: true,
                serverTime: Date.now(),
                uptime: (Date.now() - stats.startTime) / 1000
            };

        default:
            throw new Error(`Unknown method: ${method}`);
    }
}

/**
 * ============================================================================
 * SECTION 4: THE SKELETON (TCP Server / Socket Listener)
 * ============================================================================
 * 
 * CONCEPT: net.createServer() - Raw TCP Socket
 * This creates a SERVER SOCKET that listens for incoming connections.
 * 
 * TCP vs UDP:
 * ┌─────────────────────────────────────────────────────────────┐
 * │                         TCP                                 │
 * │ ✓ Connection-oriented (handshake first)                    │
 * │ ✓ Reliable (lost packets retransmitted)                    │
 * │ ✓ Ordered (messages arrive in sequence)                    │
 * │ ✗ Slower (overhead for reliability)                        │
 * └─────────────────────────────────────────────────────────────┘
 * ┌─────────────────────────────────────────────────────────────┐
 * │                         UDP                                 │
 * │ ✓ Fast (no connection overhead)                            │
 * │ ✗ Unreliable (packets can be lost)                         │
 * │ ✗ Unordered (packets can arrive out of sequence)           │
 * └─────────────────────────────────────────────────────────────┘
 * 
 * We use TCP because file uploads MUST be reliable and ordered.
 */
const server = net.createServer((socket) => {
    /**
     * Each time a client connects, this callback fires.
     * 'socket' represents the connection to THAT specific client.
     * 
     * CONCEPT: Client-Server Connection
     * This is a PERSISTENT CONNECTION - stays open until explicitly closed.
     * We could also implement NON-PERSISTENT (close after each request).
     */

    const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[Server] Client connected: ${clientAddress}`);

    // Buffer for handling fragmented data
    let buffer = '';

    /**
     * CONCEPT: The 'data' Event (Receiving Segments)
     * 
     * TCP breaks data into SEGMENTS. Large messages are split automatically.
     * The 'data' event may fire multiple times for one logical message.
     * We use the newline delimiter to know when a message is complete.
     */
    socket.on('data', (data) => {
        stats.totalReceived++;

        // Accumulate data in buffer (handle fragmentation)
        buffer += data.toString();

        // Check for complete messages (delimited by newline)
        const messages = buffer.split('\n');
        buffer = messages.pop(); // Keep incomplete message in buffer

        for (const rawMessage of messages) {
            if (!rawMessage.trim()) continue;

            try {
                /**
                 * CONCEPT: Unmarshalling (Deserialization)
                 * Convert network bytes back into usable objects.
                 * This is the opposite of marshalling (JSON.stringify).
                 */
                const message = parseMessage(rawMessage);

                console.log(`[Server] Received: ${message.header.method} from ${clientAddress}`);

                /**
                 * CONCEPT: Authentication / Security
                 * Verify the client is authorized BEFORE processing.
                 * 
                 * SECURITY NOTE:
                 * Our token is sent in PLAIN TEXT over TCP.
                 * Anyone sniffing the network can see it!
                 * 
                 * SOLUTION: Use TLS (Transport Layer Security)
                 * Replace: net.createServer()
                 * With:    tls.createServer({ key, cert }, ...)
                 */
                if (message.header.auth_token !== AUTH_TOKEN) {
                    console.log(`[Security] Unauthorized request from ${clientAddress}`);
                    socket.write(createResponse('ERROR', 'Unauthorized', message.header.request_id));
                    socket.end();
                    return;
                }

                /**
                 * CONCEPT: Queueing (Traffic Shaping)
                 * Instead of processing immediately, add to queue.
                 * This prevents overload when many clients connect at once.
                 */
                processingQueue.push({
                    method: message.header.method,
                    payload: message.body,
                    requestId: message.header.request_id,
                    socket: socket,
                    receivedAt: Date.now()
                });

                console.log(`[Queue] Job added. Queue size: ${processingQueue.length}`);

                // Trigger queue processing
                processQueue();

            } catch (error) {
                console.error(`[Server] Error parsing message: ${error.message}`);
                stats.totalErrors++;
                socket.write(createResponse('ERROR', 'Invalid message format'));
            }
        }
    });

    /**
     * Connection lifecycle events
     */
    socket.on('end', () => {
        console.log(`[Server] Client disconnected gracefully: ${clientAddress}`);
    });

    socket.on('error', (error) => {
        console.error(`[Server] Socket error for ${clientAddress}: ${error.message}`);
    });

    socket.on('timeout', () => {
        console.log(`[Server] Client timeout: ${clientAddress}`);
        socket.end();
    });

    // Set socket timeout (30 seconds)
    socket.setTimeout(30000);
});

/**
 * ============================================================================
 * SECTION 5: START THE SERVER
 * ============================================================================
 */
server.listen(PORT, '0.0.0.0', () => {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║           RPC SERVER (The Skeleton) - STARTED                  ║');
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log(`║  Listening on: 0.0.0.0:${PORT} (TCP)                             ║`);
    console.log('║  Protocol: TCP (Connection-oriented, Reliable, Ordered)        ║');
    console.log('║  Auth Token: SECRET_123                                        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('Waiting for client connections...');
    console.log('');
});

/**
 * Graceful shutdown
 */
process.on('SIGINT', () => {
    console.log('\n[Server] Shutting down gracefully...');
    console.log(`[Stats] Total received: ${stats.totalReceived}`);
    console.log(`[Stats] Total processed: ${stats.totalProcessed}`);
    console.log(`[Stats] Total errors: ${stats.totalErrors}`);
    console.log(`[Stats] Queue remaining: ${processingQueue.length}`);

    server.close(() => {
        console.log('[Server] Closed.');
        process.exit(0);
    });
});
