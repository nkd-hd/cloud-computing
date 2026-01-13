# Distributed Systems & Cloud Computing - Conceptual Mastery Guide

A comprehensive study guide covering the core concepts demonstrated in the IS-BST Cloud Storage project.

---

## Table of Contents

1. [Distributed Systems Overview](#1-distributed-systems-overview)
2. [Client-Server Architecture](#2-client-server-architecture)
3. [Remote Procedure Calls (RPC)](#3-remote-procedure-calls-rpc)
4. [TCP Sockets](#4-tcp-sockets)
5. [Stub and Skeleton Pattern](#5-stub-and-skeleton-pattern)
6. [Marshalling and Unmarshalling](#6-marshalling-and-unmarshalling)
7. [Message Queuing](#7-message-queuing)
8. [Microservices Architecture](#8-microservices-architecture)
9. [File Chunking and Distribution](#9-file-chunking-and-distribution)
10. [Persistence vs In-Memory Storage](#10-persistence-vs-in-memory-storage)
11. [Security in Distributed Systems](#11-security-in-distributed-systems)
12. [Location Transparency](#12-location-transparency)
13. [Exam Practice Questions](#13-exam-practice-questions)

---

## 1. Distributed Systems Overview

### Definition
A **distributed system** is a collection of independent computers that appear to users as a single coherent system. The computers communicate and coordinate their actions by passing messages over a network.

### Key Characteristics
- **Concurrency**: Multiple components operate simultaneously
- **No global clock**: Components must synchronize without a shared time reference
- **Independent failures**: One component can fail without affecting others

### Why Distribute?
| Benefit | Explanation |
|---------|-------------|
| **Scalability** | Add more machines to handle more users |
| **Reliability** | If one server fails, others continue working |
| **Performance** | Parallel processing reduces response time |
| **Geographic distribution** | Serve users from nearby locations |

### Code Reference
```
┌─────────────────┐      Network       ┌─────────────────┐
│  Client (Next.js)│ ◄───────────────► │  Server (Node.js)│
│  localhost:3000  │                   │  localhost:8080  │
└─────────────────┘                    └─────────────────┘
```

---

## 2. Client-Server Architecture

### Definition
A model where **clients** request services and **servers** provide them. The server waits for requests, processes them, and returns responses.

### In Our Project
- **Client**: Next.js frontend (browser) - requests file operations
- **Server**: Node.js RPC server - processes requests, manages files

### Request-Response Cycle
1. User clicks "Upload File" in browser
2. Client sends HTTP request to `/api/rpc`
3. API route opens TCP connection to server
4. Server processes request, returns response
5. Client displays result

### Code Location
- Client: `client/app/page.tsx`
- Server: `server/src/server.js`

---

## 3. Remote Procedure Calls (RPC)

### Definition
**RPC** allows a program to call a procedure (function) on a remote server as if it were local. The complexity of network communication is hidden from the programmer.

### How RPC Works
```
Client                              Server
  │                                   │
  │  callRpc('UPLOAD_FILE', data)     │
  ├──────────────────────────────────►│
  │                                   │ executeMethod('UPLOAD_FILE')
  │        { status: 'OK' }           │
  │◄──────────────────────────────────│
  │                                   │
```

### RPC Methods in Our Project
| Method | Service | Description |
|--------|---------|-------------|
| `UPLOAD_FILE` | Files | Store a new file |
| `LIST_FILES` | Files | Get all files |
| `DELETE_FILE` | Files | Remove a file |
| `CHECK_BALANCE` | Finance | Get student balance |
| `MAKE_PAYMENT` | Finance | Process payment |
| `GET_GRADES` | Academics | Retrieve grades |
| `PING` | System | Test connection |

### Code Location
- Method definitions: `server/src/protocol.js`
- Method handlers: `server/src/server.js` (executeMethod function)

---

## 4. TCP Sockets

### Definition
A **socket** is an endpoint for communication between two machines. **TCP (Transmission Control Protocol)** provides reliable, ordered, and error-checked delivery of data.

### TCP vs UDP
| Feature | TCP | UDP |
|---------|-----|-----|
| **Reliability** | Guaranteed delivery | Best-effort |
| **Ordering** | Packets arrive in order | No ordering |
| **Connection** | Connection-oriented | Connectionless |
| **Speed** | Slower (overhead) | Faster |
| **Use case** | File transfer, RPC | Streaming, gaming |

### Why TCP for Our Project?
- File uploads must be complete and correct
- Order matters (can't reassemble chunks randomly)
- Reliability is more important than speed

### Code Example
```javascript
// server/src/server.js
const net = require('net');

const server = net.createServer((socket) => {
  console.log('Client connected');
  
  socket.on('data', (data) => {
    // Process incoming request
    const message = JSON.parse(data.toString());
    // ... handle request
  });
});

server.listen(8080); // Listen on port 8080
```

---

## 5. Stub and Skeleton Pattern

### Definition
- **Stub**: Client-side proxy that makes remote calls look local
- **Skeleton**: Server-side component that receives and dispatches calls

### The Pattern Visualized
```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT                              │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │  Application │ ───► │    STUB      │ (Looks like local) │
│  │  (page.tsx)  │      │ (route.ts)   │                    │
│  └──────────────┘      └──────┬───────┘                    │
└──────────────────────────────┼──────────────────────────────┘
                               │ TCP/IP Network
┌──────────────────────────────┼──────────────────────────────┐
│                         SERVER                              │
│                       ┌──────▼───────┐                      │
│                       │   SKELETON   │ (Dispatches calls)   │
│                       │  (server.js) │                      │
│                       └──────┬───────┘                      │
│  ┌──────────────┐  ┌─────────▼─────────┐  ┌──────────────┐ │
│  │ FileHandler  │  │  FinanceHandler   │  │AcademicHandler│ │
│  └──────────────┘  └───────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Code Locations
- **Stub**: `client/app/api/rpc/route.ts` - HTTP to TCP bridge
- **Skeleton**: `server/src/server.js` - Receives and dispatches

### Why This Pattern?
- **Abstraction**: Application code doesn't handle networking
- **Modularity**: Easy to change transport layer
- **Clarity**: Separation of concerns

---

## 6. Marshalling and Unmarshalling

### Definition
- **Marshalling**: Converting data structures into a format for transmission (serialization)
- **Unmarshalling**: Converting received data back into data structures (deserialization)

### In Our Project
We use **JSON** for marshalling:

```javascript
// Marshalling (client → server)
const message = {
  header: {
    auth_token: "SECRET_123",
    method: "UPLOAD_FILE",
    timestamp: Date.now()
  },
  body: {
    filename: "report.pdf",
    content: "..."
  }
};
const serialized = JSON.stringify(message) + "\n";

// Unmarshalling (server receives)
const parsed = JSON.parse(serialized);
const method = parsed.header.method; // "UPLOAD_FILE"
```

### Protocol Data Unit (PDU)
Our message structure:
```
{
  "header": {
    "auth_token": string,    // Authentication
    "method": string,        // RPC method name
    "timestamp": number,     // When sent
    "request_id": string     // Unique ID
  },
  "body": {
    // Method-specific payload
  }
}
```

### Code Location
- PDU structure: `server/src/protocol.js`

---

## 7. Message Queuing

### Definition
A **message queue** is a buffer that stores messages until they can be processed. It decouples the sender from the receiver, allowing them to operate at different speeds.

### Why Queuing?
Without a queue, if 1000 requests arrive simultaneously:
- Server might crash or reject requests
- Users experience timeouts

With a queue:
- Requests are buffered
- Server processes one at a time
- All requests eventually complete

### Implementation
```javascript
// server/src/server.js
const processingQueue = [];
let isProcessing = false;

function addToQueue(job) {
  processingQueue.push(job);
  console.log(`Queue size: ${processingQueue.length}`);
  processNext();
}

async function processNext() {
  if (isProcessing || processingQueue.length === 0) return;
  
  isProcessing = true;
  const job = processingQueue.shift();
  await executeMethod(job.method, job.payload);
  isProcessing = false;
  processNext(); // Process next in queue
}
```

### Queue Behavior Under Load
```
Time 0ms:   100 requests arrive → Queue: 100
Time 50ms:  Processing job 1   → Queue: 99
Time 100ms: Processing job 2   → Queue: 98
...
Time 5000ms: All complete      → Queue: 0
```

---

## 8. Microservices Architecture

### Definition
An architectural style where an application is built as a collection of **small, independent services** that communicate over a network.

### Monolith vs Microservices
| Aspect | Monolith | Microservices |
|--------|----------|---------------|
| Deployment | All-or-nothing | Independent |
| Scaling | Scale everything | Scale what you need |
| Failure | One bug can crash all | Isolated failures |
| Technology | Single stack | Mix technologies |

### Our Microservices
```
┌──────────────────────────────────────────────────┐
│                  RPC Server                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  │
│  │   Files    │  │  Finance   │  │ Academics  │  │
│  │  Service   │  │  Service   │  │  Service   │  │
│  └────────────┘  └────────────┘  └────────────┘  │
└──────────────────────────────────────────────────┘
```

Each service handles:
- **Files**: UPLOAD, LIST, DELETE
- **Finance**: CHECK_BALANCE, MAKE_PAYMENT
- **Academics**: GET_GRADES, GET_TIMETABLE

---

## 9. File Chunking and Distribution

### Definition
**Chunking** splits large files into smaller pieces for efficient transfer and storage. **Distribution** spreads chunks across multiple storage nodes.

### Why Chunk Files?
| Reason | Benefit |
|--------|---------|
| Parallel transfer | Upload/download faster |
| Fault tolerance | One chunk lost ≠ whole file lost |
| Storage efficiency | Balance load across nodes |
| Resume capability | Continue from last chunk |

### Our Implementation
```javascript
const CHUNK_SIZE = 1024 * 1024; // 1MB per chunk

// A 90MB file becomes:
// - Chunk 0: bytes 0 - 1,048,575
// - Chunk 1: bytes 1,048,576 - 2,097,151
// - ... (90 chunks total)
// - Chunk 89: bytes 93,323,264 - end
```

### Distribution Strategy (Round-Robin)
```
Chunk 1 → Node 1
Chunk 2 → Node 2
Chunk 3 → Node 3
Chunk 4 → Node 1 (wrap around)
...
```

This ensures balanced load across storage nodes.

---

## 10. Persistence vs In-Memory Storage

### Definition
- **In-Memory**: Data stored in RAM, lost on restart
- **Persistent**: Data stored on disk/database, survives restarts

### Comparison
| Aspect | In-Memory | Persistent |
|--------|-----------|------------|
| Speed | Very fast | Slower |
| Durability | Lost on crash | Survives |
| Cost | Expensive (RAM) | Cheaper (disk) |
| Use case | Caches, queues | Permanent data |

### In Our Project
| Component | Storage Type | Why |
|-----------|--------------|-----|
| Processing Queue | In-Memory | Speed; temporary |
| File Metadata | Persistent (Convex) | Must survive restarts |
| Upload Logs | Persistent (Convex) | Audit trail |

### Code Locations
- Queue: `server/src/server.js` (processingQueue array)
- Persistence: `client/convex/uploads.ts`

---

## 11. Security in Distributed Systems

### Authentication Methods
| Method | Description | Our Implementation |
|--------|-------------|-------------------|
| Password | User provides secret | ❌ Not used |
| Token | Server issues access token | ✅ AUTH_TOKEN header |
| OTP | One-time password | ✅ Simulated |
| TLS | Encrypted connection | ⚠️ Not implemented |

### Security Measures in Our Project

**1. Token Authentication**
```javascript
// Every request includes:
header: {
  auth_token: "SECRET_123"  // Server validates this
}
```

**2. OTP Login** (simulated)
- User enters email
- System generates 6-digit code
- User must enter correct code

**3. File Encryption** (simulated)
- Each chunk encrypted with AES-256 (demo)
- Encryption happens before storage

### Security Gaps (Future Work)
- TLS for encrypted transport
- Proper JWT tokens instead of static token
- Password hashing

---

## 12. Location Transparency

### Definition
**Location transparency** means the user doesn't need to know where data or services are physically located. They interact with a simple interface; the system handles routing.

### Example in Our Project
```javascript
// Client code - no network details!
const result = await callRpc('UPLOAD_FILE', { filename: 'test.txt' });

// The client doesn't know:
// - Which server handles this
// - What port the server uses
// - Whether it's local or remote
```

The **Stub** (`/api/rpc`) handles all the complexity:
- Opening TCP connection
- Marshalling data
- Handling timeouts
- Parsing responses

---

## 13. Exam Practice Questions

### Conceptual Questions

1. **What is the difference between TCP and UDP? When would you use each?**

2. **Explain the Stub-Skeleton pattern. What are the responsibilities of each?**

3. **Why do distributed file systems use chunking? Name three benefits.**

4. **What is marshalling? Give an example using JSON.**

5. **Explain the difference between in-memory and persistent storage. When would you use each?**

6. **What is location transparency? How does it benefit developers?**

### Application Questions

7. **Design a message queue for handling 1000 concurrent requests. What data structure would you use?**

8. **A file is 50MB and chunks are 1MB each. How many chunks? If Node 2 fails, which chunks are lost in round-robin distribution?**

9. **Draw the flow of an RPC call from client click to server response.**

10. **Compare monolithic vs microservices architecture. Give 2 advantages of each.**

### Code Analysis

11. **What does this code do?**
```javascript
const server = net.createServer((socket) => {
  socket.on('data', (data) => {
    const msg = JSON.parse(data);
    // ...
  });
});
server.listen(8080);
```

12. **Identify the marshalling and unmarshalling in this flow:**
```javascript
// Client
fetch('/api/rpc', { body: JSON.stringify(request) })
// Server
const parsed = JSON.parse(incoming);
```

---

## Quick Reference Card

| Concept | One-Liner |
|---------|-----------|
| **Distributed System** | Multiple computers working as one |
| **RPC** | Call remote functions like local ones |
| **TCP** | Reliable, ordered data delivery |
| **Stub** | Client-side proxy hiding network |
| **Skeleton** | Server-side dispatcher |
| **Marshalling** | Object → bytes (serialize) |
| **Unmarshalling** | Bytes → object (deserialize) |
| **Queue** | Buffer for handling load spikes |
| **Microservices** | Independent, focused services |
| **Chunking** | Splitting files for distribution |
| **Persistence** | Data survives restarts |
| **Location Transparency** | Hide where things are |
