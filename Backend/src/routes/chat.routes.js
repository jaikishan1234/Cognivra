import { Router } from 'express';
import {
    sendMessage,
    getChats,
    getMessages,
    deleteChat,
    shareChat,
    revokeShare,
    getSharedChat,
} from "../controllers/chat.controller.js";
import { authUser } from "../middleware/auth.middleware.js";

const chatRouter = Router();

// Existing routes
chatRouter.post("/message", authUser, sendMessage)
chatRouter.get("/", authUser, getChats)
chatRouter.get("/:chatId/messages", authUser, getMessages)
chatRouter.delete("/delete/:chatId", authUser, deleteChat)

// Share routes — IMPORTANT: /shared/:token must come before /:chatId/messages
// to avoid Express treating "shared" as a chatId
chatRouter.get("/shared/:token", getSharedChat)           // public — no auth
chatRouter.post("/:chatId/share", authUser, shareChat)    // authenticated
chatRouter.post("/:chatId/revoke", authUser, revokeShare) // authenticated

export default chatRouter;