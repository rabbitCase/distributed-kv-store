import axios from "axios";
import { KVStore } from "./store";
import {
  NodeState,
  AppendEntriesRequest,
  AppendEntriesResponse,
  RequestVoteRequest,
  RequestVoteResponse,
} from "./types";
import {
  NODE_ID,
  PEER_URLS,
  HEARTBEAT_INTERVAL,
  ELECTION_TIMEOUT_MIN,
  ELECTION_TIMEOUT_MAX,
  QUORUM,
} from "./config";

export class RaftNode {
  private state: NodeState = NodeState.FOLLOWER;
  private currentTerm = 0;
  private votedFor: string | null = null;
  private leaderId: string | null = null;
  private store: KVStore;
  
  private electionTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  
  private nextIndex: Map<string, number> = new Map();
  private matchIndex: Map<string, number> = new Map();
  
  private pendingWrites: Map<number, {
    resolve: (value: boolean) => void;
    reject: (reason: any) => void;
  }> = new Map();

  constructor(store: KVStore) {
    this.store = store;
    this.resetElectionTimer();
  }

  getState(): NodeState {
    return this.state;
  }

  getCurrentTerm(): number {
    return this.currentTerm;
  }

  getLeaderId(): string | null {
    return this.leaderId;
  }

  isLeader(): boolean {
    return this.state === NodeState.LEADER;
  }

  async write(key: string, value: string): Promise<boolean> {
    if (!this.isLeader()) {
      throw new Error("Not leader");
    }

    const entry = this.store.appendEntry(this.currentTerm, key, value);
    
    return new Promise((resolve, reject) => {
      this.pendingWrites.set(entry.index, { resolve, reject });
      
      this.sendAppendEntries();
      
      setTimeout(() => {
        if (this.pendingWrites.has(entry.index)) {
          this.pendingWrites.delete(entry.index);
          reject(new Error("Write timeout - quorum not reached"));
        }
      }, 5000);
    });
  }

  read(key: string): string | null {
    if (!this.isLeader()) {
      throw new Error("Not leader");
    }
    return this.store.get(key);
  }

  async handleAppendEntries(req: AppendEntriesRequest): Promise<AppendEntriesResponse> {
    if (req.term > this.currentTerm) {
      this.currentTerm = req.term;
      this.becomeFollower(req.leaderId);
    }

    if (req.term < this.currentTerm) {
      return { term: this.currentTerm, success: false, matchIndex: 0 };
    }

    this.resetElectionTimer();
    this.leaderId = req.leaderId;

    const prevEntry = this.store.getEntry(req.prevLogIndex);
    if (req.prevLogIndex > 0 && (!prevEntry || prevEntry.term !== req.prevLogTerm)) {
      return { term: this.currentTerm, success: false, matchIndex: this.store.getLastLogIndex() };
    }

    if (req.entries.length > 0) {
      const firstNewIndex = req.prevLogIndex + 1;
      this.store.deleteEntriesFrom(firstNewIndex);
      this.store.appendEntries(req.entries);
    }

    if (req.leaderCommit > this.store.getCommitIndex()) {
      const newCommitIndex = Math.min(req.leaderCommit, this.store.getLastLogIndex());
      this.store.commit(newCommitIndex);
    }

    return { term: this.currentTerm, success: true, matchIndex: this.store.getLastLogIndex() };
  }

  async handleRequestVote(req: RequestVoteRequest): Promise<RequestVoteResponse> {
    if (req.term > this.currentTerm) {
      this.currentTerm = req.term;
      this.votedFor = null;
      this.becomeFollower(null);
    }

    if (req.term < this.currentTerm) {
      return { term: this.currentTerm, voteGranted: false };
    }

    const lastLogIndex = this.store.getLastLogIndex();
    const lastLogTerm = this.store.getLastLogTerm();

    const logIsUpToDate =
      req.lastLogTerm > lastLogTerm ||
      (req.lastLogTerm === lastLogTerm && req.lastLogIndex >= lastLogIndex);

    if ((this.votedFor === null || this.votedFor === req.candidateId) && logIsUpToDate) {
      this.votedFor = req.candidateId;
      this.resetElectionTimer();
      return { term: this.currentTerm, voteGranted: true };
    }

    return { term: this.currentTerm, voteGranted: false };
  }

