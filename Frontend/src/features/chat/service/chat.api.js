import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials: true,
})

export const sendMessage = async ({ message, chatId, model = "mistral" }) => {
    const response = await api.post("/api/chats/message", { message, chat: chatId, model })
    return response.data
}

export const getChats = async () => {
    const response = await api.get("/api/chats")
    return response.data
}

export const getMessages = async (chatId) => {
    const response = await api.get(`/api/chats/${chatId}/messages`)
    return response.data
}

export const deleteChat = async (chatId) => {
    const response = await api.delete(`/api/chats/delete/${chatId}`)
    return response.data
}

// ── Share a chat ──
export const shareChat = async (chatId, expiryDays) => {
    const response = await api.post(`/api/chats/${chatId}/share`, { expiryDays })
    return response.data
}

// ── Revoke a share link ──
export const revokeShare = async (chatId) => {
    const response = await api.post(`/api/chats/${chatId}/revoke`)
    return response.data
}

// ── Get a shared chat (public — no auth cookie needed) ──
export const getSharedChat = async (token) => {
    const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/chats/shared/${token}`)
    return response.data
}