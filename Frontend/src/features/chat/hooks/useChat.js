import { initializeSocketConnection, sendMessageViaSocket } from "../service/chat.socket";
import { getChats, getMessages } from "../service/chat.api";
import { setChats, setCurrentChatId, setError, setLoading, createNewChat, addNewMessage, addMessages, setPendingMessage } from "../chat.slice.js";
import { useDispatch, useSelector } from "react-redux";

export const useChat = () => {
    const dispatch = useDispatch();
    const user = useSelector((state) => state.auth.user);

    // Initialize socket and join user room
    function handleInitializeSocket() {
        if (user?._id) {
            initializeSocketConnection(user._id);
        }
    }

    function handleSendMessage({ message, chatId, model = "mistral" }) {
        if (!user?._id) return;

        if (chatId) {
            // Existing chat — add user message to Redux immediately
            dispatch(addNewMessage({
                chatId,
                content: message,
                role: "user",
            }));
        } else {
            // New chat — store message as pending until newChat event fires
            dispatch(setPendingMessage(message));
        }

        // Send to backend via socket
        sendMessageViaSocket({
            message,
            chatId: chatId || null,
            model,
            userId: user._id,
        });
    }

    async function handleGetChats() {
        try {
            dispatch(setLoading(true));
            const data = await getChats();
            const { chats } = data;
            dispatch(setChats(chats.reduce((acc, chat) => {
                acc[chat._id] = {
                    id: chat._id,
                    title: chat.title,
                    messages: [],
                    lastUpdated: chat.updatedAt,
                }
                return acc;
            }, {})));
        } catch (err) {
            dispatch(setError(err.response?.data?.message || "Failed to get chats"));
        } finally {
            dispatch(setLoading(false));
        }
    }

    async function handleOpenChat(chatId, chats) {
        try {
            if (chats[chatId]?.messages.length === 0) {
                const data = await getMessages(chatId);
                const { messages } = data;
                dispatch(addMessages({
                    chatId,
                    messages: messages.map(msg => ({
                        content: msg.content,
                        role: msg.role,
                    }))
                }));
            }
            dispatch(setCurrentChatId(chatId));
        } catch (err) {
            dispatch(setError(err.response?.data?.message || "Failed to open chat"));
        }
    }

    function handleNewChat() {
        dispatch(setCurrentChatId(null));
    }

    return {
        handleInitializeSocket,
        handleSendMessage,
        handleGetChats,
        handleOpenChat,
        handleNewChat,
    }
}