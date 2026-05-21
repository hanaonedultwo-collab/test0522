import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

type DbSingleton = {
  client?: postgres.Sql;
  db?: ReturnType<typeof drizzle>;
};

const globalDb = globalThis as typeof globalThis & {
  __sajuDb?: DbSingleton;
};

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL 환경변수가 설정되지 않았습니다.");
  }

  return databaseUrl;
}

export function getDb() {
  if (!globalDb.__sajuDb) {
    globalDb.__sajuDb = {};
  }

  if (!globalDb.__sajuDb.client) {
    globalDb.__sajuDb.client = postgres(getDatabaseUrl(), {
      max: 10,
      prepare: false,
    });
  }

  if (!globalDb.__sajuDb.db) {
    globalDb.__sajuDb.db = drizzle(globalDb.__sajuDb.client);
  }

  return globalDb.__sajuDb.db;
}