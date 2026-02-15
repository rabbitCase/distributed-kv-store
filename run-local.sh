#!/bin/bash
#AI generated multi-node cluster helper script
mkdir -p data/node1 data/node2 data/node3

echo "Starting 3-node Raft cluster..."
echo ""

NODE_ID=node1 HTTP_PORT=3001 PEER_URLS=http://localhost:3002,http://localhost:3003 npm run dev &
PID1=$!

NODE_ID=node2 HTTP_PORT=3002 PEER_URLS=http://localhost:3001,http://localhost:3003 npm run dev &
PID2=$!

NODE_ID=node3 HTTP_PORT=3003 PEER_URLS=http://localhost:3001,http://localhost:3002 npm run dev &
PID3=$!

echo "Node 1 (PID $PID1): http://localhost:3001"
echo "Node 2 (PID $PID2): http://localhost:3002"
echo "Node 3 (PID $PID3): http://localhost:3003"
echo ""
echo "Press Ctrl+C to stop all nodes"

trap "kill $PID1 $PID2 $PID3 2>/dev/null" EXIT

wait