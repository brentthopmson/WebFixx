"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faPaperPlane,
  faWallet,
  faFolder,
  faUserGear,
  faBug,
  faCircleQuestion,
  faHeadset,
  faSpinner,
  faExclamationTriangle,
  faTicketAlt,
} from "@fortawesome/free-solid-svg-icons";
import { faTelegram } from "@fortawesome/free-brands-svg-icons";
import { useAppState } from "../context/AppContext";
import { securedApi } from "../../utils/auth";
import { rowsToObjects } from "../utils/rows";

// ---- Types ----
type Topic = "campaigns" | "billing" | "projects" | "account" | "technical" | "general";
type ChatState = "closed" | "topic-select" | "chatting" | "ticket-form";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  ts: string;
}

interface TopicConfig {
  key: Topic;
  label: string;
  icon: any;
  color: string;
  bgColor: string;
  subCategories: { value: string; label: string }[];
}

interface UserContext {
  username: string;
  email: string;
  plan: string;
  planExpiry: string;
  balance: string;
  pendingBalance: string;
  campaignCount: number;
  activeCampaigns: number;
  projectCount: number;
}

// ---- Topic Configs ----
const TOPICS: TopicConfig[] = [
  {
    key: "campaigns",
    label: "Campaigns",
    icon: faPaperPlane,
    color: "text-blue-600",
    bgColor: "bg-blue-50 hover:bg-blue-100 border-blue-200",
    subCategories: [
      { value: "campaign_stuck", label: "Campaign Stuck" },
      { value: "campaign_failed", label: "Campaign Failed" },
      { value: "campaign_limit", label: "Campaign Limit" },
      { value: "campaign_paused", label: "Campaign Paused" },
      { value: "enrich_error", label: "Enrichment Error" },
      { value: "validate_error", label: "Validation Error" },
      { value: "other", label: "Other" },
    ],
  },
  {
    key: "billing",
    label: "Wallet & Billing",
    icon: faWallet,
    color: "text-green-600",
    bgColor: "bg-green-50 hover:bg-green-100 border-green-200",
    subCategories: [
      { value: "deposit_pending", label: "Deposit Pending" },
      { value: "withdrawal_failed", label: "Withdrawal Failed" },
      { value: "balance_incorrect", label: "Balance Incorrect" },
      { value: "plan_upgrade", label: "Plan Upgrade" },
      { value: "payment_issue", label: "Payment Issue" },
    ],
  },
  {
    key: "projects",
    label: "Projects",
    icon: faFolder,
    color: "text-purple-600",
    bgColor: "bg-purple-50 hover:bg-purple-100 border-purple-200",
    subCategories: [
      { value: "project_not_working", label: "Project Not Working" },
      { value: "no_responses", label: "No Responses" },
      { value: "template_issue", label: "Template Issue" },
      { value: "project_expired", label: "Project Expired" },
    ],
  },
  {
    key: "account",
    label: "Account",
    icon: faUserGear,
    color: "text-orange-600",
    bgColor: "bg-orange-50 hover:bg-orange-100 border-orange-200",
    subCategories: [
      { value: "password_reset", label: "Password Reset" },
      { value: "2fa_issue", label: "2FA Issue" },
      { value: "api_key", label: "API Key" },
      { value: "login_issue", label: "Login Issue" },
      { value: "account_suspended", label: "Account Suspended" },
    ],
  },
  {
    key: "technical",
    label: "Technical Issue",
    icon: faBug,
    color: "text-red-600",
    bgColor: "bg-red-50 hover:bg-red-100 border-red-200",
    subCategories: [
      { value: "bug_report", label: "Bug Report" },
      { value: "feature_request", label: "Feature Request" },
      { value: "system_error", label: "System Error" },
      { value: "performance_issue", label: "Performance Issue" },
    ],
  },
  {
    key: "general",
    label: "General",
    icon: faCircleQuestion,
    color: "text-gray-600",
    bgColor: "bg-gray-50 hover:bg-gray-100 border-gray-200",
    subCategories: [
      { value: "question", label: "Question" },
      { value: "feedback", label: "Feedback" },
      { value: "partnership", label: "Partnership" },
      { value: "other", label: "Other" },
    ],
  },
];

