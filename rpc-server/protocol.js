/**
 * ============================================================================
 * PROTOCOL.JS - The "Protofile" (Message Structure Definition)
 * ============================================================================
 * 
 * CONCEPT: Protocol Buffers / Interface Definition
 * In distributed systems, both client and server must agree on message format.
 * Google uses .proto files (Protocol Buffers) for this. We simulate it with JS.
 * 
 * WHY THIS MATTERS:
 * - Ensures both sides "speak the same language"
 * - Defines the PDU (Protocol Data Unit) structure
 * - Acts as a contract between client and server
 * 
 * ============================================================================
 */

/**
 * RPC_METHODS - The available remote procedures
 * 
 * CONCEPT: Remote Procedure Call (RPC)
 * These are functions that exist on the SERVER but can be "called" from CLIENT.
 * The client doesn't know (or care) that these run on a different machine.
 * This is called "Location Transparency".
 */
const RPC_METHODS = {
  // File Operations
  UPLOAD_FILE: 'UPLOAD_FILE',     // Upload a file to the drive
  LIST_FILES: 'LIST_FILES',       // Get all files in the drive
  DELETE_FILE: 'DELETE_FILE',     // Remove a file from the drive
  
  // Utility (for your lecturer's load testing requirement)
  CHECK_BALANCE: 'CHECK_BALANCE', // Example method to demonstrate queueing
  PING: 'PING'                    // Health check
};

/**
 * createMessage - PDU Factory Function (Marshalling)
 * 
 * CONCEPT: Marshalling / Serialization
 * Before sending data over the network, we must convert it to bytes.
 * JSON.stringify() is our marshalling function.
 * The receiver will use JSON.parse() to unmarshal.
 * 
 * CONCEPT: PDU (Protocol Data Unit) Structure
 * ┌─────────────────────────────────────────┐
 * │  HEADER (Metadata)                      │
 * │  - auth_token: Security credential      │
 * │  - timestamp: When request was made     │
 * │  - method: Which RPC to call            │
 * │  - request_id: Unique request tracker   │
 * ├─────────────────────────────────────────┤
 * │  BODY (Payload)                         │
 * │  - Method-specific data                 │
 * │  - e.g., filename, content, user_id     │
 * └─────────────────────────────────────────┘
 * 
 * @param {string} method - The RPC method to call (from RPC_METHODS)
 * @param {object} payload - The data to send with the request
 * @param {string} authToken - Security token for authentication
 * @returns {string} - JSON string with newline delimiter (framed message)
 */
const createMessage = (method, payload, authToken) => {
  const message = {
    header: {
      auth_token: authToken,
      timestamp: Date.now(),
      method: method,
      request_id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    },
    body: payload
  };
  
  /**
   * CONCEPT: Framing
   * Networks send continuous streams of bytes. How do we know where one
   * message ends and another begins? We use DELIMITERS.
   * 
   * Common framing strategies:
   * 1. Length-prefix: First 4 bytes = message length (HTTP/2 uses this)
   * 2. Delimiter: Special character marks end (we use newline "\n")
   * 3. Fixed-size: All messages same size (wasteful)
   * 
   * We add "\n" so the receiver knows: "Got newline? Message complete!"
   */
  return JSON.stringify(message) + "\n";
};

/**
 * parseMessage - PDU Parser Function (Unmarshalling)
 * 
 * @param {string} rawData - Raw string from network
 * @returns {object} - Parsed message object
 */
const parseMessage = (rawData) => {
  try {
    return JSON.parse(rawData.toString().trim());
  } catch (e) {
    throw new Error('Failed to unmarshal message: Invalid JSON');
  }
};

/**
 * createResponse - Server Response Factory
 * 
 * @param {string} status - "OK" or "ERROR"
 * @param {any} result - The response data
 * @param {string} requestId - Echo back the request ID for correlation
 * @returns {string} - JSON response string
 */
const createResponse = (status, result, requestId = null) => {
  return JSON.stringify({
    status: status,
    result: result,
    request_id: requestId,
    timestamp: Date.now()
  }) + "\n";
};

// Export for CommonJS (Node.js server) and ES Modules (Next.js client)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RPC_METHODS, createMessage, parseMessage, createResponse };
}

// ES Module export (for Next.js)
// export { RPC_METHODS, createMessage, parseMessage, createResponse };
