import { InferSelectModel } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  primaryKey,
  varchar,
} from "drizzle-orm/pg-core";

export const threadsTable = pgTable(
  "threads",
  {
    thread_id: varchar("thread_id", { length: 255 }).notNull(),
    sequence: integer("sequence").notNull(),
    payload: varchar("payload", { length: 65536 }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.thread_id, table.sequence] }),
    threadIdSequenceIdx: index("threads_thread_id_sequence_idx").on(
      table.thread_id,
      table.sequence
    ),
  })
);

export type ThreadStreamChunksTableRow = InferSelectModel<typeof threadsTable>;
