import { initializeSocketConnection, sendMessageViaSocket } from "../service/chat.socket";
import { getChats, getMessages, deleteChat } from "../service/chat.api";
import { setChats, setCurrentChatId, setError, setLoading, createNewChat, addNewMessage, addMessages, setPendingMessage, removeChat } from "../chat.slice.js";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";

export const useChat = () => {
    const dispatch = useDispatch();
    const user = useSelector((state) => state.auth.user);

    function handleInitializeSocket() {
        if (user?._id) {
            initializeSocketConnection(user._id);
        }
    }

    function handleSendMessage({ message, chatId, model = "mistral", file = null }) {
        if (!user?._id) return;

        if (chatId) {
            dispatch(addNewMessage({
                chatId,
                content: message,
                role: "user",
                file,
            }));
        } else {
            dispatch(setPendingMessage({ text: message, file }));
        }

        sendMessageViaSocket({
            message,
            chatId: chatId || null,
            model,
            userId: user._id,
            file,
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
                    model: chat.model || null,
                    messages: [],
                    lastUpdated: chat.updatedAt,
                }
                return acc;
            }, {})));
        } catch (err) {
            const message = err.response?.data?.message || "Failed to load chats";
            dispatch(setError(message));
            toast.error(message);
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
                        file: msg.fileUrl ? {
                            base64: null,
                            mimeType: msg.fileMimeType,
                            name: msg.fileName,
                            previewUrl: msg.fileUrl,
                        } : null,
                    }))
                }));
            }
        } catch (err) {
            const message = err.response?.data?.message || "Failed to open chat";
            dispatch(setError(message));
            toast.error(message);
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
            toast.success("Chat deleted");
        } catch (err) {
            const message = err.response?.data?.message || "Failed to delete chat";
            dispatch(setError(message));
            toast.error(message);
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