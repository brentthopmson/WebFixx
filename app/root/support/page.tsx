"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHeadset,
  faPaperPlane,
  faSpinner,
  faWallet,
  faFolder,
  faUserGear,
  faBug,
  faCircleQuestion,
  faTicketAlt,
} from "@fortawesome/free-solid-svg-icons";
import { faTelegram } from "@fortawesome/free-brands-svg-icons";
import { useAppState } from "../../context/AppContext";
import { securedApi } from "../../../utils/auth";
import { rowsToObjects } from "../../utils/rows";

type Topic = "campaigns" | "billing" | "projects" | "account" | "technical" | "general";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  ts: string;
}

interface UserContext {
  username: string;
  email: string;
  plan: string;
  balance: string;
  activeCampaigns: number;
  projectCount: number;
}

const TOPICS: { key: Topic; label: string; icon: any; color: string; bgColor: string }[] = [
  { key: "campaigns", label: "Campaigns", icon: faTicketAlt, color: "text-blue-600", bgColor: "bg-blue-50 hover:bg-blue-100 border-blue-200" },
  { key: "billing", label: "Wallet & Billing", icon: faWallet, color: "text-green-600", bgColor: "bg-green-50 hover:bg-green-100 border-green-200" },
  { key: "projects", label: "Projects", icon: faFolder, color: "text-purple-600", bgColor: "bg-purple-50 hover:bg-purple-100 border-purple-200" },
  { key: "account", label: "Account", icon: faUserGear, color: "text-orange-600", bgColor: "bg-orange-50 hover:bg-orange-100 border-orange-200" },
  { key: "technical", label: "Technical Issue", icon: faBug, color: "text-red-600", bgColor: "bg-red-50 hover:bg-red-100 border-red-200" },
  { key: "general", label: "General", icon: faCircleQuestion, color: "text-gray-600", bgColor: "bg-gray-50 hover:bg-gray-100 border-gray-200" },
];

const KB_SECTIONS: Record<Topic, string> = {
  campaigns: "Pipeline: VALIDATE → ENRICH → PERSONALIZE → EXECUTE → INTERACT. Status: staged, running, processing, paused, completed, failed.",
  billing: "Fields: balance, pendingBalance, btcAddress, ethAddress, usdtAddress. Deposit: send crypto. Withdraw: enter amount + destination.",
  projects: "Sheet: projectId, userId, projectTitle, templateType, telegramGroupId, response. Template types: COOKIE.",
  account: "Sheet: userId, email, username, role, plan, planExpiry, balance, twoFactorAuth. Roles: USER, ADMIN. Plans: Free, Basic, Pro, Enterprise.",
  technical: "For bugs: ask for campaignId/projectId, gather error details, raise ticket. System errors: pipeline stages, SMTP, browser automation.",
  general: "WebFixx: outreach platform with campaigns, projects, wallet, user management. Use tickets for backend investigation.",
};

const RESPONSE_RULES = `Rules:
- Only use confirmed facts. If unsure: "I'll check with our team" + offer ticket
- Never guess IDs/statuses/errors. Ask for campaignId/projectId for bugs
- If user says "raise ticket" or "I need help", respond with ESCALATE_TICKET
- Always offer ticket for issues needing backend investigation`;

function isComplexQuery(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes("error") || lower.includes("bug") || lower.includes("fail") ||
    lower.includes("stuck") || lower.includes("pipeline") || lower.includes("campaign") ||
    lower.includes("project") || lower.includes("ticket") || lower.split(" ").length > 8;
}

export default function AdminAIChat() {
  const appData = useAppState();
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const userData = (appData as any)?.user || (appData as any)?.appData?.user;

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [selectedTopic]);

  const selectTopic = (topic: Topic) => {
    setSelectedTopic(topic);
    if (messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: `Hi! I'm the admin support assistant. How can I help with ${TOPICS.find((t) => t.key === topic)?.label || topic}?`,
        ts: new Date().toISOString(),
      }]);
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isTyping || !selectedTopic) return;
    const userMsg: ChatMessage = { role: "user", content: inputValue.trim(), ts: new Date().toISOString() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputValue("");
    setIsTyping(true);

    try {
      const systemPrompt = `You are a WebFixx admin support assistant. Topic: ${selectedTopic}\n\n${KB_SECTIONS[selectedTopic]}\n\n${RESPONSE_RULES}`;
      const aiResponse = await callAI(systemPrompt, newMessages);

      if (!aiResponse) {
        setMessages([...newMessages, { role: "assistant", content: "Sorry, I couldn't process that. Please try again.", ts: new Date().toISOString() }]);
      } else if (aiResponse.includes("ESCALATE_TICKET")) {
        const clean = aiResponse.replace("ESCALATE_TICKET", "").trim();
        setMessages([...newMessages, { role: "assistant", content: clean || "Let me help you raise a support ticket.", ts: new Date().toISOString() }]);
      } else {
        setMessages([...newMessages, { role: "assistant", content: aiResponse, ts: new Date().toISOString() }]);
      }
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Something went wrong. Please try again.", ts: new Date().toISOString() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const callAI = async (systemPrompt: string, chatMessages: ChatMessage[]): Promise<string | null> => {
    try {
      const apiKey = typeof window !== "undefined" ? localStorage.getItem("openrouter_key") : null;
      const lastMsg = chatMessages[chatMessages.length - 1];
      const historyLimit = lastMsg && isComplexQuery(lastMsg.content) ? 10 : 3;
      const formattedMessages = [
        { role: "system", content: systemPrompt },
        ...chatMessages.slice(-historyLimit).map((m) => ({ role: m.role, content: m.content })),
      ];
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey || ""}` },
        body: JSON.stringify({ model: "google/gemini-2.0-flash-001", messages: formattedMessages, max_tokens: 1024, temperature: 0.3 }),
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data?.choices?.[0]?.message?.content || null;
    } catch {
      return null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col">
      <div className="p-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800 rounded-t-xl shrink-0">
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={faHeadset} className="text-blue-600 dark:text-blue-400" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">AI Support Chat</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-800 p-4 space-y-4">
        {!selectedTopic ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Select a topic to start:</p>
            <div className="grid grid-cols-2 gap-3">
              {TOPICS.map((topic) => (
                <button
                  key={topic.key}
                  onClick={() => selectTopic(topic.key)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${topic.bgColor} dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600`}
                >
                  <FontAwesomeIcon icon={topic.icon} className={`text-2xl ${topic.color}`} />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{topic.label}</span>
                </button>
              ))}
            </div>
            {(telegramUsername || telegramLink) && (
              <div className="border-t dark:border-gray-700 pt-4 space-y-2">
                {telegramUsername && (
                  <a href={`https://t.me/${telegramUsername.replace("@", "")}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors">
                    <FontAwesomeIcon icon={faTelegram} /> Contact {telegramUsername}
                  </a>
                )}
                {telegramLink && (
                  <a href={telegramLink} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400">
                    <FontAwesomeIcon icon={faTelegram} /> Join Group
                  </a>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-md"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-md"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2.5 rounded-2xl rounded-bl-md">
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin text-gray-400" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {selectedTopic && (
        <div className="p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-800 rounded-b-xl shrink-0">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2.5 rounded-xl border dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={sendMessage}
              disabled={!inputValue.trim() || isTyping}
              className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-colors"
            >
              <FontAwesomeIcon icon={faPaperPlane} className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
