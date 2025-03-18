import { Hono } from "hono";
import { ShapeStream } from "@electric-sql/client";
import { threadsTable, ThreadStreamChunksTableRow } from "./db/schema";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { cors } from "hono/cors";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { chunkByLineStream } from "./util/splitByLineStream";

type Bindings = {
  OPENAI_API_KEY: string;
  DATABASE_URL: string;
  ELECTRIC_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use(cors());

const insertPayload = (
  db: ReturnType<typeof drizzle>,
  thread_id: string,
  payload: unknown
) => {
  return db.insert(threadsTable).values({
    thread_id,
    sequence: sql`(SELECT COALESCE(MAX(sequence), -1) + 1 FROM ${threadsTable} WHERE ${threadsTable.thread_id} = ${thread_id})`,
    payload: JSON.stringify(payload),
  });
};

app.post("/api/chat", async (c) => {
  const { thread_id, messages } = await c.req.json();

  const userMessage = messages.at(-1);
  const openai = createOpenAI({
    apiKey: c.env.OPENAI_API_KEY,
  });

  const db = drizzle(c.env.DATABASE_URL);

  const result = streamText({
    model: openai("gpt-4o-mini"),
    messages,
  });

  c.executionCtx.waitUntil(
    result
      .toDataStream()
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(chunkByLineStream())
      .pipeTo(
        new WritableStream({
          start: async () => {
            // append the user message
            await insertPayload(db, thread_id, {
              type: "message",
              message: userMessage,
            });
          },
          write: async (chunk) => {
            await insertPayload(db, thread_id, { type: "ai-chunk", chunk });
          },
        })
      )
  );

  return result.toDataStreamResponse();
});

export default app;
