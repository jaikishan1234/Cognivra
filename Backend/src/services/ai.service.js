import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatMistralAI } from "@langchain/mistralai";
import { ChatGroq } from "@langchain/groq";
import { ChatCohere } from "@langchain/cohere";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tavily } from "@tavily/core";
import * as z from "zod";

// Tavily client
const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY });

// Research tool — deep web search with sources
const researchTool = tool(
    async ({ topic }) => {
        const response = await tavilyClient.search(topic, {
            searchDepth: "advanced",
            includeAnswer: true,
            maxResults: 5,
        });

        const sources = response.results.map((r, i) =>
            `[${i + 1}] ${r.title} — ${r.url}\n    ${r.content}`
        ).join("\n\n");

        return `SUMMARY:\n${response.answer}\n\nSOURCES:\n${sources}`;
    },
    {
        name: "researchTool",
        description: "Research any topic on the web and get a summarized answer with sources.",
        schema: z.object({
            topic: z.string().describe("The topic to research"),
        })
    }
);

// News tool — latest news from past 3 days
const newsTool = tool(
    async ({ topic }) => {
        const response = await tavilyClient.search(topic, {
            topic: "news",
            days: 3,
            includeAnswer: true,
            maxResults: 5,
        });

        const articles = response.results.map((r, i) =>
            `[${i + 1}] ${r.title}\n    ${r.url}\n    ${r.content}`
        ).join("\n\n");

        return `LATEST NEWS ON: "${topic}"\n\n${articles}`;
    },
    {
        name: "newsTool",
        description: "Get the latest news from the past 3 days on any topic.",
        schema: z.object({
            topic: z.string().describe("The news topic to search for"),
        })
    }
);

// Models
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

const cohereModel = new ChatCohere({
    model: "command-r-plus-08-2024",
    apiKey: process.env.COHERE_API_KEY,
});

// Model selector
function getModel(modelName) {
    switch (modelName) {
        case "gemini":  return geminiModel;
        case "groq":    return groqModel;
        case "cohere":  return cohereModel;
        case "mistral":
        default:        return mistralModel;
    }
}

// System prompt
const SYSTEM_PROMPT = `
    You are a helpful and precise assistant for answering questions.
    If you don't know the answer, say you don't know.
    If the question requires up-to-date information, use the researchTool or newsTool to get the latest information from the internet and then answer based on the search results.
`;

/*
    Streaming function
    - Uses createReactAgent with researchTool + newsTool
    - Streams tokens via .streamEvents()
    - Calls onToken() for each token received
    - Calls onDone() when streaming is complete
    - Returns full response text at the end
*/
export async function generateResponseStream(messages, modelName = "mistral", onToken, onDone) {
    const selectedModel = getModel(modelName);

    // Create agent with tools
    const agent = createReactAgent({
        llm: selectedModel,
        tools: [researchTool, newsTool],
    });

    // Format messages
    const formattedMessages = [
        new SystemMessage(SYSTEM_PROMPT),
        ...messages.map(msg =>
            msg.role === "user"
                ? new HumanMessage(msg.content)
                : new AIMessage(msg.content)
        )
    ];

    let fullText = "";

    // streamEvents gives us fine-grained control over what to emit
    const eventStream = agent.streamEvents(
        { messages: formattedMessages },
        { version: "v2" }
    );

    for await (const event of eventStream) {
        // Only grab final answer tokens — ignore tool call chunks
        if (
            event.event === "on_chat_model_stream" &&
            event.metadata?.langgraph_node === "agent" &&
            event.data?.chunk?.content
        ) {
            const token = event.data.chunk.content;
            fullText += token;
            onToken(token); // emit token to socket
        }
    }

    onDone(fullText); // called when streaming is complete
    return fullText;
}

// Title generator — uses mistral directly, no agent needed
export async function generateChatTitle(message) {
    const response = await mistralModel.invoke([
        new SystemMessage(`
            You are a helpful assistant that generates concise and descriptive titles for chat conversations.
            User will provide you with the first message of a chat conversation, and you will generate a title that captures the essence of the conversation in 2-4 words.
        `),
        new HumanMessage(`Generate a title for a chat conversation based on the following first message: "${message}"`)
    ]);

    // Strip markdown, quotes, and extra whitespace
    return response.text.replace(/\*+/g, '').replace(/"/g, '').trim();
}