  private becomeFollower(leaderId: string | null): void {
    this.state = NodeState.FOLLOWER;
    this.leaderId = leaderId;
    this.votedFor = null;
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    
    this.resetElectionTimer();
  }

  private becomeCandidate(): void {
    this.state = NodeState.CANDIDATE;
    this.currentTerm++;
    this.votedFor = NODE_ID;
    this.leaderId = null;

    this.resetElectionTimer();
    this.startElection();
  }

  private becomeLeader(): void {
    this.state = NodeState.LEADER;
    this.leaderId = NODE_ID;

    if (this.electionTimer) {
      clearTimeout(this.electionTimer);
      this.electionTimer = null;
    }

    for (const peer of PEER_URLS) {
      this.nextIndex.set(peer, this.store.getLastLogIndex() + 1);
      this.matchIndex.set(peer, 0);
    }

    this.sendHeartbeat();
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), HEARTBEAT_INTERVAL);
  }

  private resetElectionTimer(): void {
    if (this.electionTimer) {
      clearTimeout(this.electionTimer);
    }

    const timeout = ELECTION_TIMEOUT_MIN + Math.random() * (ELECTION_TIMEOUT_MAX - ELECTION_TIMEOUT_MIN);
    this.electionTimer = setTimeout(() => this.becomeCandidate(), timeout);
  }

  private async startElection(): Promise<void> {
    const votesReceived = new Set([NODE_ID]);

    const promises = PEER_URLS.map(async (peer) => {
      try {
        const req: RequestVoteRequest = {
          term: this.currentTerm,
          candidateId: NODE_ID,
          lastLogIndex: this.store.getLastLogIndex(),
          lastLogTerm: this.store.getLastLogTerm(),
        };

        const response = await axios.post<RequestVoteResponse>(
          `${peer}/raft/vote`,
          req,
          { timeout: 1000 }
        );

        if (response.data.term > this.currentTerm) {
          this.currentTerm = response.data.term;
          this.becomeFollower(null);
          return;
        }

        if (response.data.voteGranted) {
          votesReceived.add(peer);
        }
      } catch (err) {
        
      }
    });

    await Promise.all(promises);

    if (this.state === NodeState.CANDIDATE && votesReceived.size >= QUORUM) {
      this.becomeLeader();
    }
  }

  private async sendHeartbeat(): Promise<void> {
    await this.sendAppendEntries();
  }

  private async sendAppendEntries(): Promise<void> {
    const promises = PEER_URLS.map(async (peer) => {
      try {
        const nextIdx = this.nextIndex.get(peer) || 1;
        const prevLogIndex = nextIdx - 1;
        const prevLogTerm = prevLogIndex > 0 ? (this.store.getEntry(prevLogIndex)?.term || 0) : 0;

        const entries = this.store.getEntriesFrom(nextIdx);

        const req: AppendEntriesRequest = {
          term: this.currentTerm,
          leaderId: NODE_ID,
          prevLogIndex,
          prevLogTerm,
          entries,
          leaderCommit: this.store.getCommitIndex(),
        };

        const response = await axios.post<AppendEntriesResponse>(
          `${peer}/raft/append`,
          req,
          { timeout: 1000 }
        );

        if (response.data.term > this.currentTerm) {
          this.currentTerm = response.data.term;
          this.becomeFollower(null);
          return;
        }

        if (response.data.success) {
          this.matchIndex.set(peer, response.data.matchIndex);
          this.nextIndex.set(peer, response.data.matchIndex + 1);
          this.updateCommitIndex();
        } else {
          const currentNext = this.nextIndex.get(peer) || 1;
          this.nextIndex.set(peer, Math.max(1, currentNext - 1));
        }
      } catch (err) {
        
      }
    });

    await Promise.all(promises);
  }

  private updateCommitIndex(): void {
    const matchIndexes = Array.from(this.matchIndex.values()).sort((a, b) => b - a);
    matchIndexes.unshift(this.store.getLastLogIndex());

    const quorumIndex = matchIndexes[QUORUM - 1];

    if (quorumIndex > this.store.getCommitIndex()) {
      const entry = this.store.getEntry(quorumIndex);
      if (entry && entry.term === this.currentTerm) {
        this.store.commit(quorumIndex);
        
        for (let i = this.store.getCommitIndex(); i >= 1; i--) {
          const pending = this.pendingWrites.get(i);
          if (pending) {
            pending.resolve(true);
            this.pendingWrites.delete(i);
          }
        }
      }
    }
  }
}