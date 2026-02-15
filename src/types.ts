export interface LogEntry {
  index: number;
  term: number;
  key: string;
  value: string;
}

export interface AppendEntriesRequest {
  term: number;
  leaderId: string;
  prevLogIndex: number;
  prevLogTerm: number;
  entries: LogEntry[];
  leaderCommit: number;
}

export interface AppendEntriesResponse {
  term: number;
  success: boolean;
  matchIndex: number;
}

export interface RequestVoteRequest {
  term: number;
  candidateId: string;
  lastLogIndex: number;
  lastLogTerm: number;
}

export interface RequestVoteResponse {
  term: number;
  voteGranted: boolean;
}

export enum NodeState {
  FOLLOWER = "FOLLOWER",
  CANDIDATE = "CANDIDATE",
  LEADER = "LEADER",
}