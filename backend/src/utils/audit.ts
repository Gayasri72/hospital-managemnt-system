// ──────────────────────────────────────────────────────────────────────────────
// Audit log helper — writes an entry to `audit_logs` using a Prisma transaction
// client (or the global client if no tx is provided).
//
// Why: every mutation should write its audit log inside the same transaction
// that performed the mutation. If you split them, a DB blip between the two
// writes can leave the system mutated but unaudited. By accepting `tx`, callers
// can compose their domain mutation and the audit row atomically.
// ──────────────────────────────────────────────────────────────────────────────

import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../config/database';

export interface AuditEntry {
  user_id: string;
  action: string;
  entity: string;
  entity_id?: string | null;
}

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
  | Prisma.TransactionClient;

/**
 * Insert an audit log row. Pass a transaction client to keep it atomic with
 * the surrounding mutation; omit `tx` for fire-and-forget writes from
 * non-transactional read flows (rare).
 */
export async function writeAuditLog(
  entry: AuditEntry,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const client: TxClient = tx ?? prisma;
  await client.auditLog.create({
    data: {
      user_id: entry.user_id,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entity_id ?? null,
    },
  });
}
