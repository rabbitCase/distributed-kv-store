import fs from "fs";
import path from "path";
import { LogEntry } from "./types";
import { NODE_ID, WAL_DIR } from "./config";

export class KVStore {
  private data: Map<string, string> = new Map();
  private log: LogEntry[] = [];
  private commitIndex = 0;
  private walFile: string;

  constructor() {
    if (!fs.existsSync(WAL_DIR)) {
      fs.mkdirSync(WAL_DIR, { recursive: true });
    }
    this.walFile = path.join(WAL_DIR, `wal_${NODE_ID}.log`);
    this.loadWAL();
  }

  appendEntry(term: number, key: string, value: string): LogEntry {
    const index = this.log.length + 1;
    const entry: LogEntry = { index, term, key, value };
    
    this.log.push(entry);
    this.persistEntry(entry);
    
    return entry;
  }

  getEntry(index: number): LogEntry | null {
    if (index < 1 || index > this.log.length) {
      return null;
    }
    return this.log[index - 1];
  }

  getLastLogIndex(): number {
    return this.log.length;
  }

  getLastLogTerm(): number {
    if (this.log.length === 0) {
      return 0;
    }
    return this.log[this.log.length - 1].term;
  }

  deleteEntriesFrom(index: number): void {
    if (index <= this.log.length) {
      this.log = this.log.slice(0, index - 1);
      this.rewriteWAL();
    }
  }

  appendEntries(entries: LogEntry[]): void {
    for (const entry of entries) {
      if (entry.index <= this.log.length) {
        this.log[entry.index - 1] = entry;
      } else {
        this.log.push(entry);
      }
      this.persistEntry(entry);
    }
  }

  commit(index: number): void {
    if (index > this.commitIndex) {
      for (let i = this.commitIndex; i < index && i < this.log.length; i++) {
        const entry = this.log[i];
        this.data.set(entry.key, entry.value);
      }
      this.commitIndex = Math.min(index, this.log.length);
    }
  }

  get(key: string): string | null {
    return this.data.get(key) || null;
  }

  getCommitIndex(): number {
    return this.commitIndex;
  }

  getEntriesFrom(index: number): LogEntry[] {
    if (index < 1 || index > this.log.length + 1) {
      return [];
    }
    return this.log.slice(index - 1);
  }

  private persistEntry(entry: LogEntry): void {
    fs.appendFileSync(this.walFile, JSON.stringify(entry) + "\n", "utf-8");
  }

  private rewriteWAL(): void {
    const tempFile = this.walFile + ".tmp";
    fs.writeFileSync(tempFile, "", "utf-8");
    for (const entry of this.log) {
      fs.appendFileSync(tempFile, JSON.stringify(entry) + "\n", "utf-8");
    }
    fs.renameSync(tempFile, this.walFile);
  }

  private loadWAL(): void {
    if (!fs.existsSync(this.walFile)) {
      return;
    }

    const content = fs.readFileSync(this.walFile, "utf-8");
    const lines = content.split("\n").filter(Boolean);

    for (const line of lines) {
      try {
        const entry: LogEntry = JSON.parse(line);
        this.log.push(entry);
        this.data.set(entry.key, entry.value);
        this.commitIndex = entry.index;
      } catch (err) {
        console.error("Failed to parse WAL entry:", line);
      }
    }
  }
}