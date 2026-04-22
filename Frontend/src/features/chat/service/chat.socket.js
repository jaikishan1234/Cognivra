import { io } from "socket.io-client";
import { store } from "../../../app/app.store";
import {
    createNewChat,
    startStreamingMessage,
    appendToken,
    stopStreaming,
    setError,
    addNewMessage,
    clearPendingMessage,
} from "../chat.slice.js";
import { setCurrentChatId } from "../chat.slice.js";

let socket = null;

// Initialize socket connection and join user room
export const initializeSocketConnection = (userId) => {
    // Prevent duplicate connections
    if (socket) return socket;

    socket = io("http://localhost:3000", {
        withCredentials: true,
    });

    socket.on("connect", () => {
        console.log("Connected to Socket.IO server");
        socket.emit("joinRoom", userId);
    });

    // New chat created — add to Redux and add pending user message
    socket.on("newChat", ({ chatId, title, model }) => {
        const id = chatId.toString();

        store.dispatch(createNewChat({ chatId: id, title }));
        store.dispatch(setCurrentChatId(id));

        // Get pending message from Redux and add it to new chat
        const pendingMessage = store.getState().chat.pendingMessage;
        if (pendingMessage) {
            store.dispatch(addNewMessage({
                chatId: id,
                content: pendingMessage,
                role: "user",
            }));
            store.dispatch(clearPendingMessage());
        }
    });

    // Streaming starting — add empty AI message placeholder
    socket.on("streamStart", ({ chatId }) => {
        store.dispatch(startStreamingMessage({ chatId: chatId.toString() }));
    });

    // Each token — append to last AI message
    socket.on("streamToken", ({ token, chatId }) => {
        store.dispatch(appendToken({ chatId: chatId.toString(), token }));
    });

    // Streaming done
    socket.on("streamEnd", ({ chatId }) => {
        store.dispatch(stopStreaming());
    });

    // Something went wrong
    socket.on("streamError", ({ message }) => {
        store.dispatch(stopStreaming());
        store.dispatch(setError(message));
    });

    socket.on("disconnect", () => {
        console.log("Disconnected from Socket.IO server");
    });

    return socket;
};

// Send message via socket
export const sendMessageViaSocket = (data) => {
    if (socket) {
        socket.emit("sendMessage", data);
    }
};

// Get socket instance
export const getSocket = () => socket;