import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useSelector, useDispatch } from "react-redux";
import { removeLastAiMessage, removeMessagesFrom } from "../chat.slice.js";
import { useChat } from "../hooks/useChat";
import remarkGfm from "remark-gfm";
import { useAuth } from "../../auth/hook/useAuth";
import { usePdfExport } from "../hooks/usePdfExport";
import { shareChat, revokeShare } from "../service/chat.api";
import UserSettings from "./UserSettings.jsx";
import { toast } from "sonner";
import {
  Plus, Mic, ArrowUp, ChevronDown, MessageSquare, LogOut,
  Trash2, X, FileText, Search, MoreHorizontal, PanelLeftClose,
  PanelLeftOpen, Download, EyeOff, Eye, EyeClosed, ChevronRight, Share2,
  Copy, Check, Link as LinkIcon, Clock, Menu,
  ThumbsUp, ThumbsDown, RotateCcw, Pencil, Settings,
} from "lucide-react";

const MODELS = [
  { value: "mistral",  label: "Mistral"  },
  { value: "gemini",   label: "Gemini"   },
  { value: "groq",     label: "Groq"     },
  { value: "deepseek", label: "DeepSeek" },
];

const ACCEPTED_TYPES = ["image/jpeg","image/png","image/webp","application/pdf"];
const MAX_FILE_SIZE_MB = 10;

const EXPIRY_OPTIONS = [
  { label: "1 day",   value: 1  },
  { label: "7 days",  value: 7  },
  { label: "30 days", value: 30 },
];

