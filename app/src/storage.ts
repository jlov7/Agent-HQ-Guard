import fs from "node:fs";
import path from "node:path";
import sqlite3 from "sqlite3";

sqlite3.verbose();

export interface GuardOverrides {
  allowAgents: string[];
  budgetTokens?: number;
}

export class GuardStorage {
  private db: sqlite3.Database;

  constructor(databasePath = path.join(process.cwd(), "data", "guard.sqlite")) {
    const dir = path.dirname(databasePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new sqlite3.Database(databasePath);
    this.bootstrap();
  }

  private bootstrap() {
    this.db.serialize(() => {
      this.db.run(
        `CREATE TABLE IF NOT EXISTS overrides (
            repo TEXT NOT NULL,
            pull_number INTEGER NOT NULL,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            PRIMARY KEY (repo, pull_number, key, value)
        )`
      );
    });
  }

  async healthCheck(): Promise<void> {
    await new Promise((resolve, reject) => {
      this.db.get("SELECT 1", [], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(undefined);
        }
      });
    });
  }

  async addAgentOverride(repo: string, pullNumber: number, agent: string): Promise<void> {
    await this.run(
      `INSERT OR IGNORE INTO overrides (repo, pull_number, key, value) VALUES (?, ?, 'allow_agent', ?)`,
      [repo, pullNumber, agent]
    );
  }

  async setBudget(repo: string, pullNumber: number, tokens: number): Promise<void> {
    await this.run(`DELETE FROM overrides WHERE repo = ? AND pull_number = ? AND key = 'budget'`, [
      repo,
      pullNumber
    ]);
    await this.run(
      `INSERT INTO overrides (repo, pull_number, key, value) VALUES (?, ?, 'budget', ?)`.trim(),
      [repo, pullNumber, String(tokens)]
    );
  }

  async loadOverrides(repo: string, pullNumber: number): Promise<GuardOverrides> {
    const rows = await this.all<{ key: string; value: string }>(
      `SELECT key, value FROM overrides WHERE repo = ? AND pull_number = ?`,
      [repo, pullNumber]
    );

    const overrides: GuardOverrides = {
      allowAgents: []
    };

    for (const row of rows) {
      if (row.key === "allow_agent") {
        overrides.allowAgents.push(row.value);
      }
      if (row.key === "budget") {
        overrides.budgetTokens = Number(row.value);
      }
    }

    return overrides;
  }

  private run(sql: string, params: unknown[]): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private all<T>(sql: string, params: unknown[]): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all<T>(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
}