// ---- Topic-Scoped Knowledge Base ----
const KB_SECTIONS: Record<Topic, string> = {
  campaigns: `### CAMPAIGNS
Pipeline: VALIDATE → ENRICH → PERSONALIZE → EXECUTE → INTERACT
Status: staged, running, processing, paused, completed, failed, "Limit Reached"
Errors: "fetch failed"=browser error, 429=rate limited, stops after enrich=check personalize, no emails=check SMTP/limit
Settings keys: channel, fileUrl, userId, accounts, wireAccount, platform, validationStatus, enrichmentStatus`,

  billing: `### WALLET & BILLING
Fields: balance, pendingBalance, btcAddress, ethAddress, usdtAddress
Deposit: send crypto to displayed address. Withdraw: enter amount + destination
Transactions sheet tracks all deposit/withdrawal records`,

  projects: `### PROJECTS
Sheet columns: projectId, userId, projectTitle, templateType, telegramGroupId, response
Template types: COOKIE. Response stored in sheet or Google Drive if >45KB`,

  account: `### USER ACCOUNT
Sheet columns: userId, email, username, role, plan, planExpiry, balance, pendingBalance, twoFactorAuth, apiToken
Roles: USER, ADMIN. Plans: Free, Basic, Pro, Enterprise`,

  technical: `### TECHNICAL
For bugs: ask for campaignId/projectId, gather error details, raise ticket
System errors may relate to pipeline stages, SMTP, or browser automation`,

  general: `### GENERAL
WebFixx is an outreach platform with campaigns, projects, wallet, and user management
Use tickets for issues requiring backend investigation`,
};

const RESPONSE_RULES = `### RULES
- Only use confirmed facts. If unsure: "I'll check with our team" + offer ticket
- Never guess IDs/statuses/errors. Ask for campaignId/projectId for bugs
- If user says "raise ticket" or "I need help", respond with ESCALATE_TICKET
- Always offer ticket for issues needing backend investigation`;

// ---- Helpers ----
function isComplexQuery(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes("error") || lower.includes("bug") || lower.includes("fail") ||
    lower.includes("stuck") || lower.includes("pipeline") || lower.includes("campaign") ||
    lower.includes("project") || lower.includes("ticket") || lower.split(" ").length > 8;
}

function buildUserContextBlock(ctx: UserContext | null, fallback: any): string {
  const u = (ctx || {}) as UserContext;
  const fb = fallback || {};
  return `## User Context
- User: ${u.username || fb.username || "User"} (${u.email || fb.email || ""})
- Plan: ${u.plan || fb.plan || "free"}
- Balance: $${u.balance || fb.balance || "0"}
- Active Campaigns: ${u.activeCampaigns || 0}
- Projects: ${u.projectCount || 0}`;
}

// ---- SubCategory type for ticket form ----
interface TicketFormData {
  subject: string;
  description: string;
  subCategory: string;
  entityId: string;
  priority: "low" | "medium" | "high" | "urgent";
}

