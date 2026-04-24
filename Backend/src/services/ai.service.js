import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatMistralAI } from "@langchain/mistralai";
import { ChatGroq } from "@langchain/groq";
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tavily } from "@tavily/core";
import { z } from "zod";

// Tavily client
const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY });

const topicSchema = z.object({ topic: z.string() });

const researchTool = tool(
  async ({ topic }) => {
    const response = await tavilyClient.search(topic, {
      searchDepth: "advanced",
      includeAnswer: true,
      maxResults: 5,
    });

    const sources = response.results
      .map((r, i) => `[${i + 1}] ${r.title} — ${r.url}\n    ${r.content}`)
      .join("\n\n");

    return `SUMMARY:\n${response.answer}\n\nSOURCES:\n${sources}`;
  },
  {
    name: "researchTool",
    description:
      "Research any topic on the web and get a summarized answer with sources. Input: topic string.",
    schema: topicSchema,
  },
);

const newsTool = tool(
  async ({ topic }) => {
    const response = await tavilyClient.search(topic, {
      topic: "news",
      days: 3,
      includeAnswer: true,
      maxResults: 5,
    });

    const articles = response.results
      .map((r, i) => `[${i + 1}] ${r.title}\n    ${r.url}\n    ${r.content}`)
      .join("\n\n");

    return `LATEST NEWS ON: "${topic}"\n\nARTICLES:\n${articles}`;
  },
  {
    name: "newsTool",
    description:
      "Get the latest news from the past 3 days on any topic. Input: topic string.",
    schema: topicSchema,
  },
);

const mistralModel = new ChatMistralAI({
  model: "mistral-medium-latest",
  apiKey: process.env.MISTRAL_API_KEY,
});

const geminiModel = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: process.env.GEMINI_API_KEY,
});

const groqModel = new ChatGroq({
  model: "llama-3.3-70b-versatile",
  apiKey: process.env.GROQ_API_KEY,
});

const deepseekModel = new ChatGroq({
  model: "qwen/qwen3-32b",
  apiKey: process.env.GROQ_API_KEY,
});

function getModel(modelName) {
  switch (modelName) {
    case "gemini":
      return geminiModel;
    case "groq":
      return groqModel;
    case "deepseek":
      return deepseekModel;
    case "mistral":
    default:
      return mistralModel;
  }
}

const SYSTEM_PROMPT = `
You are a helpful, precise, and up-to-date assistant.

You have access to two tools: researchTool and newsTool. You MUST use them in the following situations — do not rely on your training data for these:

- Current date, time, or day of the week → use researchTool
- Current news, recent events, or anything that may have changed → use newsTool
- Sports scores, match schedules, IPL, cricket, football, or any live/recent sports data → use newsTool or researchTool
- Stock prices, crypto prices, weather, or any real-time data → use researchTool
- Any question containing words like "today", "now", "current", "latest", "recent", "this week", "this year" → use researchTool or newsTool

For general knowledge questions that do not involve current or time-sensitive information, you may answer directly without using tools.

Always be concise and accurate. If you use a tool, base your answer on what the tool returns.
`;

function extractToken(chunk) {
  if (typeof chunk?.content === "string") return chunk.content;
  if (Array.isArray(chunk?.content))
    return chunk.content.map((c) => c?.text || c?.content || "").join("");
  if (typeof chunk?.text === "string") return chunk.text;
  return "";
}

/**
 * Build the last HumanMessage with file attachment if present.
 * - Gemini: supports image/* and application/pdf as inline base64 data
 * - Mistral / Groq / DeepSeek: vision not supported via LangChain,
 *   so we append a plain-text note describing the attachment instead.
 */
function buildLastHumanMessage(text, file, modelName) {
  if (!file) {
    return new HumanMessage(text);
  }

  const isGemini = modelName === "gemini";
  const isImage = file.mimeType?.startsWith("image/");
  const isPdf = file.mimeType === "application/pdf";

  if (isGemini && (isImage || isPdf)) {
    // Gemini multimodal — inline base64
    const contentParts = [];

    if (text) {
      contentParts.push({ type: "text", text });
    }

    contentParts.push({
      type: "image_url",
      image_url: {
        url: `data:${file.mimeType};base64,${file.base64}`,
      },
    });

    return new HumanMessage({ content: contentParts });
  }

  // Fallback for non-Gemini models — append a text note
  const fileNote = isImage
    ? `\n\n[User attached an image: ${file.name}. You cannot view it — let the user know that image uploads are only supported with the Gemini model.]`
    : isPdf
    ? `\n\n[User attached a PDF: ${file.name}. You cannot read it — let the user know that PDF uploads are only supported with the Gemini model.]`
    : `\n\n[User attached a file: ${file.name}. You cannot read it — let the user know that file uploads are only supported with the Gemini model.]`;

  return new HumanMessage(text + fileNote);
}

export async function generateResponseStream(
  messages,
  modelName = "mistral",
  file = null,
  onToken,
  onDone,
) {
  const selectedModel = getModel(modelName);

  const agent = createReactAgent({
    llm: selectedModel,
    tools: [researchTool, newsTool],
  });

  // Build all messages except the last user message normally
  const allButLast = messages.slice(0, -1);
  const lastMessage = messages[messages.length - 1];

  const formattedMessages = [
    new SystemMessage(SYSTEM_PROMPT),
    ...allButLast.map((msg) =>
      msg.role === "user"
        ? new HumanMessage(msg.content)
        : new AIMessage(msg.content),
    ),
    // Last message — inject file if present
    buildLastHumanMessage(lastMessage.content, file, modelName),
  ];

  let fullText = "";
  let toolWasCalled = false;

  const eventStream = agent.streamEvents(
    { messages: formattedMessages },
    { version: "v2" },
  );

  for await (const event of eventStream) {
    if (event.event === "on_tool_start") {
      toolWasCalled = true;
    }

    if (event.event === "on_chat_model_stream") {
      const chunk = event.data?.chunk;
      const token = extractToken(chunk);
      if (!token) continue;
      const node = event.metadata?.langgraph_node;
      if (!toolWasCalled || node === "agent") {
        fullText += token;
        onToken(token);
      }
    }
  }

  onDone(fullText);
  return fullText;
}

export async function generateChatTitle(message) {
  const response = await mistralModel.invoke([
    new SystemMessage(`
            You are a helpful assistant that generates concise and descriptive titles for chat conversations.
            User will provide you with the first message of a chat conversation, and you will generate a title that captures the essence of the conversation in 2-4 words.
        `),
    new HumanMessage(
      `Generate a title for a chat conversation based on the following first message: "${message}"`,
    ),
  ]);

  return response.text.replace(/\*+/g, "").replace(/"/g, "").trim();
}