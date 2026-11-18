import assert from "node:assert/strict";
import { readProjectFile } from "./module-loader";

export interface SqlTableContract {
  tableName: string;
  requireMadrasaId?: boolean;
  requireRls?: boolean;
  requireMadrasaPolicy?: boolean;
}

export interface SqlMigrationContract {
  filePath: string;
  tables: SqlTableContract[];
  materializedViews?: string[];
  functions?: string[];
}

export function verifySqlMigrationContract(contract: SqlMigrationContract): string {
  const sql = readProjectFile(contract.filePath);

  for (const tbl of contract.tables) {
    const escaped = tbl.tableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // 1. Idempotent CREATE TABLE IF NOT EXISTS
    const createTableRegex = new RegExp(
      `CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+(?:public\\.)?${escaped}\\b`,
      "i"
    );
    assert.match(
      sql,
      createTableRegex,
      `[${contract.filePath}] Table "${tbl.tableName}" must use idempotent "CREATE TABLE IF NOT EXISTS".`
    );

    // Extract table definition body for column checks
    const bodyRegex = new RegExp(
      `CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+(?:public\\.)?${escaped}\\s*\\(([\\s\\S]*?)\\);`,
      "i"
    );
    const bodyMatch = sql.match(bodyRegex);
    assert.ok(
      bodyMatch,
      `[${contract.filePath}] Could not parse DDL block for table "${tbl.tableName}".`
    );
    const body = bodyMatch[1];

    // 2. Multi-tenant madrasa_id FK with ON DELETE CASCADE
    if (tbl.requireMadrasaId !== false) {
      assert.match(
        body,
        /madrasa_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+(?:public\.)?madrasas\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE/i,
        `[${contract.filePath}] Table "${tbl.tableName}" must define "madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE".`
      );
    }

    // 3. Row Level Security enabled
    if (tbl.requireRls !== false) {
      const rlsRegex = new RegExp(
        `ALTER\\s+TABLE\\s+(?:public\\.)?${escaped}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
        "i"
      );
      assert.match(
        sql,
        rlsRegex,
        `[${contract.filePath}] Table "${tbl.tableName}" must enable Row Level Security.`
      );
    }

    // 4. Idempotent DROP POLICY IF EXISTS + CREATE POLICY with tenant isolation predicate
    if (tbl.requireMadrasaPolicy !== false) {
      const dropPolicyRegex = new RegExp(
        `DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+[^;]+\\s+ON\\s+(?:public\\.)?${escaped}\\b`,
        "i"
      );
      assert.match(
        sql,
        dropPolicyRegex,
        `[${contract.filePath}] Table "${tbl.tableName}" must use idempotent "DROP POLICY IF EXISTS ... ON ${tbl.tableName}".`
      );

      const createPolicyRegex = new RegExp(
        `CREATE\\s+POLICY\\s+[^;]+\\s+ON\\s+(?:public\\.)?${escaped}\\b[\\s\\S]*?(?:madrasa_id\\s*=\\s*(?:public\\.)?get_auth_madrasa_id\\(\\)|EXISTS\\s*\\()`,
        "i"
      );
      assert.match(
        sql,
        createPolicyRegex,
        `[${contract.filePath}] Table "${tbl.tableName}" must define RLS policy enforcing madrasa_id = public.get_auth_madrasa_id() (or parent EXISTS).`
      );
    }
  }

  if (contract.materializedViews) {
    for (const mv of contract.materializedViews) {
      const escaped = mv.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const mvRegex = new RegExp(
        `CREATE\\s+MATERIALIZED\\s+VIEW\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:public\\.)?${escaped}\\b`,
        "i"
      );
      assert.match(
        sql,
        mvRegex,
        `[${contract.filePath}] Missing Materialized View "${mv}".`
      );
    }
  }

  if (contract.functions) {
    for (const fn of contract.functions) {
      const escaped = fn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const fnRegex = new RegExp(
        `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+(?:public\\.)?${escaped}\\b`,
        "i"
      );
      assert.match(
        sql,
        fnRegex,
        `[${contract.filePath}] Missing idempotent function "CREATE OR REPLACE FUNCTION ${fn}".`
      );
    }
  }

  return sql;
}
