import { createSlice } from '@reduxjs/toolkit';

const chatSlice = createSlice({
    name: 'chat',
    initialState: {
        chats: {},
        currentChatId: null,
        isLoading: false,
        isStreaming: false,
        pendingMessage: null, // new — stores message for new chats
        error: null,
    },
    reducers: {
        createNewChat: (state, action) => {
            const { chatId, title } = action.payload;
            state.chats[chatId] = {
                id: chatId,
                title,
                messages: [],
                lastUpdated: new Date().toISOString(),
            };
        },
        addNewMessage: (state, action) => {
            const { chatId, content, role } = action.payload;
            state.chats[chatId].messages.push({ content, role });
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
        // Store pending message for new chats
        setPendingMessage: (state, action) => {
            state.pendingMessage = action.payload;
        },
        // Clear pending message after it's been added
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
} = chatSlice.actions;

export default chatSlice.reducer;