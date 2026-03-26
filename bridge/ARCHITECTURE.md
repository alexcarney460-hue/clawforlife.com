# ClawForLife Bridge — Architecture

## ADR-001: Local REST API over USB Tethering

### Status
Accepted

### Context
ClawForLife customers buy a phone that needs access to their PC business files
(customer lists, invoices, QuickBooks exports). The phone AI uses this data to
run the business — answering calls with real customer info, sending invoices,
following up on unpaid bills.

We need a mechanism for the phone to access PC files that is:
- Simple for a non-technical business owner
- Secure (no data leaves the local network)
- Cross-platform (Windows and macOS)
- Lightweight (~5MB install)

### Decision
A Node.js Express server runs on the customer's PC as a background service.
It exposes a REST API on port 18800, bound only to localhost and USB tether
interfaces. The phone connects via ADB reverse port forwarding (USB) or
USB tethering (direct network).

**Why REST over alternatives:**
- WebSocket: more complex, SSE gives us push when needed
- gRPC: overkill, adds protobuf dependency
- File sync (rsync/syncthing): too blunt, we need structured business data
- Cloud relay: adds latency, cost, and security concerns

**Why Node.js:**
- Already on most dev machines, easy to bundle
- Express is 500KB, entire server is <5MB with deps
- Same language on phone (Termux has Node.js)
- Good cross-platform filesystem APIs

### Consequences
- (+) Zero cloud dependency, all data stays local
- (+) Customer controls exactly which folders are shared
- (+) Phone can query structured business data, not just raw files
- (-) Requires USB connection or same-network for initial setup
- (-) ADB reverse requires USB debugging enabled (one-time setup)
- (-) Node.js must be installed on the PC (installer handles this)


## ADR-002: Bearer Token Auth (No TLS)

### Status
Accepted

### Context
The bridge only listens on localhost/USB interfaces. Adding TLS would require
certificate generation and management, which adds complexity for the customer.

### Decision
Use a random 256-bit bearer token generated at first run. The phone receives
this token during USB pairing. All API requests must include the token.

No TLS because:
- Traffic never leaves localhost or the USB interface
- USB is a point-to-point connection (not sniffable like WiFi)
- TLS cert management is painful for non-technical users

### Consequences
- (+) Simple, no cert management
- (+) Token is 256-bit random, infeasible to brute force
- (-) If someone gains physical access to the PC, they can read the config file
- (-) If used over WiFi (not recommended), traffic is unencrypted


## System Components

```
+------------------+        USB / ADB reverse        +------------------+
|    CUSTOMER PC   |  <------- port 18800 -------->  | OPENCLAW PHONE   |
|                  |                                  |                  |
|  bridge/server   |                                  |  bridge/client   |
|  - Express API   |                                  |  - REST client   |
|  - File browser  |                                  |  - Data sync     |
|  - File watcher  |                                  |  - Local cache   |
|  - CSV/XLSX/PDF  |                                  |  - AI analysis   |
|    parsers       |                                  |                  |
|  - Setup web UI  |                                  |                  |
+------------------+                                  +------------------+
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/status | Yes | Bridge health, uptime, config |
| GET | /api/files?path=/ | Yes | List directory contents |
| GET | /api/files/read?path=... | Yes | Read file (text/base64) |
| POST | /api/files/write | Yes | Write file (requires write perm) |
| GET | /api/files/search?q=... | Yes | Search files by name |
| GET | /api/files/watch | Yes | SSE stream of file changes |
| GET | /api/business/contacts | Yes | Parsed contact lists |
| GET | /api/business/invoices | Yes | Parsed invoice data |
| GET | /api/business/calendar | Yes | Calendar events from ICS |
| GET | /api/business/summary | Yes | Overview of all business data |
| GET | /api/setup/status | No | Is bridge running? |
| POST | /api/setup/pair | No* | Get auth token (first run only) |
| POST | /api/setup/folders | Yes | Set shared folders |
| POST | /api/setup/write-access | Yes | Toggle write permission |
| POST | /api/setup/complete | Yes | Mark setup done |
| POST | /api/setup/reset | Yes | Factory reset |

*Pair endpoint is disabled after setup is complete.

## Security Model

1. **Network binding**: localhost + USB tether interfaces only
2. **Folder whitelist**: customer explicitly selects which folders to share
3. **Bearer token**: 256-bit random, required for all data endpoints
4. **Read-only default**: write access is opt-in
5. **No cloud**: all data stays on the local USB/network connection
6. **File size cap**: refuses to serve files >10MB (prevents memory issues)
7. **Depth limit**: file search/walk capped at 5 levels deep

## Setup Flow

1. Customer runs `install.bat` (Windows) or `install.sh` (macOS/Linux)
2. Bridge starts, opens browser to `http://127.0.0.1:18800`
3. Customer adds folders (Documents, QuickBooks directory, etc.)
4. Customer connects phone via USB
5. On PC: `adb reverse tcp:18800 tcp:18800`
6. On phone: `node pair.js` (receives auth token)
7. On phone: `node sync.js` (pulls business data)
8. OpenClaw AI now has customer lists, invoices, and calendar data
