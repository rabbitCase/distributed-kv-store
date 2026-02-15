# Distributed Key-Value Store with Raft Consensus

(Note: An LLLM scanned the codebase and wrote this documentation)

A production-ready distributed key-value store implementing the Raft consensus algorithm for strong consistency and fault tolerance.

## Features

- **Raft Consensus Protocol**: Full implementation with leader election, log replication, and commit verification
- **Strong Consistency**: Linearizable reads and writes guaranteed through quorum-based replication
- **Fault Tolerance**: Tolerates up to ⌊n/2⌋ node failures in a cluster of n nodes
- **Write-Ahead Logging**: Durable storage with crash recovery capabilities
- **Leader Election**: Automatic failover with randomized election timeouts
- **HTTP API**: RESTful interface for client interactions

## Architecture

### Components

**Raft Node**: Implements the Raft consensus protocol including:

- Leader election with randomized timeouts
- Log replication with append entries
- Commit index tracking and advancement
- Vote request handling

**KV Store**: Manages state and persistence:

- In-memory key-value storage
- Write-ahead log for durability
- Log compaction support
- Automatic recovery from WAL on startup

**HTTP Server**: Client-facing API:

- PUT operations for writes (leader only)
- GET operations for reads (leader only)
- Status endpoint for cluster inspection
- Automatic leader redirection on follower requests

### Consensus Flow

1. Client sends write request to any node
2. If follower, returns leader location
3. Leader appends entry to local log
4. Leader replicates to all followers via AppendEntries RPC
5. Followers persist to WAL and acknowledge
6. Once majority acknowledges, leader commits entry
7. Committed entry applied to state machine
8. Success response sent to client

## Installation

```bash
npm install
```

## Running Locally

### Single Node (Development)

```bash
NODE_ID=node1 HTTP_PORT=3001 PEER_URLS= npm run dev
```

### Three-Node Cluster

Terminal 1:

```bash
NODE_ID=node1 HTTP_PORT=3001 PEER_URLS=http://localhost:3002,http://localhost:3003 npm run dev
```

Terminal 2:

```bash
NODE_ID=node2 HTTP_PORT=3002 PEER_URLS=http://localhost:3001,http://localhost:3003 npm run dev
```

Terminal 3:

```bash
NODE_ID=node3 HTTP_PORT=3003 PEER_URLS=http://localhost:3001,http://localhost:3002 npm run dev
```

## Running with Docker

```bash
docker-compose up --build
```

This starts a 3-node cluster with nodes accessible at:

- Node 1: http://localhost:3001
- Node 2: http://localhost:3002
- Node 3: http://localhost:3003

## API Reference

### Write Key-Value Pair

```bash
PUT /kv/:key
Content-Type: application/json

{
  "value": "string"
}
```

**Success Response**:

```json
{
  "success": true
}
```

**Error Response** (Not Leader):

```json
{
  "error": "Not leader",
  "leader": "node1"
}
```

### Read Key-Value Pair

```bash
GET /kv/:key
```

**Success Response**:

```json
{
  "key": "mykey",
  "value": "myvalue"
}
```

### Get Node Status

```bash
GET /status
```

**Response**:

```json
{
  "state": "LEADER",
  "term": 5,
  "leader": "node1",
  "isLeader": true
}
```

## Usage Examples

### Write Data

```bash
curl -X PUT http://localhost:3001/kv/username \
  -H "Content-Type: application/json" \
  -d '{"value":"alice"}'
```

### Read Data

```bash
curl http://localhost:3001/kv/username
```

### Check Cluster Status

```bash
curl http://localhost:3001/status
curl http://localhost:3002/status
curl http://localhost:3003/status
```

## Testing Fault Tolerance

### Simulate Leader Failure

```bash
docker-compose stop node1
```

Wait a few seconds for election, then check new leader:

```bash
curl http://localhost:3002/status
```

Continue operations with new leader:

```bash
curl -X PUT http://localhost:3002/kv/test \
  -H "Content-Type: application/json" \
  -d '{"value":"resilient"}'
```

### Test Split Brain Protection

Stop 2 out of 3 nodes:

```bash
docker-compose stop node2 node3
```

Writes should fail (no quorum):

```bash
curl -X PUT http://localhost:3001/kv/test \
  -H "Content-Type: application/json" \
  -d '{"value":"should-fail"}'
```

### Verify Persistence

Write data:

```bash
curl -X PUT http://localhost:3001/kv/persistent \
  -H "Content-Type: application/json" \
  -d '{"value":"durable"}'
```

Restart cluster:

```bash
docker-compose restart
```

Verify data survived:

```bash
curl http://localhost:3001/kv/persistent
```

## Configuration

Environment variables:

| Variable    | Description                           | Default  |
| ----------- | ------------------------------------- | -------- |
| `NODE_ID`   | Unique identifier for this node       | `node1`  |
| `HTTP_PORT` | Port for HTTP server                  | `3001`   |
| `PEER_URLS` | Comma-separated URLs of peer nodes    | ``       |
| `WAL_DIR`   | Directory for write-ahead log storage | `./data` |

## Project Structure

```
src/
├── config.ts          # Configuration management
├── types.ts           # TypeScript type definitions
├── store.ts           # KV store and WAL implementation
├── raft.ts            # Raft consensus protocol
├── server.ts          # HTTP server and API handlers
└── index.ts           # Application entry point
```

## Raft Protocol Details

### Leader Election

- Nodes start as followers with randomized election timeout (3-5 seconds)
- On timeout, follower becomes candidate and requests votes
- Candidate with majority votes becomes leader
- Leader sends periodic heartbeats (1.5 seconds)

### Log Replication

- Leader accepts client writes and appends to local log
- Leader sends AppendEntries RPCs to all followers
- Followers append entries and respond with acknowledgment
- Once majority acknowledges, entry is committed
- Leader advances commit index and notifies followers

### Safety Guarantees

- **Election Safety**: At most one leader per term
- **Leader Append-Only**: Leader never overwrites or deletes log entries
- **Log Matching**: If two logs contain an entry with same index and term, they are identical up to that index
- **Leader Completeness**: If entry is committed in a term, it will be present in all future leader logs
- **State Machine Safety**: If a server has applied a log entry at a given index, no other server will apply a different entry for that index

## Performance Characteristics

- **Write Latency**: O(RTT) for quorum acknowledgment
- **Read Latency**: O(1) for leader-local reads
- **Storage**: O(n) where n is total log entries
- **Network**: O(m\*k) messages per write where m = followers, k = retries

## Limitations

- Reads only served by leader (linearizable but not optimized for read-heavy workloads)
- No log compaction (WAL grows unbounded)
- No membership changes (cluster size fixed at startup)
- No snapshots (full log replay on recovery)

## Building for Production

```bash
npm run build
npm start
```

## License

MIT
