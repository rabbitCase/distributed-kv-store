import express from "express";
import { RaftNode } from "./raft";
import { KVStore } from "./store";
import { HTTP_PORT } from "./config";

const app = express();
app.use(express.json());

const store = new KVStore();
const raft = new RaftNode(store);

app.put("/kv/:key", async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (!value) {
      return res.status(400).json({ error: "Value is required" });
    }

    await raft.write(key, value);
    return res.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Not leader") {
      const leaderId = raft.getLeaderId();
      return res.status(503).json({ 
        error: "Not leader",
        leader: leaderId 
      });
    }
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

app.get("/kv/:key", (req, res) => {
  try {
    const { key } = req.params;
    const value = raft.read(key);
    return res.json({ key, value });
  } catch (err) {
    if (err instanceof Error && err.message === "Not leader") {
      const leaderId = raft.getLeaderId();
      return res.status(503).json({ 
        error: "Not leader",
        leader: leaderId 
      });
    }
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

app.post("/raft/append", async (req, res) => {
  try {
    const response = await raft.handleAppendEntries(req.body);
    return res.json(response);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

app.post("/raft/vote", async (req, res) => {
  try {
    const response = await raft.handleRequestVote(req.body);
    return res.json(response);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

app.get("/status", (_req, res) => {
  return res.json({
    state: raft.getState(),
    term: raft.getCurrentTerm(),
    leader: raft.getLeaderId(),
    isLeader: raft.isLeader(),
  });
});

app.listen(HTTP_PORT, () => {
  console.log(`Node started on port ${HTTP_PORT}`);
});