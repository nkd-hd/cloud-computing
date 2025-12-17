# Google Drive Clone - RPC Architecture Demo

A minimalistic Google Drive clone designed to demonstrate core **distributed systems** concepts for academic purposes:

- **RPC (Remote Procedure Calls)**
- **Sockets (TCP)**
- **Queuing (Traffic Shaping)**
- **Persistence (Database)**
- **Security (Authentication)**

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT (Next.js)                             │
│  ┌──────────────────┐                    ┌──────────────────────┐  │
│  │    Frontend UI   │ ──── fetch() ────► │  API Route (STUB)    │  │
│  │    (page.tsx)    │                    │  (route.ts)          │  │
│  └──────────────────┘                    └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                                      │
                                                      │ TCP Socket
                                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      RPC SERVER (Node.js)                           │
│  ┌──────────────────┐        ┌──────────────────────────────────┐  │
│  │    TCP Listener  │ ─────► │  Processing Queue (Non-Persistent)│  │
│  │    (SKELETON)    │        │  ┌───┐ ┌───┐ ┌───┐ ┌───┐        │  │
│  └──────────────────┘        │  │ J │ │ J │ │ J │ │ J │ ...    │  │
│                               │  └───┘ └───┘ └───┘ └───┘        │  │
│                               └──────────────────────────────────┘  │
│                                              │                       │
│                                              ▼                       │
│                               ┌──────────────────────┐              │
│                               │    Worker Thread     │              │
│                               │    (Job Processor)   │              │
│                               └──────────────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
                                              │
                                              │ HTTP API
                                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CONVEX DATABASE (Persistent)                     │
│                      uploadLog | jobLog                             │
└─────────────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
Cloud Computing/
├── drive-clone/                   # Next.js Frontend
│   ├── app/
│   │   ├── api/rpc/route.ts       # The STUB (Client-side proxy)
│   │   ├── page.tsx               # Drive UI
│   │   ├── layout.tsx             # App layout
│   │   └── globals.css            # Styling
│   ├── convex/
│   │   ├── schema.ts               # Database schema
│   │   └── uploads.ts              # Mutations & queries
│   └── package.json
├── rpc-server/
│   ├── server.js                   # The SKELETON (TCP Server)
│   └── protocol.js                 # Shared message format
└── load_test.js                    # 1000-user simulation
```

## 🚀 How to Run

### Terminal 1: Start RPC Server
```bash
cd rpc-server
node server.js
```
You should see: `RPC Server listening on port 8080 (TCP)`

### Terminal 2: Start Next.js Client
```bash
cd drive-clone
npm run dev
```
Open http://localhost:3000

### Terminal 3 (Optional): Run Load Test
```bash
node load_test.js 1000
```

## 📚 Key Concepts Demonstrated

### 1. Stub & Skeleton Pattern
- **Stub** (`route.ts`): Client-side proxy that hides networking complexity
- **Skeleton** (`server.js`): Server-side dispatcher that receives and processes calls

### 2. Location Transparency
The frontend calls `fetch('/api/rpc')` without knowing TCP sockets are involved.

### 3. Marshalling / Unmarshalling
- `JSON.stringify()` = Marshalling (converting to network format)
- `JSON.parse()` = Unmarshalling (converting back to objects)

### 4. PDU (Protocol Data Unit)
```json
{
  "header": {
    "auth_token": "SECRET_123",
    "method": "UPLOAD_FILE",
    "timestamp": 1702598400000
  },
  "body": {
    "filename": "test.txt",
    "content": "Hello World"
  }
}
```

### 5. Framing
We use newline (`\n`) as a delimiter to know where one message ends.

### 6. Queueing (Traffic Shaping)
The `processingQueue[]` absorbs traffic bursts and processes jobs sequentially.

### 7. TCP vs UDP
We use TCP because:
- **Reliable**: Lost packets are retransmitted
- **Ordered**: Messages arrive in sequence
- **Connection-oriented**: Ensures both parties are ready

### 8. Persistent vs Non-Persistent Storage
| Storage | Location | Speed | Durability |
|---------|----------|-------|------------|
| Queue (Array) | RAM | Fast | Lost on crash |
| Convex DB | Disk | Slower | Survives restart |

### 9. Security Concerns
⚠️ Our `auth_token` is sent in plain text over TCP. 

**Fix**: Use `tls.createServer()` instead of `net.createServer()` for encryption.

## 📊 Load Test Results

Running `node load_test.js 1000` demonstrates:
- Queue absorbs 1000 simultaneous requests
- Server doesn't crash
- All requests eventually complete
- Response time increases under load (queued waiting)

## 🔧 Technologies Used

- **Next.js 15**: React framework with App Router
- **Node.js `net` module**: Raw TCP socket programming
- **Convex**: Cloud database for persistence
- **TypeScript**: Type-safe code

## 📝 For Report

1. **Why TCP?** Ordering and reliability are essential for file transfers
2. **Why Queue?** Prevents server overload during traffic spikes
3. **Why Both Storage Types?** Queue for speed, DB for durability
4. **Security Gap**: Plain-text tokens need TLS encryption
5. **Location Transparency**: Frontend doesn't know about sockets
