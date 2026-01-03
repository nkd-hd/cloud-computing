# IS-BST University Portal

A **distributed school portal system** demonstrating core cloud computing concepts:

- **RPC (Remote Procedure Calls)** with Stub/Skeleton pattern
- **TCP Sockets** for reliable network communication  
- **Message Queuing** for traffic shaping
- **Microservices Architecture** (Finance, Academics, Files)
- **Persistent Storage** (Convex) vs In-Memory Queue

---

## 🏗️ Architecture

The portal uses a **Drive-style interface** as the **service orchestrator**. Each "folder" represents a distributed microservice:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    IS-BST UNIVERSITY PORTAL (Client)                    │
│                                                                         │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────┐ │
│  │ 💰 Finance     │  │ 📚 Academics   │  │ 📁 My Files               │ │
│  │    Service     │  │    Service     │  │    Service                │ │
│  │ ─────────────  │  │ ─────────────  │  │ ────────────────────────  │ │
│  │ • Check Balance│  │ • View Grades  │  │ • Upload Files            │ │
│  │ • Make Payment │  │ • Get Timetable│  │ • Download Files          │ │
│  │ • Fees Statement│ │ • Submit Work  │  │ • Delete Files            │ │
│  └───────┬────────┘  └───────┬────────┘  └─────────────┬──────────────┘ │
│          │                   │                         │                │
│          └───────────────────┼─────────────────────────┘                │
│                              │                                          │
│                    ┌─────────▼─────────┐                                │
│                    │   API Route       │ ← The "STUB"                   │
│                    │   (HTTP → TCP)    │                                │
│                    └─────────┬─────────┘                                │
└──────────────────────────────┼──────────────────────────────────────────┘
                               │ TCP Socket (Port 8080)
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         RPC SERVER (The "SKELETON")                     │
│  ┌──────────────────┐        ┌──────────────────────────────────────┐   │
│  │    TCP Listener  │ ─────► │   Processing Queue (Non-Persistent)  │   │
│  │   (net module)   │        │   ┌───┐ ┌───┐ ┌───┐ ...              │   │
│  └──────────────────┘        │   │Job│ │Job│ │Job│                  │   │
│                               │   └───┘ └───┘ └───┘                  │   │
│                               └──────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                        SERVICE HANDLERS                            │ │
│  │  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │ │
│  │  │FileHandler  │  │FinanceHandler   │  │AcademicsHandler         │ │ │
│  │  │• UPLOAD_FILE│  │• CHECK_BALANCE  │  │• GET_GRADES             │ │ │
│  │  │• LIST_FILES │  │• MAKE_PAYMENT   │  │• UPLOAD_ASSIGNMENT      │ │ │
│  │  │• DELETE_FILE│  │• GET_FEES       │  │• GET_TIMETABLE          │ │ │
│  │  └─────────────┘  └─────────────────┘  └─────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONVEX DATABASE (Persistent Storage)                  │
│                      uploadLog | jobLog | payments                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
is-bst-university-portal/
│
├── server/                        # RPC Server (The Skeleton)
│   ├── src/
│   │   ├── server.js              # TCP server with queuing
│   │   └── protocol.js            # PDU structure & RPC methods
│   └── package.json
│
├── client/                        # Next.js Frontend (The Stub)
│   ├── app/
│   │   ├── api/rpc/route.ts       # HTTP-to-TCP bridge
│   │   ├── page.tsx               # Portal UI with service folders
│   │   ├── globals.css            # Styling
│   │   └── layout.tsx             # App layout
│   ├── convex/
│   │   ├── schema.ts              # Database schema
│   │   └── uploads.ts             # Mutations & queries
│   └── package.json
│
├── tests/                         # Testing scripts
│   ├── load_test.js               # 1000+ concurrent requests
│   └── test_persistence.js        # Single request test
│
├── docs/                          # Documentation
│   ├── EVALUATION_GUIDE.md        # Detailed evaluation criteria
│   ├── TESTING_GUIDE.md           # Testing instructions
│   └── school_system_plan.pdf     # Original requirements
│
└── README.md                      # This file
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** - [Download](https://nodejs.org/)

### 1. Clone & Install

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/is-bst-university-portal.git
cd is-bst-university-portal

# Install server dependencies
cd server && npm install && cd ..

# Install client dependencies
cd client && npm install && cd ..
```

### 2. Start the System (3 Terminals)

**Terminal 1 - RPC Server:**
```bash
cd server/src
node server.js
```

**Terminal 2 - Convex Database:**
```bash
cd client
npx convex dev
```

**Terminal 3 - Next.js Client:**
```bash
cd client
npm run dev
```

### 3. Open http://localhost:3000

You'll see the **University Portal** with three service folders:
- 💰 **Finance Service** - Check balance, make payments
- 📚 **Academics Service** - View grades, timetables
- 📁 **My Files** - Upload and manage documents

Click any folder to "launch" that microservice!

---

## 🧪 Testing

### Quick Test
```bash
# Test single RPC call
node tests/test_persistence.js
```

### Load Test (1000 requests)
```bash
node tests/load_test.js 1000
```

---

## 📚 Key Concepts

| Concept | Implementation |
|---------|---------------|
| **Stub** | `client/app/api/rpc/route.ts` - HTTP to TCP bridge |
| **Skeleton** | `server/src/server.js` - TCP server & dispatcher |
| **TCP Sockets** | `net.createServer()` for reliable communication |
| **Queuing** | `processingQueue[]` for traffic shaping |
| **Microservices** | Finance, Academics, Files as separate handlers |
| **Persistence** | Convex database for durable storage |

---

## 📄 Documentation

- [Evaluation Guide](./docs/EVALUATION_GUIDE.md) - Detailed concept explanations
- [Testing Guide](./docs/TESTING_GUIDE.md) - Step-by-step testing instructions

---

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

---

## 📜 License

Academic project for IS-BST University.
