import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useSelector } from "react-redux";
import { useChat } from "../hooks/useChat";
import remarkGfm from "remark-gfm";
import { useAuth } from "../../auth/hook/useAuth";
import { usePdfExport } from "../hooks/usePdfExport";
import {
  Plus,
  Mic,
  ArrowUp,
  ChevronDown,
  MessageSquare,
  LogOut,
  Trash2,
  X,
  FileText,
  Search,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Download,
  EyeOff,
  Eye,
  ChevronRight,
} from "lucide-react";

const MODELS = [
  { value: "mistral", label: "Mistral" },
  { value: "gemini", label: "Gemini" },
  { value: "groq", label: "Groq" },
  { value: "deepseek", label: "DeepSeek" },
];

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const MAX_FILE_SIZE_MB = 10;

// Load hidden chat IDs from localStorage
const loadHiddenChats = () => {
  try {
    const stored = localStorage.getItem("cognivra_hidden_chats");
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
};

// Save hidden chat IDs to localStorage
const saveHiddenChats = (hiddenSet) => {
  localStorage.setItem(
    "cognivra_hidden_chats",
    JSON.stringify([...hiddenSet])
  );
};

const Dashboard = () => {
  const chat = useChat();
  const chats = useSelector((state) => state.chat.chats);
  const currentChatId = useSelector((state) => state.chat.currentChatId);
  const isStreaming = useSelector((state) => state.chat.isStreaming);
  const isLoading = useSelector((state) => state.chat.isLoading);
  const user = useSelector((state) => state.auth.user);
  const auth = useAuth();
  const { exportChat } = usePdfExport();

  // Input state
  const [chatInput, setChatInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("mistral");
  const [fileAttachment, setFileAttachment] = useState(null);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [openMenuChatId, setOpenMenuChatId] = useState(null);
  const [dropdownDirection, setDropdownDirection] = useState("down");
  const menuButtonRefs = useRef({});
  const [hiddenChatIds, setHiddenChatIds] = useState(loadHiddenChats);
  const [hiddenSectionOpen, setHiddenSectionOpen] = useState(false);

  // Dropdown and menu state
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Speech recognition state
  const [isRecording, setIsRecording] = useState(false);

  // Refs
  const messagesEndRef = useRef(null);
  const modelDropdownRef = useRef(null);
  const profileMenuRef = useRef(null);
  const chatMenuRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    chat.handleInitializeSocket();
    chat.handleGetChats();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, currentChatId]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target)) {
        setModelDropdownOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
      if (chatMenuRef.current && !chatMenuRef.current.contains(e.target)) {
        setOpenMenuChatId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Hide / Unhide ──
  const handleHideChat = (chatId) => {
    const updated = new Set(hiddenChatIds);
    updated.add(chatId);
    setHiddenChatIds(updated);
    saveHiddenChats(updated);
    // If currently viewing this chat, deselect it
    if (currentChatId === chatId) chat.handleNewChat();
  };

  const handleUnhideChat = (chatId) => {
    const updated = new Set(hiddenChatIds);
    updated.delete(chatId);
    setHiddenChatIds(updated);
    saveHiddenChats(updated);
  };

  // ── PDF Export ──
  const handleExportPdf = async (chatId) => {
    const chatData = chats[chatId];
    if (!chatData) return;
    await exportChat({
      title: chatData.title,
      model: chatData.model,
      messages: chatData.messages,
    });
  };

  // ── File upload ──
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      alert("Only JPG, PNG, WEBP images and PDFs are supported.");
      e.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      alert(`File must be under ${MAX_FILE_SIZE_MB}MB.`);
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(",")[1];
      setFileAttachment({
        base64,
        mimeType: file.type,
        name: file.name,
        previewUrl: file.type.startsWith("image/") ? dataUrl : null,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleRemoveAttachment = () => setFileAttachment(null);

  // ── Mic ──
  const handleMicClick = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in your browser. Try Chrome.");
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setChatInput((prev) => (prev ? prev + " " + transcript : transcript));
    };
    recognition.onnomatch = () => setIsRecording(false);
    recognition.onerror = (e) => {
      if (e.error === "no-speech") { setIsRecording(false); return; }
      console.error("Speech recognition error:", e.error);
      setIsRecording(false);
    };
    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  // ── Send message ──
  const handleSubmitMessage = (e) => {
    e?.preventDefault();
    const trimmedMessage = chatInput.trim();
    if ((!trimmedMessage && !fileAttachment) || isStreaming) return;
    chat.handleSendMessage({
      message: trimmedMessage || (fileAttachment ? "Attached file" : ""),
      chatId: currentChatId,
      model: selectedModel,
      file: fileAttachment
        ? { base64: fileAttachment.base64, mimeType: fileAttachment.mimeType, name: fileAttachment.name }
        : null,
    });
    setChatInput("");
    setFileAttachment(null);
  };

  // ── Sorted + filtered chat lists ──
  const allChats = Object.values(chats).sort(
    (a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated)
  );

  const recentChats = allChats.filter(
    (c) =>
      !hiddenChatIds.has(c.id) &&
      c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const hiddenChats = allChats.filter(
    (c) =>
      hiddenChatIds.has(c.id) &&
      c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentChat = currentChatId ? chats[currentChatId] : null;

  // ── Reusable chat row renderer ──
  const renderChatRow = (c, isHidden = false) => (
    <div
      key={c.id}
      className={`group relative flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition
        ${currentChatId === c.id ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5 hover:text-white"}`}
    >
      {/* Chat title */}
      <button
        onClick={() => chat.handleOpenChat(c.id, chats)}
        type="button"
        className="flex flex-1 items-center gap-2 min-w-0 text-left cursor-pointer"
      >
        <MessageSquare size={14} className="shrink-0 opacity-60" />
        <div className="flex flex-col min-w-0">
          <span className={`truncate ${isHidden ? "opacity-50" : ""}`}>{c.title}</span>
          {c.model && (
            <span className="text-xs text-white/30 capitalize">{c.model}</span>
          )}
        </div>
      </button>

      {/* Three-dot menu */}
      <div className="relative" ref={chatMenuRef}>
        <button
          type="button"
          ref={(el) => { menuButtonRefs.current[c.id] = el; }}
          onClick={(e) => {
            e.stopPropagation();
            if (openMenuChatId === c.id) {
              setOpenMenuChatId(null);
            } else {
              // Calculate if dropdown should open up or down
              const btn = menuButtonRefs.current[c.id];
              if (btn) {
                const rect = btn.getBoundingClientRect();
                const spaceBelow = window.innerHeight - rect.bottom;
                setDropdownDirection(spaceBelow < 220 ? "up" : "down");
              }
              setOpenMenuChatId(c.id);
            }
          }}
          className="shrink-0 opacity-0 group-hover:opacity-100 text-white/30 hover:text-white transition p-1 rounded-lg hover:bg-white/10"
        >
          <MoreHorizontal size={14} />
        </button>

        {openMenuChatId === c.id && (
          <div className={`absolute right-0 z-20 w-40 rounded-xl border border-white/10 bg-[#0e1117] py-1 shadow-xl ${dropdownDirection === "up" ? "bottom-7" : "top-7"}`}>
            {/* Export PDF */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleExportPdf(c.id);
                setOpenMenuChatId(null);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-[#31b8c6] hover:bg-white/5 transition"
            >
              <Download size={13} />
              Export PDF
            </button>

            {/* Hide / Unhide */}
            {isHidden ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleUnhideChat(c.id);
                  setOpenMenuChatId(null);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 transition"
              >
                <Eye size={13} />
                Unhide
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleHideChat(c.id);
                  setOpenMenuChatId(null);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 transition"
              >
                <EyeOff size={13} />
                Hide
              </button>
            )}

            {/* Divider */}
            <div className="my-1 border-t border-white/5" />

            {/* Delete */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                chat.handleDeleteChat(c.id);
                setOpenMenuChatId(null);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-red-400 hover:bg-white/5 transition"
            >
              <Trash2 size={13} />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <main className="min-h-screen w-full bg-[#07090f] p-3 text-white md:p-5">
      <section className="mx-auto flex h-[calc(100vh-1.5rem)] w-full gap-4 md:h-[calc(100vh-2.5rem)] md:gap-6">

        {/* ── SIDEBAR ── */}
        <aside
          className={`hidden h-full shrink-0 rounded-3xl bg-[#080b12] p-4 md:flex md:flex-col transition-all duration-300 ${sidebarOpen ? "w-72" : "w-16"}`}
        >
          {/* Top row */}
          <div className="mb-5 flex items-center justify-between">
            {sidebarOpen && (
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Cognivra
              </h1>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white/40 hover:bg-white/5 hover:text-white transition"
            >
              {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
            </button>
          </div>

          {/* New chat button */}
          <button
            onClick={() => chat.handleNewChat()}
            className={`mb-4 flex items-center justify-center gap-2 w-full rounded-xl border border-white/20 py-2 text-sm text-white/60 hover:text-white hover:border-white/40 transition ${!sidebarOpen ? "px-0" : ""}`}
          >
            <Plus size={15} />
            {sidebarOpen && "New Chat"}
          </button>

          {/* Search bar */}
          {sidebarOpen ? (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <Search size={13} className="shrink-0 text-white/30" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats..."
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/25"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="text-white/30 hover:text-white transition">
                  <X size={12} />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl text-white/40 hover:bg-white/5 hover:text-white transition mx-auto"
            >
              <Search size={16} />
            </button>
          )}

          {/* ── CHAT LIST ── */}
          <div className={`flex-1 flex flex-col overflow-y-auto gap-1 ${!sidebarOpen ? "hidden" : ""}`}>

            {/* Recent section label */}
            {recentChats.length > 0 && (
              <div className="group/section flex items-center justify-between px-2 pb-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20">
                  Recent
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const updated = new Set(hiddenChatIds);
                    recentChats.forEach((c) => updated.add(c.id));
                    setHiddenChatIds(updated);
                    saveHiddenChats(updated);
                    chat.handleNewChat();
                  }}
                  className="opacity-0 group-hover/section:opacity-100 text-[10px] text-white/30 hover:text-white/70 transition"
                >
                  Hide
                </button>
              </div>
            )}

            {/* Recent chats */}
            <div className="space-y-1">
              {recentChats.map((c) => renderChatRow(c, false))}
            </div>

            {/* Empty search result */}
            {searchQuery && recentChats.length === 0 && hiddenChats.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-white/25">
                No chats found
              </p>
            )}

            {/* ── HIDDEN SECTION ── */}
            {hiddenChats.length > 0 && (
              <div className="mt-3">
                {/* Hidden section toggle */}
                <div className="group/hidden flex items-center justify-between px-2 pb-1">
                  <button
                    type="button"
                    onClick={() => setHiddenSectionOpen(!hiddenSectionOpen)}
                    className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/20 hover:text-white/40 transition"
                  >
                    <ChevronRight
                      size={10}
                      className={`transition-transform ${hiddenSectionOpen ? "rotate-90" : ""}`}
                    />
                    Hidden ({hiddenChats.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = new Set(hiddenChatIds);
                      hiddenChats.forEach((c) => updated.delete(c.id));
                      setHiddenChatIds(updated);
                      saveHiddenChats(updated);
                    }}
                    className="opacity-0 group-hover/hidden:opacity-100 text-[10px] text-white/30 hover:text-white/70 transition"
                  >
                    Show all
                  </button>
                </div>

                {/* Hidden chats list */}
                {hiddenSectionOpen && (
                  <div className="space-y-1 mt-1">
                    {hiddenChats.map((c) => renderChatRow(c, true))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Profile card */}
          <div className="relative mt-auto" ref={profileMenuRef}>
            {profileMenuOpen && (
              <div className="absolute bottom-14 left-0 right-0 rounded-xl border border-white/10 bg-[#0e1117] overflow-hidden shadow-xl">
                <button
                  onClick={() => { auth.handleLogout(); setProfileMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 transition"
                >
                  <LogOut size={14} />
                  {sidebarOpen && "Logout"}
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
              {sidebarOpen && (
                <div className="flex flex-col items-start min-w-0">
                  <span className="truncate text-sm font-medium text-white/80">
                    {user?.username || "User"}
                  </span>
                  <span className="text-xs text-white/30">Free Plan</span>
                </div>
              )}
              {sidebarOpen && (
                <ChevronDown
                  size={13}
                  className={`ml-auto shrink-0 text-white/30 transition-transform ${profileMenuOpen ? "rotate-180" : ""}`}
                />
              )}
            </button>
          </div>
        </aside>

        {/* ── MAIN CHAT AREA ── */}
        <section className="relative mx-auto flex h-full min-w-0 flex-1 flex-col overflow-hidden">

          {/* Chat header */}
          {currentChat && (
            <div className="flex items-center justify-between px-2 pb-3 pt-1 border-b border-white/5">
              <div className="flex flex-col min-w-0">
                <h2 className="truncate text-sm font-semibold text-white/90 max-w-xs md:max-w-md">
                  {currentChat.title}
                </h2>
                {currentChat.model && (
                  <span className="text-xs text-white/30 capitalize">
                    {currentChat.model}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleExportPdf(currentChatId)}
                title="Export chat as PDF"
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/50 hover:text-[#31b8c6] hover:border-[#31b8c6]/30 hover:bg-[#31b8c6]/5 transition"
              >
                <Download size={13} />
                <span className="hidden sm:inline">Export PDF</span>
              </button>
            </div>
          )}

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
                {message.file && (
                  <div className="mb-2">
                    {message.file.mimeType?.startsWith("image/") ? (
                      <img
                        src={message.file.previewUrl || `data:${message.file.mimeType};base64,${message.file.base64}`}
                        alt={message.file.name}
                        className="max-h-48 max-w-xs rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs text-white/60">
                        <FileText size={13} />
                        <span className="truncate max-w-[180px]">{message.file.name}</span>
                      </div>
                    )}
                  </div>
                )}

                {message.role === "user" ? (
                  <p>{message.content}</p>
                ) : (
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="mb-2 list-disc pl-5">{children}</ul>,
                      ol: ({ children }) => <ol className="mb-2 list-decimal pl-5">{children}</ol>,
                      code: ({ children }) => <code className="rounded bg-white/10 px-1 py-0.5 text-sm">{children}</code>,
                      pre: ({ children }) => <pre className="mb-2 overflow-x-auto rounded-xl bg-black/30 p-3">{children}</pre>,
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
                <span className="h-2 w-2 animate-bounce rounded-full bg-white/40 [animation-delay:0ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-white/40 [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-white/40 [animation-delay:300ms]" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input footer */}
          <div className="absolute bottom-2 left-2 right-2">
            <div className="rounded-2xl border border-white/15 bg-[#0e1117] p-3 shadow-xl">
              {fileAttachment && (
                <div className="mb-2 flex items-center gap-2">
                  {fileAttachment.previewUrl ? (
                    <div className="relative inline-block">
                      <img
                        src={fileAttachment.previewUrl}
                        alt={fileAttachment.name}
                        className="h-16 w-16 rounded-xl object-cover border border-white/10"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveAttachment}
                        className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40 transition"
                      >
                        <X size={9} />
                      </button>
                    </div>
                  ) : (
                    <div className="relative flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs text-white/60">
                      <FileText size={13} />
                      <span className="truncate max-w-[200px]">{fileAttachment.name}</span>
                      <button
                        type="button"
                        onClick={handleRemoveAttachment}
                        className="ml-1 text-white/30 hover:text-white/70 transition"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              <input
                type="text"
                value={chatInput}
                onChange={(e) => { if (e.target.value.length <= 2000) setChatInput(e.target.value); }}
                onKeyDown={(e) => e.key === "Enter" && handleSubmitMessage(e)}
                placeholder={isRecording ? "Listening..." : "Ask anything..."}
                className="w-full bg-transparent px-2 py-2 text-base text-white outline-none placeholder:text-white/25"
              />

              {chatInput.length > 1800 && (
                <p className="px-2 pt-1 text-right text-xs text-white/30">
                  <span className={chatInput.length >= 2000 ? "text-red-400" : ""}>{chatInput.length}</span>/2000
                </p>
              )}

              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
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
                      <ChevronDown size={13} className={`transition-transform ${modelDropdownOpen ? "rotate-180" : ""}`} />
                    </button>

                    {modelDropdownOpen && (
                      <div className="absolute bottom-10 right-0 z-10 w-36 rounded-xl border border-white/15 bg-[#0e1117] py-1 shadow-xl">
                        {MODELS.map((model) => (
                          <button
                            key={model.value}
                            type="button"
                            onClick={() => { setSelectedModel(model.value); setModelDropdownOpen(false); }}
                            className={`w-full px-3 py-2 text-left text-sm transition hover:bg-white/10 ${selectedModel === model.value ? "text-[#31b8c6]" : "text-white/60 hover:text-white"}`}
                          >
                            {model.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {!chatInput.trim() && !fileAttachment && (
                    <button
                      type="button"
                      onClick={handleMicClick}
                      className={`relative flex h-8 w-8 items-center justify-center rounded-full border transition ${
                        isRecording ? "border-red-400 text-red-400" : "border-white/20 text-white/50 hover:text-white hover:border-white/50"
                      }`}
                    >
                      {isRecording && (
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-20" />
                      )}
                      <Mic size={15} />
                    </button>
                  )}

                  {(chatInput.trim() || fileAttachment) && (
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