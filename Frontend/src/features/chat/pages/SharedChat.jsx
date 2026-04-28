import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getSharedChat } from "../service/chat.api";
import { MessageSquare, FileText, AlertCircle, Clock, ExternalLink } from "lucide-react";

const SharedChat = () => {
    const { token } = useParams();
    const [chatData, setChatData] = useState(null);
    const [messages, setMessages] = useState([]);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const data = await getSharedChat(token);
                setChatData(data.chat);
                setMessages(data.messages);
            } catch (err) {
                const status = err.response?.status;
                if (status === 410) {
                    setError("expired");
                } else if (status === 404) {
                    setError("invalid");
                } else {
                    setError("unknown");
                }
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [token]);

    // Loading
    if (loading) {
        return (
            <main className="min-h-screen w-full bg-white dark:bg-[#07090f] flex items-center justify-center transition-colors duration-200">
                <div className="flex flex-col items-center gap-3 text-zinc-400 dark:text-white/30">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 dark:border-white/20 border-t-[#31b8c6]" />
                    <p className="text-sm">Loading shared chat...</p>
                </div>
            </main>
        );
    }

    // Error states
    if (error) {
        const isExpired = error === "expired";
        return (
            <main className="min-h-screen w-full bg-white dark:bg-[#07090f] flex items-center justify-center p-6 transition-colors duration-200">
                <div className="flex flex-col items-center gap-4 text-center max-w-sm">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10">
                        <AlertCircle size={26} className={isExpired ? "text-yellow-500 dark:text-yellow-400" : "text-red-500 dark:text-red-400"} />
                    </div>
                    <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">
                        {isExpired ? "Link Expired" : "Link Not Found"}
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-white/40">
                        {isExpired
                            ? "This shared chat link has expired. Ask the owner to generate a new one."
                            : "This link is invalid or has been revoked by the owner."}
                    </p>
                    <Link
                        to="/"
                        className="mt-2 flex items-center gap-2 rounded-xl bg-[#31b8c6]/10 border border-[#31b8c6]/20 px-4 py-2 text-sm text-[#31b8c6] hover:bg-[#31b8c6]/20 transition"
                    >
                        Go to Cognivra
                        <ExternalLink size={13} />
                    </Link>
                </div>
            </main>
        );
    }

    // Format expiry
    const expiryText = chatData?.shareExpiry
        ? new Date(chatData.shareExpiry).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
          })
        : null;

    // Main shared chat view
    return (
        <main className="min-h-screen w-full bg-white dark:bg-[#07090f] text-zinc-900 dark:text-white transition-colors duration-200">
            {/* Top accent bar */}
            <div className="h-1 w-full bg-[#31b8c6]" />

            {/* Header */}
            <header className="sticky top-0 z-10 border-b border-zinc-200 dark:border-white/5 bg-white/90 dark:bg-[#07090f]/90 backdrop-blur-sm px-4 py-3 transition-colors duration-200">
                <div className="mx-auto flex max-w-3xl items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-lg font-bold tracking-tight text-[#31b8c6]">
                            Cognivra
                        </span>
                        <span className="hidden sm:block text-zinc-300 dark:text-white/20 text-sm">|</span>
                        <span className="hidden sm:block text-sm text-zinc-400 dark:text-white/40">Shared Chat</span>
                    </div>

                    <div className="flex items-center gap-3">
                        {expiryText && (
                            <div className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-white/30">
                                <Clock size={11} />
                                <span>Expires {expiryText}</span>
                            </div>
                        )}
                        <Link
                            to="/"
                            className="flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 px-3 py-1.5 text-xs text-zinc-500 dark:text-white/50 hover:text-[#31b8c6] hover:border-[#31b8c6]/30 transition"
                        >
                            Open Cognivra
                            <ExternalLink size={11} />
                        </Link>
                    </div>
                </div>
            </header>

            {/* Chat content */}
            <div className="mx-auto max-w-3xl px-4 py-8">
                {/* Chat title + model */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1">
                        {chatData?.title || "Shared Chat"}
                    </h1>
                    <div className="flex items-center gap-3">
                        {chatData?.model && (
                            <span className="text-xs text-zinc-400 dark:text-white/30 capitalize border border-zinc-200 dark:border-white/10 rounded-full px-2.5 py-0.5">
                                {chatData.model}
                            </span>
                        )}
                        <span className="text-xs text-zinc-400 dark:text-white/20">
                            {messages.length} message{messages.length !== 1 ? "s" : ""}
                        </span>
                    </div>
                </div>

                {/* Messages */}
                <div className="space-y-4">
                    {messages.map((message, index) => {
                        const isUser = message.role === "user";
                        return (
                            <div
                                key={index}
                                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                            >
                                <div
                                    className={`max-w-[80%] w-fit rounded-2xl px-4 py-3 text-sm ${
                                        isUser
                                            ? "rounded-br-none bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-white"
                                            : "mr-auto text-zinc-700 dark:text-white/90"
                                    }`}
                                >
                                    {/* File attachment */}
                                    {message.fileUrl && (
                                        <div className="mb-2">
                                            {message.fileMimeType?.startsWith("image/") ? (
                                                <img
                                                    src={message.fileUrl}
                                                    alt={message.fileName}
                                                    className="max-h-48 max-w-xs rounded-xl object-cover"
                                                />
                                            ) : (
                                                <div className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-white/20 bg-zinc-100 dark:bg-white/5 px-3 py-2 text-xs text-zinc-500 dark:text-white/60">
                                                    <FileText size={13} />
                                                    <span className="truncate max-w-[180px]">
                                                        {message.fileName}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {isUser ? (
                                        <p>{message.content}</p>
                                    ) : (
                                        <ReactMarkdown
                                            components={{
                                                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                                ul: ({ children }) => <ul className="mb-2 list-disc pl-5">{children}</ul>,
                                                ol: ({ children }) => <ol className="mb-2 list-decimal pl-5">{children}</ol>,
                                                code: ({ children }) => <code className="rounded bg-zinc-200 dark:bg-white/10 px-1 py-0.5 text-sm">{children}</code>,
                                                pre: ({ children }) => <pre className="mb-2 overflow-x-auto rounded-xl bg-zinc-100 dark:bg-black/30 p-3">{children}</pre>,
                                            }}
                                            remarkPlugins={[remarkGfm]}
                                        >
                                            {message.content}
                                        </ReactMarkdown>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer note */}
                <div className="mt-12 border-t border-zinc-100 dark:border-white/5 pt-6 text-center">
                    <p className="text-xs text-zinc-400 dark:text-white/20">
                        This is a read-only shared conversation from{" "}
                        <Link to="/" className="text-[#31b8c6] hover:underline">
                            Cognivra
                        </Link>
                    </p>
                </div>
            </div>
        </main>
    );
};

export default SharedChat;