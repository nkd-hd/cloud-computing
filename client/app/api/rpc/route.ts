/**
 * ============================================================================
 * RPC ROUTE - The "Stub" (Client-Side Proxy)
 * ============================================================================
 * 
 * CONCEPT: Location Transparency
 * The frontend calls fetch('/api/rpc') like any normal API.
 * It doesn't know (or care) that behind the scenes, we're opening
 * a raw TCP socket to a separate server process.
 * 
 * This is the essence of RPC:
 * "Make remote calls look like local function calls"
 * 
 * ARCHITECTURE FLOW:
 * ┌─────────────┐    HTTP     ┌─────────────┐    TCP     ┌─────────────┐
 * │   Browser   │────────────►│  This Stub  │───────────►│ RPC Server  │
 * │  (fetch())  │◄────────────│  (route.ts) │◄───────────│ (server.js) │
 * └─────────────┘   JSON      └─────────────┘   JSON     └─────────────┘
 * 
 * The STUB responsibilities:
 * 1. Accept HTTP request from frontend
 * 2. MARSHAL the data (convert to network format)
 * 3. Open TCP socket to RPC server
 * 4. Send the request
 * 5. Wait for response
 * 6. UNMARSHAL the response
 * 7. Return to frontend
 * 
 * ============================================================================
 */

import { NextResponse } from 'next/server';
import net from 'net';

// Configuration - in production, use environment variables
const RPC_SERVER_HOST = 'localhost';
const RPC_SERVER_PORT = 8080;
const AUTH_TOKEN = 'SECRET_123';
const TIMEOUT_MS = 5000; // 5 second timeout

/**
 * POST Handler - The main stub entry point
 * 
 * CONCEPT: Request/Response Pattern
 * Client sends a request, waits (blocks) until response arrives.
 * This is SYNCHRONOUS from the client's perspective.
 */
export async function POST(req: Request) {
    try {
        // Parse the incoming HTTP request
        const { method, payload } = await req.json();

        console.log(`[Stub] Received request for method: ${method}`);

        /**
         * CONCEPT: Marshalling (Serialization)
         * Convert the request into a format suitable for network transmission.
         * We add our protocol header (auth, timestamp, method) to create the PDU.
         */
        const pdu = {
            header: {
                auth_token: AUTH_TOKEN,
                method: method,
                timestamp: Date.now(),
                request_id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            },
            body: payload
        };

        // Convert to JSON string with newline delimiter (framing)
        const packet = JSON.stringify(pdu) + '\n';

        console.log(`[Stub] Marshalled packet, sending to RPC server...`);

        /**
         * CONCEPT: TCP Socket Communication
         * We're about to open a raw TCP socket to the RPC server.
         * This demonstrates the actual network communication layer.
         */
        const response = await sendToRpcServer(packet);

        console.log(`[Stub] Received response from RPC server`);

        return NextResponse.json(response);

    } catch (error) {
        console.error('[Stub] Error:', error);

        return NextResponse.json(
            {
                status: 'ERROR',
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now()
            },
            { status: 500 }
        );
    }
}

/**
 * sendToRpcServer - Opens TCP socket and communicates with RPC server
 * 
 * CONCEPT: Socket Programming
 * A SOCKET is an endpoint for network communication.
 * It's identified by: IP Address + Port Number + Protocol (TCP/UDP)
 * 
 * TCP Connection Lifecycle:
 * 1. CREATE socket (net.Socket)
 * 2. CONNECT to server (3-way handshake: SYN → SYN-ACK → ACK)
 * 3. SEND data (write to socket)
 * 4. RECEIVE response (data event)
 * 5. CLOSE connection (FIN → ACK)
 */
function sendToRpcServer(packet: string): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
        /**
         * CONCEPT: Client Socket
         * net.Socket() creates a client-side TCP socket.
         * This is the OTHER end of the connection (server uses net.createServer).
         */
        const client = new net.Socket();

        // Buffer for accumulating response data
        let responseBuffer = '';

        /**
         * CONCEPT: Connection Timeout
         * Networks are unreliable. We must handle the case where
         * the server doesn't respond in time.
         */
        const timeout = setTimeout(() => {
            console.log('[Stub] Connection timeout');
            client.destroy();
            reject(new Error('RPC server timeout'));
        }, TIMEOUT_MS);

        /**
         * CONCEPT: Connect Event
         * Fires when TCP 3-way handshake completes successfully.
         * SYN → SYN-ACK → ACK (all handled by OS, transparent to us)
         */
        client.connect(RPC_SERVER_PORT, RPC_SERVER_HOST, () => {
            console.log(`[Stub] Connected to RPC server at ${RPC_SERVER_HOST}:${RPC_SERVER_PORT}`);

            /**
             * CONCEPT: Sending Data (Marshalled Request)
             * socket.write() sends bytes to the server.
             * TCP guarantees delivery and ordering.
             */
            client.write(packet);
        });

        /**
         * CONCEPT: Receiving Data (Segmented Response)
         * The 'data' event fires when data arrives.
         * Large responses may arrive in multiple chunks (segments).
         * We buffer until we get a complete message (newline delimiter).
         */
        client.on('data', (data: Buffer) => {
            responseBuffer += data.toString();

            // Check if we have a complete message (ended with newline)
            if (responseBuffer.includes('\n')) {
                clearTimeout(timeout);

                try {
                    /**
                     * CONCEPT: Unmarshalling (Deserialization)
                     * Convert network bytes back into usable objects.
                     */
                    const response = JSON.parse(responseBuffer.trim());

                    /**
                     * CONCEPT: Non-Persistent Connection
                     * We close the connection after each request/response.
                     * This mimics HTTP/1.0 behavior.
                     * 
                     * Alternative: Persistent connections (keep-alive)
                     * - Reuse socket for multiple requests
                     * - More efficient but more complex
                     */
                    client.destroy();
                    resolve(response);

                } catch {
                    client.destroy();
                    reject(new Error('Failed to parse RPC response'));
                }
            }
        });

        /**
         * Connection error handling
         */
        client.on('error', (error: Error) => {
            clearTimeout(timeout);
            console.error('[Stub] Socket error:', error.message);

            /**
             * CONCEPT: Error Handling in Distributed Systems
             * Many things can go wrong:
             * - Server not running (ECONNREFUSED)
             * - Network unreachable (ENETUNREACH)
             * - Connection reset (ECONNRESET)
             * 
             * Good RPC systems implement:
             * - Retries with exponential backoff
             * - Circuit breakers
             * - Fallback responses
             */
            reject(new Error(`RPC connection failed: ${error.message}`));
        });

        /**
         * Handle unexpected close
         */
        client.on('close', () => {
            clearTimeout(timeout);
            if (responseBuffer && !responseBuffer.includes('\n')) {
                reject(new Error('Connection closed before response received'));
            }
        });
    });
}
