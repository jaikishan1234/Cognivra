import { generateChatTitle } from "../services/ai.service.js";
import chatModel from "../models/chat.model.js"
import messageModel from "../models/message.model.js";
import crypto from "crypto";

export async function sendMessage(req, res) {
    try {
        const { message, chat: chatId, model = "mistral" } = req.body;

        let title = null, chat = null;

        if (!chatId) {
            title = await generateChatTitle(message);
            chat = await chatModel.create({
                user: req.user.id,
                title,
                model
            });
        }

        const userMessage = await messageModel.create({
            chat: chatId || chat._id,
            content: message,
            role: "user"
        });

        const messages = await messageModel.find({ chat: chatId || chat._id });

        const result = await generateResponse(messages, model);

        const aiMessage = await messageModel.create({
            chat: chatId || chat._id,
            content: result,
            role: "ai"
        });

        res.status(201).json({ title, chat, aiMessage });

    } catch (err) {
        res.status(500).json({
            message: "Something went wrong",
            success: false,
            err: err.message
        });
    }
}

export async function getChats(req, res) {
    const user = req.user

    // Sort by updatedAt descending — latest chats on top
    const chats = await chatModel.find({ user: user.id }).sort({ updatedAt: -1 })

    res.status(200).json({
        message: "Chats retrieved successfully",
        chats
    })
}

export async function getMessages(req, res) {
    const { chatId } = req.params;

    const chat = await chatModel.findOne({
        _id: chatId,
        user: req.user.id
    })

    if (!chat) {
        return res.status(404).json({
            message: "Chat not found"
        })
    }

    const messages = await messageModel.find({ chat: chatId })

    res.status(200).json({
        message: "Messages retrieved successfully",
        messages
    })
}

export async function deleteChat(req, res) {
    const { chatId } = req.params;

    const chat = await chatModel.findOneAndDelete({
        _id: chatId,
        user: req.user.id
    })

    await messageModel.deleteMany({ chat: chatId })

    if (!chat) {
        return res.status(404).json({
            message: "Chat not found"
        })
    }

    res.status(200).json({
        message: "Chat deleted successfully"
    })
}

// ── Share a chat ──
// POST /api/chats/:chatId/share
// Body: { expiryDays: 1 | 7 | 30 }
export async function shareChat(req, res) {
    try {
        const { chatId } = req.params;
        const { expiryDays = 7 } = req.body;

        const chat = await chatModel.findOne({ _id: chatId, user: req.user.id });

        if (!chat) {
            return res.status(404).json({ message: "Chat not found" });
        }

        // Generate a secure random token
        const token = crypto.randomBytes(32).toString("hex");

        // Calculate expiry date
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + Number(expiryDays));

        chat.shareToken = token;
        chat.shareExpiry = expiry;
        chat.shareActive = true;
        await chat.save();

        res.status(200).json({
            message: "Chat shared successfully",
            shareToken: token,
            shareExpiry: expiry,
        });

    } catch (err) {
        res.status(500).json({ message: "Failed to share chat", err: err.message });
    }
}

// ── Revoke a share link ──
// POST /api/chats/:chatId/revoke
export async function revokeShare(req, res) {
    try {
        const { chatId } = req.params;

        const chat = await chatModel.findOne({ _id: chatId, user: req.user.id });

        if (!chat) {
            return res.status(404).json({ message: "Chat not found" });
        }

        chat.shareActive = false;
        chat.shareToken = null;
        chat.shareExpiry = null;
        await chat.save();

        res.status(200).json({ message: "Share link revoked successfully" });

    } catch (err) {
        res.status(500).json({ message: "Failed to revoke share", err: err.message });
    }
}

// ── Get a shared chat (public — no auth required) ──
// GET /api/chats/shared/:token
export async function getSharedChat(req, res) {
    try {
        const { token } = req.params;

        const chat = await chatModel.findOne({
            shareToken: token,
            shareActive: true,
        });

        if (!chat) {
            return res.status(404).json({ message: "Share link is invalid or has been revoked" });
        }

        // Check expiry
        if (chat.shareExpiry && new Date() > chat.shareExpiry) {
            return res.status(410).json({ message: "This share link has expired" });
        }

        const messages = await messageModel.find({ chat: chat._id });

        res.status(200).json({
            message: "Shared chat retrieved successfully",
            chat: {
                title: chat.title,
                model: chat.model,
                shareExpiry: chat.shareExpiry,
            },
            messages,
        });

    } catch (err) {
        res.status(500).json({ message: "Failed to retrieve shared chat", err: err.message });
    }
}