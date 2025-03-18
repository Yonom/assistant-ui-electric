"use client";
import { Thread } from "@/components/assistant-ui/thread";
import {
  AssistantRuntimeProvider,
  TextContentPart,
  unstable_createMessageConverter,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import { useMemo, useState } from "react";
import { parseDataStreamPart } from "ai";
import { useShape } from "@electric-sql/react";

const THREAD_ID = "TEST_THREAD_ID";

type Message = {
  role: "user" | "assistant";
  content: [{ type: "text"; text: string }];
};

const { useThreadMessages } = unstable_createMessageConverter<Message>((m) => {
  return m;
});

type ThreadStreamColumn = {
  thread_id: string;
  sequence: number;
  payload: string;
};

type PayloadValue =
  | {
      type: "message";
      message: Message;
    }
  | {
      type: "ai-chunk";
      chunk: string;
    };

const messagesFromChunks = (chunks: ThreadStreamColumn[]) => {
  const messages: Message[] = [];

  for (const chunk of chunks) {
    const payload = JSON.parse(chunk.payload) as PayloadValue;
    if (payload.type === "message") {
      messages.push(payload.message);
    } else if (payload.type === "ai-chunk") {
      const parsedChunk = parseDataStreamPart(payload.chunk);
      if (parsedChunk.type === "text") {
        const lastMessage = messages.at(-1);
        if (lastMessage?.role !== "assistant") {
          messages.push({
            role: "assistant",
            content: [{ type: "text", text: parsedChunk.value }],
          });
        } else {
          lastMessage.content[0].text += parsedChunk.value;
        }
      }
    }
  }

  return messages;
};

export default function Home() {
  const { data } = useShape<ThreadStreamColumn>({
    url: "http://localhost:3000/v1/shape",
    params: {
      table: "threads",
      columns: ["thread_id", "sequence", "payload"],
      where: `thread_id = '${THREAD_ID}'`,
    },
  });

  const messages = useMemo(() => messagesFromChunks(data), [data]);

  const [isRunning, setIsRunning] = useState(false);

  const threadMessages = useThreadMessages(messages, isRunning);
  const runtime = useExternalStoreRuntime({
    isRunning,
    messages: threadMessages,
    onNew: async (m) => {
      const newMessage: Message = {
        role: "user",
        content: [
          { type: "text", text: (m.content[0] as TextContentPart).text },
        ],
      };
      const newMessages = [...messages, newMessage];

      setIsRunning(true);
      try {
        await fetch("http://localhost:8787/api/chat", {
          method: "POST",
          body: JSON.stringify({
            thread_id: THREAD_ID,
            messages: newMessages,
          }),
        });
      } finally {
        setIsRunning(false);
      }
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <main className="h-dvh grid gap-x-2 px-4 py-4">
        <Thread />
      </main>
    </AssistantRuntimeProvider>
  );
}