const loadHiddenChats = () => {
  try {
    const stored = localStorage.getItem("cognivra_hidden_chats");
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch { return new Set(); }
};

const saveHiddenChats = (hiddenSet) => {
  localStorage.setItem("cognivra_hidden_chats", JSON.stringify([...hiddenSet]));
};

const Dashboard = () => {
  const chat        = useChat();
  const dispatch    = useDispatch();
  const chats       = useSelector((state) => state.chat.chats);
  const currentChatId = useSelector((state) => state.chat.currentChatId);
  const isStreaming = useSelector((state) => state.chat.isStreaming);
  const isLoading   = useSelector((state) => state.chat.isLoading);
  const user        = useSelector((state) => state.auth.user);
  const auth        = useAuth();
  const { exportChat } = usePdfExport();

  // Message action state
  const [copiedIndex,   setCopiedIndex]   = useState(null);   // index of copied message
  const [feedbackMap,   setFeedbackMap]   = useState({});     // { [index]: "up" | "down" }
  const [editingIndex,  setEditingIndex]  = useState(null);   // index of message being edited

  /* Input state */
  const [chatInput,      setChatInput]      = useState("");
  const [selectedModel,  setSelectedModel]  = useState(
    () => { try { return localStorage.getItem("cognivra_default_model") || "mistral"; } catch { return "mistral"; } }
  );
  const [fileAttachment, setFileAttachment] = useState(null);

  // Sidebar state
  const [sidebarOpen,       setSidebarOpen]       = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchQuery,       setSearchQuery]        = useState("");
  const [openMenuChatId,    setOpenMenuChatId]     = useState(null);
  const [dropdownDirection, setDropdownDirection]  = useState("down");
  const [hiddenChatIds,     setHiddenChatIds]      = useState(loadHiddenChats);
  const [hiddenSectionOpen, setHiddenSectionOpen]  = useState(false);

  /* Dropdown/menu state */
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [profileMenuOpen,   setProfileMenuOpen]   = useState(false);
  const [settingsOpen,      setSettingsOpen]      = useState(false);

  // Speech
  const [isRecording, setIsRecording] = useState(false);

  // Share modal state
  const [shareModalOpen,  setShareModalOpen]  = useState(false);
  const [shareForChatId,  setShareForChatId]  = useState(null);
  const [selectedExpiry,  setSelectedExpiry]  = useState(7);
  const [shareLink,       setShareLink]       = useState(null);
  const [shareExpiry,     setShareExpiry]     = useState(null);
  const [isCopied,        setIsCopied]        = useState(false);
  const [isSharing,       setIsSharing]       = useState(false);
  const [isRevoking,      setIsRevoking]      = useState(false);

  // Refs
  const messagesEndRef    = useRef(null);
  const modelDropdownRef  = useRef(null);
  const profileMenuRef    = useRef(null);
  // chatMenuRef removed — menu close handled via useEffect below
  const fileInputRef      = useRef(null);
  const recognitionRef    = useRef(null);
  const menuButtonRefs    = useRef({});

  useEffect(() => {
    chat.handleInitializeSocket();
    chat.handleGetChats();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, currentChatId]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target))
        setModelDropdownOpen(false);
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target))
        setProfileMenuOpen(false);
      // Close chat menu if click is outside any chat menu
      if (!e.target.closest('[data-chat-menu]')) {
        setOpenMenuChatId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Hide / Unhide 
  const handleHideChat = (chatId) => {
    const updated = new Set(hiddenChatIds);
    updated.add(chatId);
    setHiddenChatIds(updated);
    saveHiddenChats(updated);
    if (currentChatId === chatId) chat.handleNewChat();
  };

  const handleUnhideChat = (chatId) => {
    const updated = new Set(hiddenChatIds);
    updated.delete(chatId);
    setHiddenChatIds(updated);
    saveHiddenChats(updated);
  };

  // PDF Export
  const handleExportPdf = async (chatId) => {
    const chatData = chats[chatId];
    if (!chatData) return;
    await exportChat({ title: chatData.title, model: chatData.model, messages: chatData.messages });
  };

  // ── Share Modal ──
  const openShareModal = (chatId) => {
    setShareForChatId(chatId);
    setShareLink(null);
    setShareExpiry(null);
    setSelectedExpiry(7);
    setIsCopied(false);
    setShareModalOpen(true);
  };

  const handleShare = async () => {
    if (!shareForChatId) return;
    setIsSharing(true);
    try {
      const data = await shareChat(shareForChatId, selectedExpiry);
      const link = `${window.location.origin}/share/${data.shareToken}`;
      setShareLink(link);
      setShareExpiry(data.shareExpiry);
      toast.success("Share link created!");
    } catch {
      toast.error("Failed to create share link");
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyLink = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    setIsCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleRevoke = async () => {
    if (!shareForChatId) return;
    setIsRevoking(true);
    try {
      await revokeShare(shareForChatId);
      setShareLink(null);
      setShareExpiry(null);
      toast.success("Share link revoked");
    } catch {
      toast.error("Failed to revoke link");
    } finally {
      setIsRevoking(false);
    }
  };

  // File upload
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      alert("Only JPG, PNG, WEBP images and PDFs are supported.");
      e.target.value = ""; return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      alert(`File must be under ${MAX_FILE_SIZE_MB}MB.`);
      e.target.value = ""; return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setFileAttachment({
        base64: dataUrl.split(",")[1],
        mimeType: file.type,
        name: file.name,
        previewUrl: file.type.startsWith("image/") ? dataUrl : null,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleRemoveAttachment = () => setFileAttachment(null);

  // Copy message 
  const handleCopyMessage = (content, index) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Regenerate last AI response 
  const handleRegenerate = () => {
    if (!currentChatId || isStreaming) return;
    const messages = chats[currentChatId]?.messages || [];
    // Find last user message
    let lastUserMsg = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") { lastUserMsg = messages[i]; break; }
    }
    if (!lastUserMsg) return;
    dispatch(removeLastAiMessage({ chatId: currentChatId }));
    chat.handleSendMessage({
      message: lastUserMsg.content,
      chatId: currentChatId,
      model: selectedModel,
      file: lastUserMsg.file || null,
    });
  };

  // Thumbs feedback
  const handleFeedback = (index, value) => {
    setFeedbackMap((prev) => ({
      ...prev,
      [index]: prev[index] === value ? null : value,
    }));
  };

  // Edit user message
  const handleEditMessage = (content, index) => {
    if (isStreaming) return;
    setChatInput(content);
    setEditingIndex(index);
  };

  // Mic 
  const handleMicClick = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Speech recognition not supported. Try Chrome."); return; }
    if (isRecording) { recognitionRef.current?.stop(); setIsRecording(false); return; }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    recognition.onstart  = () => setIsRecording(true);
    recognition.onresult = (e) => {
      const t = e.results[0][0].transcript;
      setChatInput((prev) => prev ? prev + " " + t : t);
    };
    recognition.onnomatch = () => setIsRecording(false);
    recognition.onerror  = (e) => { if (e.error !== "no-speech") console.error(e.error); setIsRecording(false); };
    recognition.onend    = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  // Send message 
  const handleSubmitMessage = (e) => {
    e?.preventDefault();
    const trimmed = chatInput.trim();
    if ((!trimmed && !fileAttachment) || isStreaming) return;

    // Edit mode — remove messages from that index onward, then re-send
    if (editingIndex !== null && currentChatId) {
      dispatch(removeMessagesFrom({ chatId: currentChatId, fromIndex: editingIndex }));
      setEditingIndex(null);
    }

    chat.handleSendMessage({
      message: trimmed || (fileAttachment ? "Attached file" : ""),
      chatId: currentChatId,
      model: selectedModel,
      file: fileAttachment ? { base64: fileAttachment.base64, mimeType: fileAttachment.mimeType, name: fileAttachment.name } : null,
    });
    setChatInput("");
    setFileAttachment(null);
  };

  // Sorted + filtered chat lists 
  const allChats = Object.values(chats).sort(
    (a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated)
  );
  const recentChats = allChats.filter(
    (c) => !hiddenChatIds.has(c.id) && c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const hiddenChats = allChats.filter(
    (c) => hiddenChatIds.has(c.id) && c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentChat = currentChatId ? chats[currentChatId] : null;

  // Reusable chat row
  const renderChatRow = (c, isHidden = false) => (
    <div
      key={c.id}
      className={`group relative flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition
        ${currentChatId === c.id ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5 hover:text-white"}`}
    >
      <button
        onClick={() => { chat.handleOpenChat(c.id, chats); setMobileSidebarOpen(false); }}
        type="button"
        className="flex flex-1 items-center gap-2 min-w-0 text-left cursor-pointer"
      >
        <MessageSquare size={14} className="shrink-0 opacity-60" />
        <div className="flex flex-col min-w-0">
          <span className={`truncate ${isHidden ? "opacity-50" : ""}`}>{c.title}</span>
          {c.model && <span className="text-xs text-white/30 capitalize">{c.model}</span>}
        </div>
      </button>

      {/* Three-dot menu */}
      <div className="relative" data-chat-menu>
        <button
          type="button"
          ref={(el) => { menuButtonRefs.current[c.id] = el; }}
          onClick={(e) => {
            e.stopPropagation();
            if (openMenuChatId === c.id) {
              setOpenMenuChatId(null);
            } else {
              const btn = menuButtonRefs.current[c.id];
              if (btn) {
                const rect = btn.getBoundingClientRect();
                setDropdownDirection(window.innerHeight - rect.bottom < 280 ? "up" : "down");
              }
              setOpenMenuChatId(c.id);
            }
          }}
          className="shrink-0 opacity-0 group-hover:opacity-100 text-white/30 hover:text-white transition p-1 rounded-lg hover:bg-white/10"
        >
          <MoreHorizontal size={14} />
        </button>

        {openMenuChatId === c.id && (
          <div className={`absolute right-0 z-20 w-44 rounded-xl border border-white/10 bg-[#0e1117] py-1 shadow-xl ${dropdownDirection === "up" ? "bottom-7" : "top-7"}`}>
            {/* Share */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openShareModal(c.id);
                setOpenMenuChatId(null);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-[#31b8c6] hover:bg-white/5 transition"
            >
              <Share2 size={13} />
              Share
            </button>

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
                onClick={(e) => { e.stopPropagation(); handleUnhideChat(c.id); setOpenMenuChatId(null); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 transition"
              >
                <Eye size={13} />
                Unhide
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleHideChat(c.id); setOpenMenuChatId(null); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 transition"
              >
                <EyeOff size={13} />
                Hide
              </button>
            )}

            <div className="my-1 border-t border-white/5" />

            {/* Delete */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); chat.handleDeleteChat(c.id); setOpenMenuChatId(null); }}
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

        {/*  MOBILE BACKDROP */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* ── SIDEBAR ── */}
        <aside className={`
          fixed inset-y-0 left-0 z-40 flex h-full flex-col bg-[#080b12] p-4
          transition-all duration-300 ease-in-out
          md:relative md:inset-auto md:z-auto md:shrink-0 md:rounded-3xl
          md:translate-x-0
          ${mobileSidebarOpen ? "translate-x-0 w-72 rounded-r-3xl shadow-2xl" : "-translate-x-full w-72"}
          ${sidebarOpen ? "md:w-72" : "md:w-16"}
        `}>
          {/* Top row */}
          <div className="mb-5 flex items-center justify-between">
            {sidebarOpen && <h1 className="text-2xl font-bold tracking-tight text-white">Cognivra</h1>}
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white/40 hover:bg-white/5 hover:text-white transition">
              {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
            </button>
          </div>

          {/* New chat */}
          <button onClick={() => chat.handleNewChat()} className={`mb-4 flex items-center justify-center gap-2 w-full rounded-xl border border-white/20 py-2 text-sm text-white/60 hover:text-white hover:border-white/40 transition ${!sidebarOpen ? "px-0" : ""}`}>
            <Plus size={15} />
            {sidebarOpen && "New Chat"}
          </button>

          {/* Search */}
          {sidebarOpen ? (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <Search size={13} className="shrink-0 text-white/30" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search chats..." className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/25" />
              {searchQuery && <button onClick={() => setSearchQuery("")} className="text-white/30 hover:text-white transition"><X size={12} /></button>}
            </div>
          ) : (
            <button onClick={() => setSidebarOpen(true)} className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl text-white/40 hover:bg-white/5 hover:text-white transition mx-auto">
              <Search size={16} />
            </button>
          )}

          {/* Chat list */}
          <div className={`flex-1 flex flex-col overflow-y-auto gap-1 ${!sidebarOpen ? "hidden" : ""}`}>

            {/* Recent header */}
            {recentChats.length > 0 && (
              <div className="group/section flex items-center justify-between px-2 pb-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20">Recent</p>
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

            <div className="space-y-1">{recentChats.map((c) => renderChatRow(c, false))}</div>

            {searchQuery && recentChats.length === 0 && hiddenChats.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-white/25">No chats found</p>
            )}

            {/* Hidden section */}
            {hiddenChats.length > 0 && (
              <div className="mt-3">
                <div className="group/hidden flex items-center justify-between px-2 pb-1">
                  <button type="button" onClick={() => setHiddenSectionOpen(!hiddenSectionOpen)} className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/20 hover:text-white/40 transition">
                    <ChevronRight size={10} className={`transition-transform ${hiddenSectionOpen ? "rotate-90" : ""}`} />
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
                {hiddenSectionOpen && <div className="space-y-1 mt-1">{hiddenChats.map((c) => renderChatRow(c, true))}</div>}
              </div>
            )}
          </div>

          {/* Profile */}
          <div className="relative mt-auto" ref={profileMenuRef}>
            {profileMenuOpen && (
              <div className="absolute bottom-14 left-0 right-0 rounded-xl border border-white/10 bg-[#0e1117] overflow-hidden shadow-xl">
                {/* Settings option */}
                <button
                  onClick={() => { setSettingsOpen(true); setProfileMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 transition"
                >
                  <Settings size={14} />
                  {sidebarOpen && "Settings"}
                </button>
                <div className="border-t border-white/5" />
                <button
                  onClick={() => { auth.handleLogout(); setProfileMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 transition"
                >
                  <LogOut size={14} />
                  {sidebarOpen && "Logout"}
                </button>
              </div>
            )}
            <button onClick={() => setProfileMenuOpen(!profileMenuOpen)} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 transition rounded-lg">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white uppercase">
                {user?.username?.[0] || "U"}
              </div>
              {sidebarOpen && (
                <>
                  <div className="flex flex-col items-start min-w-0">
                    <span className="truncate text-sm font-medium text-white/80">{user?.username || "User"}</span>
                    <span className="text-xs text-white/30">Free Plan</span>
                  </div>
                  <ChevronDown size={13} className={`ml-auto shrink-0 text-white/30 transition-transform ${profileMenuOpen ? "rotate-180" : ""}`} />
                </>
              )}
            </button>
          </div>
        </aside>

        {/* MAIN CHAT AREA */}
        <section className="relative mx-auto flex h-full min-w-0 flex-1 flex-col overflow-hidden">

          {/* Chat header */}
          {currentChat ? (
            <div className="flex items-center justify-between px-2 pb-3 pt-1 border-b border-white/5">
              <div className="flex items-center gap-2 min-w-0">
                {/* Hamburger — mobile only */}
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(true)}
                  className="flex md:hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white/40 hover:bg-white/5 hover:text-white transition"
                >
                  <Menu size={18} />
                </button>
                <div className="flex flex-col min-w-0">
                  <h2 className="truncate text-sm font-semibold text-white/90 max-w-[160px] sm:max-w-xs md:max-w-md">{currentChat.title}</h2>
                  {currentChat.model && <span className="text-xs text-white/30 capitalize">{currentChat.model}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Share button */}
                <button
                  type="button"
                  onClick={() => openShareModal(currentChatId)}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/50 hover:text-[#31b8c6] hover:border-[#31b8c6]/30 hover:bg-[#31b8c6]/5 transition"
                >
                  <Share2 size={13} />
                  <span className="hidden sm:inline">Share</span>
                </button>
                {/* Export PDF button */}
                <button
                  type="button"
                  onClick={() => handleExportPdf(currentChatId)}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/50 hover:text-[#31b8c6] hover:border-[#31b8c6]/30 hover:bg-[#31b8c6]/5 transition"
                >
                  <Download size={13} />
                  <span className="hidden sm:inline">Export PDF</span>
                </button>
              </div>
            </div>
          ) : (
            /* No chat selected — still show hamburger on mobile */
            <div className="flex items-center px-2 pb-3 pt-1 md:hidden">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-white/40 hover:bg-white/5 hover:text-white transition"
              >
                <Menu size={18} />
              </button>
            </div>
          )}

          {/* Messages */}
          <div className="messages flex-1 flex flex-col overflow-y-auto pb-44 pt-4 px-2 space-y-4">
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

            {chats[currentChatId]?.messages.map((message, index) => {
              const isUser = message.role === "user";
              const isLastAi = !isUser && (() => {
                const msgs = chats[currentChatId]?.messages || [];
                for (let i = msgs.length - 1; i >= 0; i--) {
                  if (msgs[i].role === "ai") return i === index;
                }
                return false;
              })();

              return (
                <div key={index} className={`group/msg flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                  {/* Bubble */}
                  <div className={`max-w-[85%] w-fit rounded-2xl px-4 py-3 text-sm md:text-base ${isUser ? "rounded-br-none bg-white/10 text-white" : "text-white/90"}`}>
                    {message.file && (
                      <div className="mb-2">
                        {message.file.mimeType?.startsWith("image/") ? (
                          <img src={message.file.previewUrl || `data:${message.file.mimeType};base64,${message.file.base64}`} alt={message.file.name} className="max-h-48 max-w-xs rounded-xl object-cover" />
                        ) : (
                          <div className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs text-white/60">
                            <FileText size={13} />
                            <span className="truncate max-w-[180px]">{message.file.name}</span>
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
                          code: ({ children }) => <code className="rounded bg-white/10 px-1 py-0.5 text-sm">{children}</code>,
                          pre: ({ children }) => <pre className="mb-2 overflow-x-auto rounded-xl bg-black/30 p-3">{children}</pre>,
                        }}
                        remarkPlugins={[remarkGfm]}
                      >
                        {message.content}
                      </ReactMarkdown>
                    )}
                  </div>

                  {/* Action bar */}
                  <div className={`mt-1 flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                    {/* Copy — all messages */}
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(message.content, index)}
                      className="flex h-6 w-6 items-center justify-center rounded-lg text-white/25 hover:text-white/70 hover:bg-white/5 transition"
                      title="Copy"
                    >
                      {copiedIndex === index ? <Check size={12} className="text-[#31b8c6]" /> : <Copy size={12} />}
                    </button>

                    {/* AI-only actions */}
                    {!isUser && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleFeedback(index, "up")}
                          className={`flex h-6 w-6 items-center justify-center rounded-lg transition hover:bg-white/5 ${feedbackMap[index] === "up" ? "text-[#31b8c6]" : "text-white/25 hover:text-white/70"}`}
                          title="Good response"
                        >
                          <ThumbsUp size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFeedback(index, "down")}
                          className={`flex h-6 w-6 items-center justify-center rounded-lg transition hover:bg-white/5 ${feedbackMap[index] === "down" ? "text-red-400" : "text-white/25 hover:text-white/70"}`}
                          title="Bad response"
                        >
                          <ThumbsDown size={12} />
                        </button>
                        {/* Regenerate — last AI message only */}
                        {isLastAi && (
                          <button
                            type="button"
                            onClick={handleRegenerate}
                            disabled={isStreaming}
                            className="flex h-6 w-6 items-center justify-center rounded-lg text-white/25 hover:text-white/70 hover:bg-white/5 transition disabled:opacity-30"
                            title="Regenerate response"
                          >
                            <RotateCcw size={12} />
                          </button>
                        )}
                      </>
                    )}

                    {/* Edit — user messages only */}
                    {isUser && (
                      <button
                        type="button"
                        onClick={() => handleEditMessage(message.content, index)}
                        disabled={isStreaming}
                        className={`flex h-6 w-6 items-center justify-center rounded-lg transition hover:bg-white/5 disabled:opacity-30 ${editingIndex === index ? "text-[#31b8c6]" : "text-white/25 hover:text-white/70"}`}
                        title="Edit message"
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

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
          <div className="absolute bottom-0 left-0 right-0 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <div className="rounded-2xl border border-white/15 bg-[#0e1117] p-3 shadow-xl">
              {/* Edit mode indicator */}
              {editingIndex !== null && (
                <div className="mb-2 flex items-center justify-between rounded-lg bg-[#31b8c6]/10 border border-[#31b8c6]/20 px-3 py-1.5">
                  <div className="flex items-center gap-2 text-xs text-[#31b8c6]">
                    <Pencil size={11} />
                    <span>Editing message</span>
                  </div>
                  <button type="button" onClick={() => { setEditingIndex(null); setChatInput(""); }} className="text-white/30 hover:text-white/70 transition">
                    <X size={11} />
                  </button>
                </div>
              )}
              {fileAttachment && (
                <div className="mb-2 flex items-center gap-2">
                  {fileAttachment.previewUrl ? (
                    <div className="relative inline-block">
                      <img src={fileAttachment.previewUrl} alt={fileAttachment.name} className="h-16 w-16 rounded-xl object-cover border border-white/10" />
                      <button type="button" onClick={handleRemoveAttachment} className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40 transition"><X size={9} /></button>
                    </div>
                  ) : (
                    <div className="relative flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs text-white/60">
                      <FileText size={13} />
                      <span className="truncate max-w-[200px]">{fileAttachment.name}</span>
                      <button type="button" onClick={handleRemoveAttachment} className="ml-1 text-white/30 hover:text-white/70 transition"><X size={11} /></button>
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
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleFileChange} className="hidden" />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white/50 hover:text-white hover:border-white/50 transition">
                    <Plus size={15} />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative" ref={modelDropdownRef}>
                    <button type="button" onClick={() => setModelDropdownOpen(!modelDropdownOpen)} className="flex items-center gap-1.5 rounded-full border border-white/20 bg-transparent px-3 py-1.5 text-sm text-white/70 hover:text-white hover:border-white/40 transition">
                      {MODELS.find((m) => m.value === selectedModel)?.label}
                      <ChevronDown size={13} className={`transition-transform ${modelDropdownOpen ? "rotate-180" : ""}`} />
                    </button>
                    {modelDropdownOpen && (
                      <div className="absolute bottom-10 right-0 z-10 w-36 rounded-xl border border-white/15 bg-[#0e1117] py-1 shadow-xl">
                        {MODELS.map((model) => (
                          <button key={model.value} type="button" onClick={() => { setSelectedModel(model.value); setModelDropdownOpen(false); }} className={`w-full px-3 py-2 text-left text-sm transition hover:bg-white/10 ${selectedModel === model.value ? "text-[#31b8c6]" : "text-white/60 hover:text-white"}`}>
                            {model.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {!chatInput.trim() && !fileAttachment && (
                    <button type="button" onClick={handleMicClick} className={`relative flex h-8 w-8 items-center justify-center rounded-full border transition ${isRecording ? "border-red-400 text-red-400" : "border-white/20 text-white/50 hover:text-white hover:border-white/50"}`}>
                      {isRecording && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-20" />}
                      <Mic size={15} />
                    </button>
                  )}

                  {(chatInput.trim() || fileAttachment) && (
                    <button type="button" onClick={handleSubmitMessage} disabled={isStreaming} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/80 disabled:opacity-25 disabled:cursor-not-allowed">
                      <ArrowUp size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>

      {/* SHARE MODAL */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShareModalOpen(false)} />

          {/* Modal */}
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0e1117] p-6 shadow-2xl">
            {/* Close */}
            <button onClick={() => setShareModalOpen(false)} className="absolute right-4 top-4 text-white/30 hover:text-white transition">
              <X size={16} />
            </button>

            {/* Title */}
            <div className="mb-5">
              <h2 className="text-base font-semibold text-white mb-1">Share Chat</h2>
              <p className="text-xs text-white/40">Anyone with the link can view this conversation.</p>
            </div>

            {/* Expiry picker — only show if no link yet */}
            {!shareLink && (
              <div className="mb-5">
                <p className="mb-2 text-xs font-medium text-white/50 uppercase tracking-wide">Link expires in</p>
                <div className="flex gap-2">
                  {EXPIRY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedExpiry(opt.value)}
                      className={`flex-1 rounded-xl border py-2 text-sm transition ${
                        selectedExpiry === opt.value
                          ? "border-[#31b8c6] bg-[#31b8c6]/10 text-[#31b8c6]"
                          : "border-white/10 text-white/40 hover:border-white/20 hover:text-white/70"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Generated link */}
            {shareLink && (
              <div className="mb-5">
                <p className="mb-2 text-xs font-medium text-white/50 uppercase tracking-wide">Share link</p>
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <LinkIcon size={13} className="shrink-0 text-white/30" />
                  <span className="flex-1 truncate text-xs text-white/70">{shareLink}</span>
                </div>
                {shareExpiry && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-white/30">
                    <Clock size={11} />
                    <span>Expires {new Date(shareExpiry).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {!shareLink ? (
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={isSharing}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#31b8c6] px-4 py-2.5 text-sm font-medium text-black hover:bg-[#31b8c6]/80 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSharing ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                  ) : (
                    <Share2 size={14} />
                  )}
                  {isSharing ? "Creating..." : "Create Link"}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#31b8c6] px-4 py-2.5 text-sm font-medium text-black hover:bg-[#31b8c6]/80 transition"
                  >
                    {isCopied ? <Check size={14} /> : <Copy size={14} />}
                    {isCopied ? "Copied!" : "Copy Link"}
                  </button>
                  <button
                    type="button"
                    onClick={handleRevoke}
                    disabled={isRevoking}
                    className="flex items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-400/10 transition disabled:opacity-50"
                  >
                    {isRevoking ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-400/30 border-t-red-400" /> : <X size={14} />}
                    {isRevoking ? "Revoking..." : "Revoke"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* USER SETTINGS MODAL */}
      {settingsOpen && <UserSettings onClose={() => setSettingsOpen(false)} />}
    </main>
  );
};

export default Dashboard;