#!/bin/bash
#AI generated test script which checks cluster/node status and WRITES/READS sample keys

echo "=== Testing Distributed KV Store ==="
echo ""

echo "1. Checking cluster status..."
curl -s $BASE_URL/status
echo ""

echo "2. Writing key 'name' with value 'Alice'..."
curl -s -X PUT $BASE_URL/kv/name \
  -H "Content-Type: application/json" \
  -d '{"value":"Alice"}'
echo ""

echo "3. Reading key 'name'..."
curl -s $BASE_URL/kv/name
echo ""

echo "4. Writing key 'age' with value '25'..."
curl -s -X PUT $BASE_URL/kv/age \
  -H "Content-Type: application/json" \
  -d '{"value":"25"}'
echo ""

echo "5. Reading key 'age'..."
curl -s $BASE_URL/kv/age
echo ""

echo "6. Writing key 'city' with value 'NYC'..."
curl -s -X PUT $BASE_URL/kv/city \
  -H "Content-Type: application/json" \
  -d '{"value":"NYC"}'
echo ""

echo "7. Reading key 'city'..."
curl -s $BASE_URL/kv/city
echo ""

echo "8. Reading non-existent key..."
curl -s $BASE_URL/kv/nonexistent
echo ""

echo "9. Checking all nodes status..."
for port in 3001 3002 3003; do
  echo "Node on port $port:"
  curl -s http://localhost:$port/status
  echo ""
done
echo ""

echo "=== Tests Complete ==="