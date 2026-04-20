import { initializeSocketConnection } from "../service/chat.socket";
import { sendMessage, getChats, getMessages } from "../service/chat.api";
import { setChats, setCurrentChatId, setError, setLoading, createNewChat, addNewMessage, addMessages } from "../chat.slice";
import { useDispatch } from "react-redux";

export const useChat = () => {
    const dispatch = useDispatch()

    async function handleSendMessage({ message, chatId, model = "mistral" }) {
        try {
            dispatch(setLoading(true))
            const data = await sendMessage({ message, chatId, model })
            const { chat, aiMessage } = data

            if (!chatId) {
                dispatch(createNewChat({
                    chatId: chat._id,
                    title: chat.title,
                }))
            }

            dispatch(addNewMessage({
                chatId: chatId || chat._id,
                content: message,
                role: "user",
            }))
            dispatch(addNewMessage({
                chatId: chatId || chat._id,
                content: aiMessage.content,
                role: aiMessage.role,
            }))
            dispatch(setCurrentChatId(chatId || chat._id))  
        } catch (err) {
            dispatch(setError(err.response?.data?.message || "Failed to send message"))
        } finally {
            dispatch(setLoading(false))
        }
    }

    async function handleGetChats() {
        try {
            dispatch(setLoading(true))
            const data = await getChats()
            const { chats } = data
            dispatch(setChats(chats.reduce((acc, chat) => {
                acc[chat._id] = {
                    id: chat._id,
                    title: chat.title,
                    messages: [],
                    lastUpdated: chat.updatedAt,
                }
                return acc
            }, {})))
        } catch (err) {
            dispatch(setError(err.response?.data?.message || "Failed to get chats"))
        } finally {
            dispatch(setLoading(false))
        }
    }

    async function handleOpenChat(chatId, chats) {
        try {
            if (chats[chatId]?.messages.length === 0) {
                const data = await getMessages(chatId)
                const { messages } = data
                dispatch(addMessages({
                    chatId,
                    messages: messages.map(msg => ({
                        content: msg.content,
                        role: msg.role,
                    }))
                }))
            }
            dispatch(setCurrentChatId(chatId))
        } catch (err) {
            dispatch(setError(err.response?.data?.message || "Failed to open chat"))
        }
    }

    function handleNewChat() {
        dispatch(setCurrentChatId(null))
    }
        

    return {
        initializeSocketConnection,
        handleSendMessage,
        handleGetChats,
        handleOpenChat,
        handleNewChat,
    }
}