export const NODE_ID = process.env.NODE_ID || "node1";
export const HTTP_PORT = parseInt(process.env.HTTP_PORT || "3001");
export const PEER_URLS = (process.env.PEER_URLS || "").split(",").filter(Boolean);
export const HEARTBEAT_INTERVAL = 1500;
export const ELECTION_TIMEOUT_MIN = 3000;
export const ELECTION_TIMEOUT_MAX = 5000;
export const QUORUM = Math.floor((PEER_URLS.length + 1) / 2) + 1;
export const WAL_DIR = process.env.WAL_DIR || "./data";