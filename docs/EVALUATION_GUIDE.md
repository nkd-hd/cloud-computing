# RPC Google Drive Clone - Evaluation Guide

This document provides comprehensive explanations, demo scripts, and verification steps for all evaluation criteria.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Client: Stub & RPC](#2-client-stub--rpc)
3. [Server: Skeleton & Multi-Device](#3-server-skeleton--multi-device)
4. [Authentication & Security](#4-authentication--security)
5. [Optimization: Queueing](#5-optimization-queueing)
6. [Sockets & Microservices](#6-sockets--microservices)
7. [Load Testing](#7-load-testing)
8. [TCP vs UDP](#8-tcp-vs-udp)
9. [checkBalance Service Design](#9-checkbalance-service-design)
10. [What We Couldn't Demo (Constraints)](#10-what-we-couldnt-demo-constraints)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CLIENT (Next.js Browser)                         │
│  ┌──────────────────┐                    ┌──────────────────────┐       │
│  │    Frontend UI   │ ─── fetch() ────►  │   API Route (STUB)   │       │
│  │    (page.tsx)    │                    │   (route.ts)         │       │
│  └──────────────────┘                    └──────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────┘
                                                      │
                                                      │ TCP Socket (Port 8080)
                                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      RPC SERVER (Node.js - The Skeleton)                │
│  ┌──────────────────┐        ┌──────────────────────────────────────┐   │
│  │    TCP Listener  │ ─────► │   Processing Queue (In-Memory)       │   │
│  │   (net module)   │        │   ┌───┐ ┌───┐ ┌───┐ ...              │   │
│  └──────────────────┘        │   │Job│ │Job│ │Job│                  │   │
│                               │   └───┘ └───┘ └───┘                  │   │
│                               └──────────────────────────────────────┘   │
│                                              │                           │
│                                              ▼                           │
│                               ┌──────────────────────┐                   │
│                               │    Worker Loop       │                   │
│                               │  (FIFO Processing)   │                   │
│                               └──────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONVEX DATABASE (Persistent Storage)                  │
│                      uploadLog | jobLog tables                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Client: Stub & RPC

### What is a Stub?

The **Stub** is client-side code that makes remote calls look like local function calls. Our stub is in `drive-clone/app/api/rpc/route.ts`.

**Key Point:** The frontend calls `fetch('/api/rpc')` without knowing TCP sockets are involved. This is **Location Transparency**.

### Demonstration

**Front-end code (`page.tsx`):**
```javascript
// The frontend developer thinks this is just a local API call
const result = await fetch('/api/rpc', {
  method: 'POST',
  body: JSON.stringify({ method: "UPLOAD_FILE", payload: { filename: "test.txt" } })
});
```

**What actually happens (in route.ts - the Stub):**
```javascript
// The stub opens a raw TCP socket behind the scenes
const client = new net.Socket();
client.connect(8080, 'localhost', () => {
  client.write(packet); // Send marshalled data
});
```

### Protofile (Protocol Definition)

Our "protofile" is `rpc-server/protocol.js`. It defines:
- **RPC_METHODS**: Available remote procedures (UPLOAD_FILE, DELETE_FILE, CHECK_BALANCE, etc.)
- **PDU Structure**: Header (auth, method, timestamp) + Body (payload)
- **Framing**: Newline delimiter marks message boundaries

```javascript
// Example PDU (Protocol Data Unit)
{
  "header": {
    "auth_token": "SECRET_123",
    "method": "UPLOAD_FILE",
    "timestamp": 1702598400000
  },
  "body": {
    "filename": "document.txt",
    "content": "Hello World"
  }
}
```

---

## 3. Server: Skeleton & Multi-Device

### What is a Skeleton?

The **Skeleton** is server-side code that receives RPC requests and dispatches them to the actual implementation. Our skeleton is `rpc-server/server.js`.

### Demonstration Script: Multi-Device Execution

To prove the server can be accessed from multiple devices on the same network:

**Step 1: Find your local IP**
```bash
# On Mac
ipconfig getifaddr en0
# Example output: 192.168.1.100
```

**Step 2: Start the server (already listening on 0.0.0.0)**
```bash
cd rpc-server && node server.js
# Server listens on 0.0.0.0:8080 (all interfaces)
```

**Step 3: From another device on the same network, run:**
```bash
# Create test_remote.js on Device 2
echo 'const net = require("net");
const client = new net.Socket();
client.connect(8080, "192.168.1.100", () => {  // Use Device 1 IP
  const data = JSON.stringify({
    header: { auth_token: "SECRET_123", method: "PING" },
    body: {}
  }) + "\\n";
  client.write(data);
});
client.on("data", (d) => { console.log(d.toString()); client.destroy(); });' > test_remote.js

node test_remote.js
```

**Expected Output:**
```json
{"status":"OK","result":{"pong":true,"serverTime":...},"timestamp":...}
```

---

## 4. Authentication & Security

### Current Implementation (Insecure for Demo Purposes)

```javascript
// In server.js
if (message.header.auth_token !== AUTH_TOKEN) {
  socket.write(createResponse('ERROR', 'Unauthorized'));
  socket.end();
  return;
}
```

### The Problem: Plain-Text Token

**Why is RPC data not safe?**

Our token `SECRET_123` is sent in **plain text** over TCP. Anyone on the network can:
1. Use a packet sniffer (Wireshark)
2. Capture the TCP stream
3. Read the token directly

**Demonstration:**
```bash
# On the server machine, capture packets:
sudo tcpdump -i any port 8080 -A
# Then trigger an upload - you'll see the token in clear text!
```

### The Solution: TLS (Transport Layer Security)

**How to secure it (code change):**
```javascript
// BEFORE (insecure):
const net = require('net');
const server = net.createServer((socket) => { ... });

// AFTER (secured with TLS):
const tls = require('tls');
const fs = require('fs');

const options = {
  key: fs.readFileSync('server-key.pem'),
  cert: fs.readFileSync('server-cert.pem')
};

const server = tls.createServer(options, (socket) => { ... });
```

**We didn't implement TLS because:**
- Generating certificates adds complexity for a demo
- Focus is on RPC concepts, not production security
- TLS would just encrypt the same TCP stream

---

## 5. Optimization: Queueing

### How the Queue Works

```javascript
// In server.js
const processingQueue = []; // In-memory FIFO queue

// When request arrives:
processingQueue.push({ method, payload, socket });

// Worker picks jobs:
const job = processingQueue.shift(); // FIFO
await executeMethod(job.method, job.payload);
```

### Why Queue?

1. **Traffic Shaping**: Absorbs bursts without crashing
2. **Fairness**: First-come-first-served
3. **Resource Protection**: Limits concurrent processing

### Demonstration: Queue in Action

```bash
# Run load test with 100 requests
cd /path/to/project
node load_test.js 100
```

**Observe in server terminal:**
```
[Queue] Job added. Queue size: 47
[Worker] Processing job: CHECK_BALANCE | Queue remaining: 46
...
```

The queue size increases during burst, then drains as worker processes jobs.

### Client-Side Queueing (Conceptual)

The client (browser) also queues internally via the `fetch()` API Promise queue. Multiple uploads are handled asynchronously.

---

## 6. Sockets & Microservices

### Socket Usage

| Concept | Implementation |
|---------|---------------|
| **Server Socket** | `net.createServer()` - listens for connections |
| **Client Socket** | `new net.Socket()` - initiates connection |
| **Connection** | TCP 3-way handshake (SYN → SYN-ACK → ACK) |
| **Data Transfer** | `socket.write()` and `socket.on('data')` |
| **Close** | `socket.destroy()` or `socket.end()` |

### Microservices Architecture

Our system is already microservices-style:

| Service | Port | Responsibility |
|---------|------|---------------|
| Next.js Frontend | 3000 | UI + Stub |
| RPC Server | 8080 | Business logic + Skeleton |
| Convex Database | 3210 | Persistence |

Each can be deployed independently and scaled separately.

---

## 7. Load Testing

### Running the Load Test

```bash
# 1000 simultaneous connections
node load_test.js 1000
```

### Sample Output
```
╔════════════════════════════════════════════════════════════════╗
║                    LOAD TEST RESULTS                           ║
╠════════════════════════════════════════════════════════════════╣
║  Total Time:        52.34s                                     ║
║  Requests/sec:      19.11                                      ║
╠════════════════════════════════════════════════════════════════╣
║  Completed:         1000                                       ║
║  Failed:            0                                          ║
║  Success Rate:      100.00%                                    ║
╠════════════════════════════════════════════════════════════════╣
║  Avg Response Time: 25421ms                                    ║
║  Min Response Time: 52ms                                       ║
║  Max Response Time: 51982ms                                    ║
╚════════════════════════════════════════════════════════════════╝
```

### Analysis

- **Why doesn't the server crash?** The queue absorbs the burst
- **Why is avg response time high?** Jobs wait in queue (FIFO)
- **Trade-off**: Stability vs latency under load

### Multi-Device Testing

Run `load_test.js` from multiple machines pointing to the server IP:
```javascript
// Edit load_test.js on each machine:
const RPC_SERVER_HOST = '192.168.1.100'; // Server's IP
```

---

## 8. TCP vs UDP

### Why We Chose TCP (Stream Sockets)

| Feature | TCP | UDP |
|---------|-----|-----|
| **PDU Name** | Segment | Datagram |
| **Connection** | Required (3-way handshake) | None |
| **Reliability** | Guaranteed delivery | Best effort |
| **Ordering** | Guaranteed | Not guaranteed |
| **Use Case** | File transfers, RPC | Video streaming, DNS |

### Our Implementation

```javascript
// We use TCP (net module)
const net = require('net');
const server = net.createServer((socket) => { ... });

// For UDP, we would use:
// const dgram = require('dgram');
// const server = dgram.createSocket('udp4');
```

### Sequence Numbers

TCP automatically handles sequence numbers to ensure:
- **Ordering**: Packets reassembled in correct order
- **Reliability**: Missing packets detected and retransmitted

We don't manually handle sequence numbers because TCP does it for us.

### Message Ordering Guarantee

If client sends: `"Hello"` then `"World"`  
Server receives: `"Hello"` then `"World"` (guaranteed with TCP)

With UDP, server might receive: `"World"` then `"Hello"` (no guarantee)

---

## 9. checkBalance Service Design

### Protocol Definition (Protofile)
```javascript
// In protocol.js
const RPC_METHODS = {
  CHECK_BALANCE: 'CHECK_BALANCE'
};
```

### Client Pseudocode (The Stub)
```
FUNCTION checkBalance(userId):
    // 1. Create PDU
    message = {
        header: { method: "CHECK_BALANCE", auth_token: TOKEN },
        body: { user_id: userId }
    }
    
    // 2. Marshal (serialize)
    packet = JSON.stringify(message) + "\n"
    
    // 3. Open socket with timeout
    socket = createSocket()
    socket.setTimeout(5000)  // 5 second timeout
    
    TRY:
        socket.connect(SERVER_HOST, SERVER_PORT)
        socket.write(packet)
        
        // 4. Wait for response
        response = socket.read()
        
        // 5. Unmarshal
        result = JSON.parse(response)
        RETURN result.balance
        
    CATCH TimeoutError:
        LOG("RPC Timeout - server not responding")
        RETURN ERROR("Service unavailable")
        
    CATCH ConnectionError:
        LOG("Connection failed")
        RETURN ERROR("Cannot reach server")
        
    FINALLY:
        socket.close()
```

### Server Pseudocode (The Skeleton)
```
FUNCTION handleConnection(socket):
    buffer = ""
    
    ON socket.data(chunk):
        buffer += chunk
        
        IF buffer.contains("\n"):
            message = JSON.parse(buffer)
            buffer = ""
            
            // Authenticate
            IF message.auth_token != VALID_TOKEN:
                socket.write(ERROR("Unauthorized"))
                socket.close()
                RETURN
            
            // Dispatch to handler
            SWITCH message.method:
                CASE "CHECK_BALANCE":
                    result = getBalance(message.body.user_id)
                    socket.write(JSON.stringify({ status: "OK", balance: result }))
                    
                DEFAULT:
                    socket.write(ERROR("Unknown method"))
    
    ON socket.timeout:
        LOG("Client timeout")
        socket.close()

FUNCTION getBalance(userId):
    // Actual business logic
    balance = database.query("SELECT balance FROM accounts WHERE id = ?", userId)
    RETURN balance
```

### Actual Implementation

See `rpc-server/server.js` lines 182-191:
```javascript
case RPC_METHODS.CHECK_BALANCE:
    return {
        user_id: payload.user_id,
        balance: Math.floor(Math.random() * 10000), // Simulated
        currency: 'USD'
    };
```

---

## 10. What We Couldn't Demo (Constraints)

### 1. True Multi-Device Testing

**Constraint**: Running locally on one machine.

**What we did**: Server listens on `0.0.0.0:8080`, accessible from LAN.

**If no constraint**: Deploy server to cloud (AWS/GCP), run clients from different physical locations worldwide. Measure latency differences.

---

### 2. TLS Encryption

**Constraint**: Certificate generation and management adds complexity.

**What we did**: Plain TCP with token auth (documented the risk).

**If no constraint**: 
- Generate CA-signed certificates
- Use `tls.createServer()`
- All traffic encrypted end-to-end
- Tokens unreadable even if sniffed

---

### 3. Real Thread Pool

**Constraint**: Node.js is single-threaded.

**What we did**: Simulate concurrency with async `setImmediate()`.

**If no constraint**:
- Use Worker Threads (`worker_threads` module)
- Or deploy multiple server instances behind load balancer
- Each worker truly processes in parallel

---

### 4. UDP Comparison Demo

**Constraint**: Our use case (file upload) requires reliability.

**What we did**: TCP only, explained UDP theoretically.

**If no constraint**: Build parallel UDP version:
```javascript
const dgram = require('dgram');
const server = dgram.createSocket('udp4');
server.on('message', (msg, rinfo) => {
  // No connection, just receive datagrams
});
```
Would demonstrate packet loss under load.

---

### 5. Distributed Database

**Constraint**: Convex runs locally for dev.

**What we did**: Local Convex instance at `localhost:3210`.

**If no constraint**: 
- Deploy Convex to production
- Data replicated across regions
- Survives server failures

---

## Quick Demo Commands

```bash
# Terminal 1: Start RPC Server
cd rpc-server && node server.js

# Terminal 2: Start Next.js
cd drive-clone && npm run dev

# Terminal 3: Start Convex
cd drive-clone && npx convex dev

# Terminal 4: Run load test
node load_test.js 100

# Terminal 5: Test single upload
node rpc-server/test_persistence.js

# Verify in Convex:
cd drive-clone && npx convex run convex/uploads:listUploads
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `rpc-server/protocol.js` | Protofile - PDU structure |
| `rpc-server/server.js` | Skeleton - TCP server with queue |
| `drive-clone/app/api/rpc/route.ts` | Stub - HTTP-to-TCP bridge |
| `drive-clone/app/page.tsx` | Frontend UI |
| `drive-clone/convex/schema.ts` | Database schema |
| `load_test.js` | Concurrent load testing |
