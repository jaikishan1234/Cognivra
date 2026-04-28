import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { updateUser } from "../../auth/auth.slice.js";
import { updateUsername, updatePassword } from "../../auth/service/auth.api";
import { toast } from "sonner";
import { X, User, Lock, Settings, Check } from "lucide-react";

const MODELS = [
  { value: "mistral", label: "Mistral" },
  { value: "gemini", label: "Gemini" },
  { value: "groq", label: "Groq" },
  { value: "deepseek", label: "DeepSeek" },
];

const loadDefaultModel = () => {
  try {
    return localStorage.getItem("cognivra_default_model") || "mistral";
  } catch {
    return "mistral";
  }
};

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "security", label: "Security", icon: Lock },
  { id: "preferences", label: "Preferences", icon: Settings },
];

const UserSettings = ({ onClose }) => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);

  const [activeTab, setActiveTab] = useState("profile");

  const [newUsername, setNewUsername] = useState(user?.username || "");
  const [isSavingUser, setIsSavingUser] = useState(false);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPass, setIsSavingPass] = useState(false);

  const [defaultModel, setDefaultModel] = useState(loadDefaultModel);
  const [modelSaved, setModelSaved] = useState(false);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleUpdateUsername = async () => {
    if (!newUsername.trim() || newUsername.trim() === user?.username) return;
    setIsSavingUser(true);
    try {
      const data = await updateUsername({ newUsername: newUsername.trim() });
      dispatch(updateUser({ username: data.user.username }));
      toast.success("Username updated!");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update username");
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setIsSavingPass(true);
    try {
      await updatePassword({ oldPassword, newPassword });
      toast.success("Password updated!");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update password");
    } finally {
      setIsSavingPass(false);
    }
  };

  const handleSaveModel = (value) => {
    setDefaultModel(value);
    localStorage.setItem("cognivra_default_model", value);
    setModelSaved(true);
    toast.success(
      `Default model set to ${MODELS.find((m) => m.value === value)?.label}`,
    );
    setTimeout(() => setModelSaved(false), 2000);
  };

  const inputClass =
    "w-full rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 px-3 py-2.5 text-sm text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-white/25 focus:border-[#31b8c6]/50 focus:bg-[#31b8c6]/5 transition";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#0e1117] shadow-2xl overflow-hidden transition-colors duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-white/5">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
              Settings
            </h2>
            <p className="text-xs text-zinc-400 dark:text-white/30 mt-0.5">
              {user?.email}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 dark:text-white/30 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition"
          >
            <X size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-100 dark:border-white/5 px-5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition mr-1 ${
                  activeTab === tab.id
                    ? "border-[#31b8c6] text-[#31b8c6]"
                    : "border-transparent text-zinc-400 dark:text-white/40 hover:text-zinc-600 dark:hover:text-white/70"
                }`}
              >
                <Icon size={12} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="p-5 space-y-4">
          {/* ── Profile tab ── */}
          {activeTab === "profile" && (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-white/10 text-lg font-semibold text-zinc-700 dark:text-white uppercase">
                  {user?.username?.[0] || "U"}
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">
                    {user?.username}
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-white/30">
                    Free Plan
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-white/50">
                  Username
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUpdateUsername()}
                  placeholder="Enter new username"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-white/50">
                  Email{" "}
                  <span className="text-zinc-300 dark:text-white/20 font-normal">
                    (cannot be changed)
                  </span>
                </label>
                <input
                  type="email"
                  value={user?.email || ""}
                  readOnly
                  className={`${inputClass} opacity-40 cursor-not-allowed`}
                />
              </div>

              <button
                type="button"
                onClick={handleUpdateUsername}
                disabled={
                  isSavingUser ||
                  !newUsername.trim() ||
                  newUsername.trim() === user?.username
                }
                className="w-full rounded-xl bg-[#31b8c6] py-2.5 text-sm font-medium text-black hover:bg-[#31b8c6]/80 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSavingUser ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                    Saving...
                  </span>
                ) : (
                  "Save Username"
                )}
              </button>
            </>
          )}

          {/* ── Security tab ── */}
          {activeTab === "security" && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-white/50">
                  Current Password
                </label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Enter current password"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-white/50">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-white/50">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUpdatePassword()}
                  placeholder="Confirm new password"
                  className={inputClass}
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">
                    Passwords do not match
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleUpdatePassword}
                disabled={isSavingPass}
                className="w-full rounded-xl bg-[#31b8c6] py-2.5 text-sm font-medium text-black hover:bg-[#31b8c6]/80 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSavingPass ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                    Updating...
                  </span>
                ) : (
                  "Update Password"
                )}
              </button>
            </>
          )}

          {/* ── Preferences tab ── */}
          {activeTab === "preferences" && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-white/50">
                  Default AI Model
                </label>
                <p className="mb-3 text-xs text-zinc-400 dark:text-white/25">
                  This model will be pre-selected whenever you start a new chat.
                </p>

                <div className="space-y-2">
                  {MODELS.map((model) => (
                    <button
                      key={model.value}
                      type="button"
                      onClick={() => handleSaveModel(model.value)}
                      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${
                        defaultModel === model.value
                          ? "border-[#31b8c6] bg-[#31b8c6]/10 text-[#31b8c6]"
                          : "border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-white/50 hover:border-zinc-300 dark:hover:border-white/20 hover:text-zinc-800 dark:hover:text-white"
                      }`}
                    >
                      {model.label}
                      {defaultModel === model.value && <Check size={13} />}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserSettings;
