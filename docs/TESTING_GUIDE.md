# IS-BST University Portal - Testing Guide

A quick reference for **evaluators** and **testers** to verify all distributed systems concepts work correctly.

---

## ⚡ Quick Verification Checklist

| # | Concept | Test Command | What to Look For |
|---|---------|--------------|------------------|
| 1 | RPC Works | Click "Upload File" in UI | Server terminal shows `[Server] Received: UPLOAD_FILE` |
| 2 | Queueing | `node load_test.js 100` | Server shows `[Queue] Job added. Queue size: X` |
| 3 | TCP Sockets | Start server, open UI | Server shows `[Server] Client connected` |
| 4 | Persistence | Upload a file, run `npx convex run uploads:listUploads` | Upload appears in database |
| 5 | Multi-device | Run test from another machine | Same server handles requests |

---

## 🚀 Setup (First Time)

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/is-bst-university-portal.git
cd is-bst-university-portal

# 2. Install dependencies
cd server && npm install && cd ..
cd client && npm install && cd ..

# 3. Start in 3 separate terminals
# Terminal 1:
cd server/src && node server.js

# Terminal 2:
cd client && npx convex dev

# Terminal 3:
cd client && npm run dev

# 4. Open http://localhost:3000
```

---

## 📋 Detailed Test Scripts

### Test 1: Verify RPC Stub/Skeleton Pattern

**Goal**: Confirm the client stub correctly forwards requests to the server skeleton.

**Steps**:
1. Start the RPC server: `cd rpc-server && node server.js`
2. Run the single-request test:
   ```bash
   node rpc-server/test_persistence.js
   ```
3. **Expected server output**:
   ```
   [Server] Client connected: ::1:XXXXX
   [Server] Received: UPLOAD_FILE from ::1:XXXXX
   [Queue] Job added. Queue size: 1
   [Worker] Processing job: UPLOAD_FILE | Queue remaining: 0
   [Convex] Logging upload: test_file.txt
   [Worker] Completed: UPLOAD_FILE | Total processed: 1
   ```

**Verification**: The message travels: Client → Stub (route.ts) → TCP Socket → Skeleton (server.js) → Worker

---

### Test 2: Verify Queue Traffic Shaping

**Goal**: Confirm the queue absorbs traffic bursts without crashing.

**Steps**:
1. Ensure server is running
2. Run load test with 100 concurrent requests:
   ```bash
   node load_test.js 100
   ```
3. **Expected output**:
   ```
   ╔════════════════════════════════════════════════════════════════╗
   ║                    LOAD TEST RESULTS                           ║
   ╠════════════════════════════════════════════════════════════════╣
   ║  Completed:         100                                        ║
   ║  Failed:            0                                          ║
   ║  Success Rate:      100.00%                                    ║
   ╚════════════════════════════════════════════════════════════════╝
   ```

4. **Watch the server terminal** - you'll see:
   ```
   [Queue] Job added. Queue size: 47
   [Queue] Job added. Queue size: 48
   ...
   [Worker] Processing job: CHECK_BALANCE | Queue remaining: 47
   [Worker] Processing job: CHECK_BALANCE | Queue remaining: 46
   ```

**Verification**: Queue size increases during burst, then drains as worker processes jobs.

---

### Test 3: University Portal Services

**Goal**: Test the IS-BST University RPC methods.

**Steps**:
1. Open http://localhost:3000
2. Scroll down to "🎓 University Portal Demo" section
3. Click each button and observe:

| Button | Server Log | RPC Activity Log |
|--------|------------|------------------|
| Check Balance | `[Finance] Checking balance for student: STU001` | `→ Calling RPC: CHECK_BALANCE` |
| Fees Statement | `[Finance] Fetching fees statement for: STU001` | `→ Calling RPC: GET_FEES_STATEMENT` |
| Make Payment | `[Finance] Processing payment: 50000 for STU001` | `→ Calling RPC: MAKE_PAYMENT` |
| View Grades | `[Academics] Fetching grades for: STU001` | `→ Calling RPC: GET_GRADES` |
| View Timetable | `[Academics] Fetching timetable for: STU001` | `→ Calling RPC: GET_TIMETABLE` |
| Submit Assignment | `[Academics] Assignment submitted: assignment1.pdf` | `→ Calling RPC: UPLOAD_ASSIGNMENT` |

---

### Test 4: Persistence Verification

**Goal**: Confirm data persists to the Convex database.

**Steps**:
1. Upload a file via the UI or test script
2. Query the database:
   ```bash
   cd drive-clone
   npx convex run uploads:listUploads
   ```
3. **Expected output**:
   ```json
   [
     {
       "_id": "abc123...",
       "filename": "test_file.txt",
       "fileSize": 15,
       "status": "completed",
       "uploadedAt": 1704312000000
     }
   ]
   ```

**Verification**: Data survives even if the RPC server restarts.

---

### Test 5: Multi-Device Testing (Optional)

**Goal**: Prove the server can handle requests from multiple devices.

**On your main machine**:
```bash
# Get your IP address
# Mac:
ipconfig getifaddr en0
# Linux:
hostname -I
# Windows:
ipconfig | findstr IPv4
```

**On another device (same network)**:
```bash
# Option 1: Direct TCP test
echo '{"header":{"auth_token":"SECRET_123","method":"PING","timestamp":0},"body":{}}' | nc YOUR_IP 8080

# Option 2: Copy and run load_test.js, edit the host:
# In load_test.js, change:
# const RPC_SERVER_HOST = 'YOUR_IP';
node load_test.js 50
```

---

### Test 6: High Load (1000 Requests)

**Goal**: Stress test the system.

```bash
node load_test.js 1000
```

**Expected behavior**:
- Server doesn't crash ✓
- All requests eventually complete ✓
- Some requests have high latency (waiting in queue) ✓
- Queue size increases then drains ✓

---

## 🔍 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Connection refused" | RPC server not running. Start it with `cd rpc-server && node server.js` |
| "Convex error" | Convex not running. Start it with `cd drive-clone && npx convex dev` |
| "EADDRINUSE port 8080" | Port in use. Kill existing process: `lsof -ti:8080 | xargs kill` |
| Frontend not loading | Ensure `npm run dev` is running in drive-clone |
| Uploads not persisting | Check Convex is running and connected |

---

## 📊 Key Metrics to Report

After running `node load_test.js 1000`:

1. **Success Rate**: Should be 100% (no dropped requests)
2. **Avg Response Time**: Higher under load (due to queuing)
3. **Queue Max Size**: Peak during traffic burst
4. **Total Processing Time**: Time to complete all 1000 requests

---

## 📁 Files to Reference

| File | Purpose |
|------|---------|
| `rpc-server/server.js` | The Skeleton - where queuing and dispatch happen |
| `rpc-server/protocol.js` | PDU structure and RPC method definitions |
| `drive-clone/app/api/rpc/route.ts` | The Stub - HTTP to TCP bridge |
| `drive-clone/convex/schema.ts` | Database schema for persistent storage |
| `load_test.js` | Concurrent connection simulator |

---

## ✅ Final Checklist

Before submission, verify:

- [ ] `node server.js` starts without errors
- [ ] `npm run dev` loads the UI at localhost:3000
- [ ] Clicking "Test Connection" shows server alive
- [ ] Uploading a file shows in RPC Activity Log
- [ ] All 6 University Portal buttons respond
- [ ] `node load_test.js 100` completes with 100% success
- [ ] Upload data appears in Convex database
