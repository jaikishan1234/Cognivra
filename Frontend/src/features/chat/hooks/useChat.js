import { initializeSocketConnection, sendMessageViaSocket } from "../service/chat.socket";
import { getChats, getMessages, deleteChat } from "../service/chat.api";
import { setChats, setCurrentChatId, setError, setLoading, createNewChat, addNewMessage, addMessages, setPendingMessage, removeChat } from "../chat.slice.js";
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
            dispatch(addNewMessage({
                chatId,
                content: message,
                role: "user",
            }));
        } else {
            dispatch(setPendingMessage(message));
        }

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
            dispatch(setCurrentChatId(chatId));
            if (chats[chatId]?.messages.length === 0) {
                dispatch(setLoading(true));
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
        } catch (err) {
            dispatch(setError(err.response?.data?.message || "Failed to open chat"));
        } finally {
            dispatch(setLoading(false));
        }
    }

    function handleNewChat() {
        dispatch(setCurrentChatId(null));
    }

    async function handleDeleteChat(chatId) {
        try {
            await deleteChat(chatId);
            dispatch(removeChat(chatId));
        } catch (err) {
            dispatch(setError(err.response?.data?.message || "Failed to delete chat"));
        }
    }

    return {
        handleInitializeSocket,
        handleSendMessage,
        handleGetChats,
        handleOpenChat,
        handleNewChat,
        handleDeleteChat,
    }
}