export default function ChatBot() {
  const appData = useAppState();
  const [chatState, setChatState] = useState<ChatState>("closed");
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(true);
  const [ticketForm, setTicketForm] = useState<TicketFormData>({
    subject: "",
    description: "",
    subCategory: "",
    entityId: "",
    priority: "medium",
  });
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketResult, setTicketResult] = useState<string | null>(null);
  const [userContext, setUserContext] = useState<UserContext | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const userData = (appData as any)?.user || (appData as any)?.appData?.user;
  const userId = userData?.userId || "";

  // ---- Scroll to bottom ----
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ---- Extract Telegram settings from appData (already loaded) ----
  const settingsRows = useMemo(() => {
    const s = (appData as any)?.appData?.data?.settings;
    if (!s?.data || !Array.isArray(s.data)) return [];
    return rowsToObjects(s.headers || [], s.data);
  }, [appData]);

  const telegramLink = useMemo(() => {
    const row = settingsRows.find((r: any) => r.settingsKey === "webFixxTelegramGroup");
    return row?.settingsValue1 || "";
  }, [settingsRows]);

  const telegramUsername = useMemo(() => {
    const row = settingsRows.find((r: any) => r.settingsKey === "webFixxTelegramUsername");
    return row?.settingsValue1 || "";
  }, [settingsRows]);

  // ---- Load chat context + user context (needs userId) ----
  useEffect(() => {
    if (chatState === "closed" || !userId) return;

    const loadUserData = async () => {
      try {
        const [chatResult, ctxResult] = await Promise.all([
          securedApi.callBackendFunction({ functionName: "getChatContext", userId }),
          securedApi.callBackendFunction({ functionName: "getUserSupportContext", userId }),
        ]);

        if (chatResult?.success && (chatResult as any)?.chat?.lastMessages?.length > 0) {
          setMessages((chatResult as any).chat.lastMessages);
          if ((chatResult as any).chat.lastTopic) setSelectedTopic((chatResult as any).chat.lastTopic as Topic);
        }

        if (ctxResult?.success) {
          setUserContext(ctxResult as any);
        }
      } catch (e) {
        console.error("[ChatBot] Failed to load user data:", e);
      }
    };

    loadUserData();
  }, [chatState, userId]);

  // ---- Save chat context ----
  const saveChatContext = useCallback(async (topic: Topic, msgs: ChatMessage[]) => {
    if (!userId) return;
    try {
      await securedApi.callBackendFunction({
        functionName: "saveChatContext",
        userId,
        lastTopic: topic,
        lastMessages: msgs.slice(-20),
      });
    } catch (e) {
      console.error("[ChatBot] Failed to save chat:", e);
    }
  }, [userId]);

  // ---- Build system prompt (topic-scoped) ----
  const buildSystemPrompt = useCallback((topic: Topic | null): string => {
    const topicKey = topic || "general";
    const kb = KB_SECTIONS[topicKey] || KB_SECTIONS.general;
    const userBlock = buildUserContextBlock(userContext, userData);
    return `${kb}\n\n${RESPONSE_RULES}\n\n${userBlock}\n\nTopic: ${topicKey}`;
  }, [userContext, userData]);

  // ---- Send message to AI ----
  const sendMessage = async () => {
    if (!inputValue.trim() || isTyping) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: inputValue.trim(),
      ts: new Date().toISOString(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputValue("");
    setIsTyping(true);

    try {
      const systemPrompt = buildSystemPrompt(selectedTopic);
      const aiResponse = await callAI(systemPrompt, newMessages);

      if (!aiResponse) {
        setAiAvailable(false);
        const fallbackMsg: ChatMessage = {
          role: "assistant",
          content: "Our AI support is temporarily unavailable. I can help you raise a support ticket instead, or you can join our Telegram group for immediate assistance.",
          ts: new Date().toISOString(),
        };
        const withFallback = [...newMessages, fallbackMsg];
        setMessages(withFallback);
        saveChatContext(selectedTopic || "general", withFallback);
        return;
      }

      // Check for escalation
      if (aiResponse.includes("ESCALATE_TICKET")) {
        const cleanResponse = aiResponse.replace("ESCALATE_TICKET", "").trim();
        const escalationMsg: ChatMessage = {
          role: "assistant",
          content: cleanResponse || "Let me help you raise a support ticket for this issue.",
          ts: new Date().toISOString(),
        };
        const withEscalation = [...newMessages, escalationMsg];
        setMessages(withEscalation);
        setTicketForm((prev) => ({
          ...prev,
          subject: inputValue.trim().slice(0, 100),
          description: inputValue.trim(),
        }));
        setChatState("ticket-form");
        saveChatContext(selectedTopic || "general", withEscalation);
        return;
      }

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: aiResponse,
        ts: new Date().toISOString(),
      };
      const withAssistant = [...newMessages, assistantMsg];
      setMessages(withAssistant);
      saveChatContext(selectedTopic || "general", withAssistant);
    } catch (e) {
      console.error("[ChatBot] AI call failed:", e);
      setAiAvailable(false);
      const errorMsg: ChatMessage = {
        role: "assistant",
        content: "Sorry, something went wrong. Would you like to raise a support ticket?",
        ts: new Date().toISOString(),
      };
      setMessages([...newMessages, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  // ---- Call AI provider (dynamic history window) ----
  const callAI = async (systemPrompt: string, chatMessages: ChatMessage[]): Promise<string | null> => {
    try {
      const apiKey = typeof window !== "undefined" ? localStorage.getItem("openrouter_key") : null;

      // Dynamic history: simple queries get fewer messages
      const lastMsg = chatMessages[chatMessages.length - 1];
      const historyLimit = lastMsg && isComplexQuery(lastMsg.content) ? 10 : 3;

      const formattedMessages = [
        { role: "system", content: systemPrompt },
        ...chatMessages.slice(-historyLimit).map((m) => ({ role: m.role, content: m.content })),
      ];

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey || ""}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-001",
          messages: formattedMessages,
          max_tokens: 1024,
          temperature: 0.3,
        }),
      });

      if (!response.ok) return null;

      const data = await response.json();
      return data?.choices?.[0]?.message?.content || null;
    } catch (e) {
      console.error("[ChatBot] AI provider error:", e);
      return null;
    }
  };

  // ---- Submit ticket ----
  const submitTicket = async () => {
    if (!ticketForm.subject.trim() || !ticketForm.description.trim() || !userId) return;

    setTicketSubmitting(true);
    try {
      const result = await securedApi.callBackendFunction({
        functionName: "createTicket",
        userId,
        username: userData?.username || "",
        email: userData?.email || "",
        category: selectedTopic || "general",
        subCategory: ticketForm.subCategory || "",
        entityId: ticketForm.entityId || "",
        messages: messages.map((m) => ({ role: m.role, content: m.content, ts: m.ts })),
        amount: "",
        reference: ticketForm.entityId || "",
      });

      if (result?.success) {
        setTicketResult((result as any).supportId);
        setMessages([]);
        setTimeout(() => {
          setChatState("chatting");
          setTicketResult(null);
          setTicketForm({ subject: "", description: "", subCategory: "", entityId: "", priority: "medium" });
        }, 3000);
      }
    } catch (e) {
      console.error("[ChatBot] Ticket submission failed:", e);
    } finally {
      setTicketSubmitting(false);
    }
  };

  // ---- Topic select ----
  const selectTopic = (topic: Topic) => {
    setSelectedTopic(topic);
    setChatState("chatting");
    if (messages.length === 0) {
      const welcomeMsg: ChatMessage = {
        role: "assistant",
        content: `Hi! I'm here to help with ${TOPICS.find((t) => t.key === topic)?.label || topic} questions. What can I assist you with?`,
        ts: new Date().toISOString(),
      };
      setMessages([welcomeMsg]);
    }
  };

  // ---- Render: Closed state (floating button) ----
  if (chatState === "closed") {
    return (
      <button
        onClick={() => setChatState("topic-select")}
        className="fixed bottom-4 right-4 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-all duration-200 z-50 lg:bottom-8 lg:right-8 dark:bg-blue-700 dark:hover:bg-blue-800"
        aria-label="Open support chat"
      >
        <FontAwesomeIcon icon={faHeadset} className="w-6 h-6" />
      </button>
    );
  }

  // ---- Render: Main chat window ----
  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50 lg:bg-opacity-0 lg:pointer-events-none dark:bg-opacity-75"
        onClick={() => setChatState("closed")}
      />

      {/* Chat Window */}
      <div className="fixed bottom-0 right-0 w-full h-[85vh] bg-white shadow-2xl rounded-t-2xl z-50 flex flex-col transition-all duration-300 ease-in-out lg:bottom-24 lg:right-8 lg:w-96 lg:h-[600px] lg:rounded-2xl dark:bg-gray-800 dark:shadow-none">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={faHeadset} className="text-blue-600 dark:text-blue-400" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
              {chatState === "topic-select"
                ? "How can we help?"
                : chatState === "ticket-form"
                ? "Raise Support Ticket"
                : TOPICS.find((t) => t.key === selectedTopic)?.label || "Support"}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            {chatState === "chatting" && (
              <button
                onClick={() => {
                  setTicketForm((prev) => ({
                    ...prev,
                    subject: messages[messages.length - 1]?.content?.slice(0, 100) || "",
                    description: messages.map((m) => `${m.role}: ${m.content}`).join("\n"),
                  }));
                  setChatState("ticket-form");
                }}
                className="p-2 text-gray-500 hover:text-orange-600 rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:text-orange-400 dark:hover:bg-gray-700"
                title="Raise ticket"
              >
                <FontAwesomeIcon icon={faTicketAlt} className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setChatState("closed")}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700"
              aria-label="Close chat"
            >
              <FontAwesomeIcon icon={faTimes} className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Topic Select */}
          {chatState === "topic-select" && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {TOPICS.map((topic) => (
                  <button
                    key={topic.key}
                    onClick={() => selectTopic(topic.key)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${topic.bgColor} dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600`}
                  >
                    <FontAwesomeIcon icon={topic.icon} className={`text-2xl ${topic.color}`} />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{topic.label}</span>
                  </button>
                ))}
              </div>

              {/* Telegram links */}
              {(telegramUsername || telegramLink) && (
                <div className="border-t dark:border-gray-700 pt-4 space-y-2">
                  {telegramUsername && (
                    <a
                      href={`https://t.me/${telegramUsername.replace("@", "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors"
                    >
                      <FontAwesomeIcon icon={faTelegram} />
                      Contact {telegramUsername}
                    </a>
                  )}
                  {telegramLink && (
                    <a
                      href={telegramLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      <FontAwesomeIcon icon={faTelegram} />
                      Join Group
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Ticket Form */}
          {chatState === "ticket-form" && (
            <div className="p-4 space-y-4">
              {ticketResult ? (
                <div className="text-center py-8">
                  <FontAwesomeIcon icon={faTicketAlt} className="text-4xl text-green-600 mb-3" />
                  <p className="text-lg font-semibold text-gray-800 dark:text-white">Ticket Created!</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{ticketResult}</p>
                </div>
              ) : (
                <>
                  {/* AI unavailable banner */}
                  {!aiAvailable && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-200">
                      <FontAwesomeIcon icon={faExclamationTriangle} className="mr-2" />
                      AI support is temporarily unavailable. Submit your query directly.
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
                    <input
                      type="text"
                      value={ticketForm.subject}
                      onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="Brief description of your issue"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                    <select
                      value={ticketForm.subCategory}
                      onChange={(e) => setTicketForm({ ...ticketForm, subCategory: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="">Select issue type</option>
                      {TOPICS.find((t) => t.key === selectedTopic)?.subCategories.map((sc) => (
                        <option key={sc.value} value={sc.value}>
                          {sc.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                    <textarea
                      value={ticketForm.description}
                      onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                      rows={4}
                      className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="Describe your issue in detail"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Entity ID <span className="text-gray-400">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={ticketForm.entityId}
                      onChange={(e) => setTicketForm({ ...ticketForm, entityId: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="Campaign ID, Project ID, etc."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                    <select
                      value={ticketForm.priority}
                      onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value as TicketFormData["priority"] })}
                      className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <button
                    onClick={submitTicket}
                    disabled={ticketSubmitting || !ticketForm.subject.trim() || !ticketForm.description.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                  >
                    {ticketSubmitting ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faTicketAlt} />
                        Submit Ticket
                      </>
                    )}
                  </button>

                  {/* Telegram fallback */}
                  {(telegramUsername || telegramLink) && (
                    <div className="text-center pt-2 border-t dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Or reach us directly:</p>
                      <div className="flex flex-col items-center gap-2">
                        {telegramUsername && (
                          <a
                            href={`https://t.me/${telegramUsername.replace("@", "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg flex items-center gap-2 transition-colors"
                          >
                            <FontAwesomeIcon icon={faTelegram} />
                            Contact {telegramUsername}
                          </a>
                        )}
                        {telegramLink && (
                          <a
                            href={telegramLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 underline"
                          >
                            Join Group
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Chat Messages */}
          {chatState === "chatting" && (
            <div className="flex flex-col gap-3 p-4">
              {!aiAvailable && (
                <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-2 text-xs text-yellow-800 dark:text-yellow-200 text-center">
                  AI unavailable — <button onClick={() => setChatState("ticket-form")} className="underline font-medium">raise a ticket</button>
                  {telegramUsername && (
                    <> or{" "}
                      <a
                        href={`https://t.me/${telegramUsername.replace("@", "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline font-medium"
                      >
                        contact {telegramUsername}
                      </a>
                    </>
                  )}
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-2 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white rounded-br-sm"
                        : msg.role === "system"
                        ? "bg-green-50 text-green-800 border border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-700"
                        : "bg-gray-100 text-gray-800 rounded-bl-sm dark:bg-gray-700 dark:text-gray-200"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-xl px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                    Thinking...
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Bar (chatting state only) */}
        {chatState === "chatting" && (
          <div className="p-3 border-t dark:border-gray-700 shrink-0">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Type your message..."
                className="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-blue-400"
                disabled={isTyping}
              />
              <button
                onClick={sendMessage}
                disabled={!inputValue.trim() || isTyping}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white p-2 rounded-full transition-colors duration-200"
              >
                <FontAwesomeIcon icon={faPaperPlane} className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
