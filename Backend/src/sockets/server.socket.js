import { Server } from "socket.io";
import { generateResponseStream } from "../services/ai.service.js";
import { generateChatTitle } from "../services/ai.service.js";
import chatModel from "../models/chat.model.js";
import messageModel from "../models/message.model.js";

let io;

export function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: "http://localhost:5173",
            credentials: true,
        }
    });

    console.log("Socket.io server is RUNNING");

    io.on("connection", (socket) => {
        console.log("A user connected: " + socket.id);

        // User joins their own room using userId
        socket.on("joinRoom", (userId) => {
            socket.join(userId);
            console.log(`User ${userId} joined room`);
        });

        // Handle incoming chat message
        socket.on("sendMessage", async (data) => {
            const { message, chatId, model = "mistral", userId } = data;

            try {
                let chat = null;
                let title = null;

                // If no chatId, create a new chat with title
                if (!chatId) {
                    title = await generateChatTitle(message);
                    chat = await chatModel.create({
                        user: userId,
                        title,
                        model
                    });

                    // Tell frontend a new chat was created
                    io.to(userId).emit("newChat", {
                        chatId: chat._id,
                        title,
                        model
                    });
                }

                const resolvedChatId = chatId || chat._id;

                // Save user message to DB
                await messageModel.create({
                    chat: resolvedChatId,
                    content: message,
                    role: "user"
                });

                // Get all messages for context
                const messages = await messageModel.find({ chat: resolvedChatId });

                // Tell frontend streaming is starting
                io.to(userId).emit("streamStart", { chatId: resolvedChatId });

                // Stream tokens one by one to frontend
                await generateResponseStream(
                    messages,
                    model,
                    // onToken — called for each token
                    (token) => {
                        io.to(userId).emit("streamToken", { token, chatId: resolvedChatId });
                    },
                    // onDone — called when streaming is complete
                    async (fullText) => {
                        // Save full AI response to DB
                        const aiMessage = await messageModel.create({
                            chat: resolvedChatId,
                            content: fullText,
                            role: "ai"
                        });

                        // Tell frontend streaming is done
                        io.to(userId).emit("streamEnd", {
                            chatId: resolvedChatId,
                            aiMessage
                        });
                    }
                );

            } catch (err) {
                console.error("Socket sendMessage error:", err.message);

                // Tell frontend something went wrong
                io.to(userId).emit("streamError", {
                    message: "Something went wrong",
                    error: err.message
                });
            }
        });

        socket.on("disconnect", () => {
            console.log("User disconnected: " + socket.id);
        });
    });
}

export function getIO() {
    if (!io) {
        throw new Error("Socket.io not initialized");
    }
    return io;
}