import { createSlice } from '@reduxjs/toolkit';

const chatSlice = createSlice({
    name: 'chat',
    initialState: {
        chats: {},
        currentChatId: null,
        isLoading: false,
        isStreaming: false,
        pendingMessage: null,
        error: null,
    },
    reducers: {
        createNewChat: (state, action) => {
            const { chatId, title, model } = action.payload;
            state.chats[chatId] = {
                id: chatId,
                title,
                model: model || null,
                messages: [],
                lastUpdated: new Date().toISOString(),
            };
        },
        addNewMessage: (state, action) => {
            const { chatId, content, role, file = null } = action.payload;
            state.chats[chatId].messages.push({ content, role, file });
        },
        addMessages: (state, action) => {
            const { chatId, messages } = action.payload;
            state.chats[chatId].messages.push(...messages);
        },
        setChats: (state, action) => {
            state.chats = action.payload;
        },
        setCurrentChatId: (state, action) => {
            state.currentChatId = action.payload;
        },
        setLoading: (state, action) => {
            state.isLoading = action.payload;
        },
        setError: (state, action) => {
            state.error = action.payload;
        },
        setPendingMessage: (state, action) => {
            // Accepts either a plain string (legacy) or { text, file } object
            state.pendingMessage = action.payload;
        },
        clearPendingMessage: (state) => {
            state.pendingMessage = null;
        },
        startStreamingMessage: (state, action) => {
            const { chatId } = action.payload;
            state.isStreaming = true;
            if (state.chats[chatId]) {
                state.chats[chatId].messages.push({
                    role: "ai",
                    content: "",
                });
            }
        },
        appendToken: (state, action) => {
            const { chatId, token } = action.payload;
            if (state.chats[chatId]) {
                const messages = state.chats[chatId].messages;
                const lastMessage = messages[messages.length - 1];
                if (lastMessage && lastMessage.role === "ai") {
                    lastMessage.content += token;
                }
            }
        },
        stopStreaming: (state) => {
            state.isStreaming = false;
        },
        removeChat: (state, action) => {
            const chatId = action.payload;
            delete state.chats[chatId];
            if (state.currentChatId === chatId) {
                state.currentChatId = null;
            }
        },
    }
});

export const {
    setChats,
    setCurrentChatId,
    setLoading,
    setError,
    createNewChat,
    addNewMessage,
    addMessages,
    startStreamingMessage,
    appendToken,
    stopStreaming,
    setPendingMessage,
    clearPendingMessage,
    removeChat,
} = chatSlice.actions;

export default chatSlice.reducer;