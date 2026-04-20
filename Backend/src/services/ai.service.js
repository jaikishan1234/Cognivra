import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatMistralAI } from "@langchain/mistralai";
import { ChatGroq } from "@langchain/groq";
import { ChatCohere } from "@langchain/cohere";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { tool, createAgent } from "langchain";
import * as z from "zod";
import { searchInternet } from "./internet.service.js";

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

// Tool 
const searchInternetTool = tool(
    searchInternet,
    {
        name: "searchInternet",
        description: "Use this tool to get the latest information from the internet.",
        schema: z.object({
            query: z.string().describe("The search query to look up on the internet.")
        })
    }
);

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
    If the question requires up-to-date information, use the "searchInternet" tool to get the latest information from the internet and then answer based on the search results.
`;

// Main functions 
export async function generateResponse(messages, modelName = "mistral") {
    const selectedModel = getModel(modelName);

    const agent = createAgent({
        model: selectedModel,
        tools: [searchInternetTool],
    });

    const response = await agent.invoke({
        messages: [
            new SystemMessage(SYSTEM_PROMPT),
            ...messages.map(msg =>
                msg.role === "user"
                    ? new HumanMessage(msg.content)
                    : new AIMessage(msg.content)
            )
        ]
    });

    return response.messages[response.messages.length - 1].text;
}

export async function generateChatTitle(message) {
    const response = await mistralModel.invoke([
        new SystemMessage(`
            You are a helpful assistant that generates concise and descriptive titles for chat conversations.
            User will provide you with the first message of a chat conversation, and you will generate a title that captures the essence of the conversation in 2-4 words.
        `),
        new HumanMessage(`Generate a title for a chat conversation based on the following first message: "${message}"`)
    ]);

    return response.text.replace(/\*+/g, '').trim()
}