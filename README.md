# IS-BST Cloud Storage

A distributed cloud storage system demonstrating core concepts in **Distributed Systems** and **Cloud Computing**.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Next.js)                              │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Login → OTP → Files/Folders → Upload (Chunking + Encryption)     │   │
│  └────────────────────────────────┬─────────────────────────────────┘   │
│                    ┌──────────────▼──────────────┐                      │
│                    │   API Route (STUB)          │                      │
│                    │   HTTP → TCP Bridge         │                      │
│                    └──────────────┬──────────────┘                      │
└───────────────────────────────────┼─────────────────────────────────────┘
                                    │ TCP Socket (Port 8080)
┌───────────────────────────────────▼─────────────────────────────────────┐
│                         RPC SERVER (SKELETON)                           │
│  ┌──────────────┐  ┌─────────────────────────────────────────────────┐  │
│  │ TCP Listener │─►│ Processing Queue → Worker → Service Handlers   │  │
│  └──────────────┘  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
is-bst-cloud-storage/
├── client/                 # Next.js Frontend
│   ├── app/
│   │   ├── api/rpc/        # Stub (HTTP→TCP)
│   │   ├── page.tsx        # Main UI
│   │   └── globals.css     # Styling
│   └── convex/             # Persistent storage
├── server/                 # RPC Server
│   └── src/
│       ├── server.js       # Skeleton + Queue
│       └── protocol.js     # PDU definitions
├── docs/
│   └── CONCEPTUAL_MASTERY.md  # Study guide
└── README.md
```

---

## 🚀 Quick Start

```bash
# Terminal 1: Start RPC Server
cd server && npm install && npm start

# Terminal 2: Start Frontend
cd client && npm install && npm run dev

# Open http://localhost:3000
```

---

## ✨ Features

| Feature | Concept Demonstrated |
|---------|---------------------|
| OTP Login | Authentication, Security |
| File Upload | RPC, Marshalling |
| Chunking (1MB) | Distributed Storage |
| Storage Quota | Resource Management |
| Folder CRUD | State Management |
| Activity Log | Observability |

---

## 📚 Study Guide

See [docs/CONCEPTUAL_MASTERY.md](./docs/CONCEPTUAL_MASTERY.md) for comprehensive explanations of:
- RPC and Stub/Skeleton Pattern
- TCP Sockets
- Message Queuing
- Microservices
- File Chunking & Distribution
- Security
- Practice Exam Questions
