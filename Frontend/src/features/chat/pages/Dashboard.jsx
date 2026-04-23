import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useSelector } from "react-redux";
import { useChat } from "../hooks/useChat";
import remarkGfm from "remark-gfm";
import { useAuth } from "../../auth/hook/useAuth";
import {
  Plus,
  Mic,
  ArrowUp,
  ChevronDown,
  MessageSquare,
  LogOut,
  Trash2,
} from "lucide-react";

const MODELS = [
  { value: "mistral", label: "Mistral" },
  { value: "gemini", label: "Gemini" },
  { value: "groq", label: "Groq" },
  { value: "deepseek", label: "DeepSeek" },
];

const Dashboard = () => {
  const chat = useChat();
  const [chatInput, setChatInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("mistral");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const chats = useSelector((state) => state.chat.chats);
  const currentChatId = useSelector((state) => state.chat.currentChatId);
  const isStreaming = useSelector((state) => state.chat.isStreaming);
  const messagesEndRef = useRef(null);
  const modelDropdownRef = useRef(null);
  const auth = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const user = useSelector((state) => state.auth.user);
  const isLoading = useSelector((state) => state.chat.isLoading);

  useEffect(() => {
    chat.handleInitializeSocket();
    chat.handleGetChats();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, currentChatId]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        modelDropdownRef.current &&
        !modelDropdownRef.current.contains(e.target)
      ) {
        setModelDropdownOpen(false);
      }
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(e.target)
      ) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmitMessage = (e) => {
    e?.preventDefault();
    const trimmedMessage = chatInput.trim();
    if (!trimmedMessage || isStreaming) return;
    chat.handleSendMessage({
      message: trimmedMessage,
      chatId: currentChatId,
      model: selectedModel,
    });
    setChatInput("");
  };

  return (
    <main className="min-h-screen w-full bg-[#07090f] p-3 text-white md:p-5">
      <section className="mx-auto flex h-[calc(100vh-1.5rem)] w-full gap-4 md:h-[calc(100vh-2.5rem)] md:gap-6">
        {/* Sidebar */}
        <aside className="hidden h-full w-72 shrink-0 rounded-3xl bg-[#080b12] p-4 md:flex md:flex-col">
          <h1 className="mb-5 text-2xl font-bold tracking-tight text-white">
            Cognivra
          </h1>

          <button
            onClick={() => chat.handleNewChat()}
            className="mb-4 flex items-center justify-center gap-2 w-full rounded-xl border border-white/20 py-2 text-sm text-white/60 hover:text-white hover:border-white/40 transition"
          >
            <Plus size={15} />
            New Chat
          </button>

          <div className="flex-1 space-y-1 overflow-y-auto">
            {Object.values(chats).map((c, index) => (
              <div
                key={index}
                className={`group flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition
                  ${
                    currentChatId === c.id
                      ? "bg-white/10 text-white"
                      : "text-white/50 hover:bg-white/5 hover:text-white"
                  }`}
              >
                {/* Chat button — takes all available space */}
                <button
                  onClick={() => chat.handleOpenChat(c.id, chats)}
                  type="button"
                  className="flex flex-1 items-center gap-2 min-w-0 text-left cursor-pointer"
                >
                  <MessageSquare size={14} className="shrink-0 opacity-60" />
                  <span className="truncate flex-1">{c.title}</span>
                </button>

                {/* Trash icon — only visible on hover */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    chat.handleDeleteChat(c.id);
                  }}
                  className="shrink-0 opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Profile card at bottom of sidebar */}
          <div className="relative mt-auto" ref={profileMenuRef}>
            {profileMenuOpen && (
              <div className="absolute bottom-14 left-0 right-0 rounded-xl border border-white/10 bg-[#0e1117] overflow-hidden shadow-xl">
                <button
                  onClick={() => {
                    auth.handleLogout();
                    setProfileMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 transition"
                >
                  <LogOut size={14} />
                  Logout
                </button>
              </div>
            )}

            <button
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 transition rounded-lg"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white uppercase">
                {user?.username?.[0] || "U"}
              </div>
              <div className="flex flex-col items-start min-w-0">
                <span className="truncate text-sm font-medium text-white/80">
                  {user?.username || "User"}
                </span>
                <span className="text-xs text-white/30">Free Plan</span>
              </div>
              <ChevronDown
                size={13}
                className={`ml-auto shrink-0 text-white/30 transition-transform ${profileMenuOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>
        </aside>

        {/* Main chat area */}
        <section className="relative mx-auto flex h-full min-w-0 flex-1 flex-col">
          {/* Messages */}
          <div className="flex-1 flex flex-col overflow-y-auto pb-40 pt-4 px-2 space-y-4">
            {!currentChatId && (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-white/30 h-full">
                <MessageSquare size={48} strokeWidth={1} />
                <p className="text-lg">Ask anything to get started</p>
              </div>
            )}

            {isLoading && currentChatId && (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-white/30 h-full">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
                <p className="text-sm">Loading messages...</p>
              </div>
            )}

            {chats[currentChatId]?.messages.map((message, index) => (
              <div
                key={index}
                className={`max-w-[80%] w-fit rounded-2xl px-4 py-3 text-sm md:text-base ${
                  message.role === "user"
                    ? "ml-auto rounded-br-none bg-white/10 text-white"
                    : "mr-auto text-white/90"
                }`}
              >
                {message.role === "user" ? (
                  <p>{message.content}</p>
                ) : (
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => (
                        <p className="mb-2 last:mb-0">{children}</p>
                      ),
                      ul: ({ children }) => (
                        <ul className="mb-2 list-disc pl-5">{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="mb-2 list-decimal pl-5">{children}</ol>
                      ),
                      code: ({ children }) => (
                        <code className="rounded bg-white/10 px-1 py-0.5 text-sm">
                          {children}
                        </code>
                      ),
                      pre: ({ children }) => (
                        <pre className="mb-2 overflow-x-auto rounded-xl bg-black/30 p-3">
                          {children}
                        </pre>
                      ),
                    }}
                    remarkPlugins={[remarkGfm]}
                  >
                    {message.content}
                  </ReactMarkdown>
                )}
              </div>
            ))}

            {isStreaming && (
              <div className="mr-auto flex gap-1 px-4 py-3">
                <span className="h-2 w-2 animate-bounce rounded-full bg-white/40 [animation-delay:0ms]"></span>
                <span className="h-2 w-2 animate-bounce rounded-full bg-white/40 [animation-delay:150ms]"></span>
                <span className="h-2 w-2 animate-bounce rounded-full bg-white/40 [animation-delay:300ms]"></span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input footer */}
          <div className="absolute bottom-2 left-0 right-0 px-2">
            <div className="rounded-2xl border border-white/15 bg-[#0e1117] p-3 shadow-xl">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmitMessage(e)}
                placeholder="Ask anything..."
                className="w-full bg-transparent px-2 py-2 text-base text-white outline-none placeholder:text-white/25"
              />

              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white/50 hover:text-white hover:border-white/50 transition"
                  >
                    <Plus size={15} />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative" ref={modelDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                      className="flex items-center gap-1.5 rounded-full border border-white/20 bg-transparent px-3 py-1.5 text-sm text-white/70 hover:text-white hover:border-white/40 transition"
                    >
                      {MODELS.find((m) => m.value === selectedModel)?.label}
                      <ChevronDown
                        size={13}
                        className={`transition-transform ${modelDropdownOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    {modelDropdownOpen && (
                      <div className="absolute bottom-10 right-0 z-10 w-36 rounded-xl border border-white/15 bg-[#0e1117] py-1 shadow-xl">
                        {MODELS.map((model) => (
                          <button
                            key={model.value}
                            type="button"
                            onClick={() => {
                              setSelectedModel(model.value);
                              setModelDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-2 text-left text-sm transition hover:bg-white/10
                              ${selectedModel === model.value ? "text-[#31b8c6]" : "text-white/60 hover:text-white"}`}
                          >
                            {model.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {!chatInput.trim() && (
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white/50 hover:text-white hover:border-white/50 transition"
                    >
                      <Mic size={15} />
                    </button>
                  )}

                  {chatInput.trim() && (
                    <button
                      type="button"
                      onClick={handleSubmitMessage}
                      disabled={isStreaming}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/80 disabled:opacity-25 disabled:cursor-not-allowed"
                    >
                      <ArrowUp size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
};

export default Dashboard;