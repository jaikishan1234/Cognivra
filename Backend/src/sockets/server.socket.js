import { Server } from "socket.io";
import { generateResponseStream } from "../services/ai.service.js";
import { generateChatTitle } from "../services/ai.service.js";
import chatModel from "../models/chat.model.js";
import messageModel from "../models/message.model.js";
import { uploadToCloudinary } from "../services/cloudinary.service.js";

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

        socket.on("joinRoom", (userId) => {
            socket.join(userId);
            console.log(`User ${userId} joined room`);
        });

        socket.on("sendMessage", async (data) => {
            const { message, chatId, model = "mistral", userId, file = null } = data;

            try {
                let chat = null;
                let title = null;

                if (!chatId) {
                    title = await generateChatTitle(message);
                    chat = await chatModel.create({
                        user: userId,
                        title,
                        model
                    });

                    io.to(userId).emit("newChat", {
                        chatId: chat._id,
                        title,
                        model
                    });
                }

                const resolvedChatId = chatId || chat._id;

                let fileUrl = null;
                let fileName = null;
                let fileMimeType = null;

                if (file) {
                    const uploaded = await uploadToCloudinary(file.base64, file.mimeType, file.name);
                    fileUrl = uploaded.url;
                    fileName = file.name;
                    fileMimeType = file.mimeType;
                }

                await messageModel.create({
                    chat: resolvedChatId,
                    content: message,
                    role: "user",
                    fileUrl,
                    fileName,
                    fileMimeType,
                });

                const messages = await messageModel.find({ chat: resolvedChatId });

                io.to(userId).emit("streamStart", { chatId: resolvedChatId });

                await generateResponseStream(
                    messages,
                    model,
                    file,
                    (token) => {
                        io.to(userId).emit("streamToken", { token, chatId: resolvedChatId });
                    },
                    async (fullText) => {
                        // Guard — never save empty content to DB
                        if (!fullText || fullText.trim() === "") {
                            console.error("generateResponseStream returned empty text — skipping DB save");
                            io.to(userId).emit("streamError", {
                                message: "AI returned an empty response. Please try again.",
                            });
                            return;
                        }

                        const aiMessage = await messageModel.create({
                            chat: resolvedChatId,
                            content: fullText,
                            role: "ai"
                        });

                        io.to(userId).emit("streamEnd", {
                            chatId: resolvedChatId,
                            aiMessage
                        });
                    }
                );

            } catch (err) {
                console.error("Socket sendMessage error:", err.message);

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