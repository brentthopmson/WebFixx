"use client";

import { useState, useEffect, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTicketAlt,
  faSpinner,
  faRefresh,
  faChevronDown,
  faChevronUp,
  faPaperPlane,
  faWallet,
  faFolder,
  faUserGear,
  faBug,
  faCircleQuestion,
} from "@fortawesome/free-solid-svg-icons";
import { securedApi } from "../../../../utils/auth";
import { useAppState } from "../../../context/AppContext";

interface Ticket {
  supportId: string;
  timestamp: string;
  category: string;
  subCategory: string;
  entityId: string;
  messages: Array<{ role: string; content: string; ts: string }>;
  updatedOn: string;
  status: string;
}

const CATEGORY_ICONS: Record<string, any> = {
  campaigns: faPaperPlane,
  billing: faWallet,
  projects: faFolder,
  account: faUserGear,
  technical: faBug,
  general: faCircleQuestion,
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  closed: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
};

const SUBCATEGORY_LABELS: Record<string, string> = {
  campaign_stuck: "Campaign Stuck",
  campaign_failed: "Campaign Failed",
  campaign_limit: "Campaign Limit",
  campaign_paused: "Campaign Paused",
  enrich_error: "Enrichment Error",
  validate_error: "Validation Error",
  deposit_pending: "Deposit Pending",
  withdrawal_failed: "Withdrawal Failed",
  balance_incorrect: "Balance Incorrect",
  plan_upgrade: "Plan Upgrade",
  payment_issue: "Payment Issue",
  project_not_working: "Project Not Working",
  no_responses: "No Responses",
  template_issue: "Template Issue",
  project_expired: "Project Expired",
  password_reset: "Password Reset",
  "2fa_issue": "2FA Issue",
  api_key: "API Key",
  login_issue: "Login Issue",
  account_suspended: "Account Suspended",
  bug_report: "Bug Report",
  feature_request: "Feature Request",
  system_error: "System Error",
  performance_issue: "Performance Issue",
  question: "Question",
  feedback: "Feedback",
  partnership: "Partnership",
  other: "Other",
};

export default function SupportHistory() {
  const appData = useAppState();
  const userId = (appData as any)?.appData?.user?.userId || (appData as any)?.user?.userId || "";
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const fetchTickets = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const result = await securedApi.callBackendFunction({
        functionName: "getTickets",
        userId,
      });
      if (result?.success) {
        setTickets((result as any).tickets || []);
      }
    } catch (e) {
      console.error("[SupportHistory] Failed to fetch tickets:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [userId]);

  const handleReply = async (ticket: Ticket) => {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    try {
      const updatedMessages = [
        ...(ticket.messages || []),
        { role: "user", content: newMessage.trim(), ts: new Date().toISOString() },
      ];
      const result = await securedApi.callBackendFunction({
        functionName: "updateTicket",
        supportId: ticket.supportId,
        messages: updatedMessages,
      });
      if (result?.success) {
        setTickets((prev) =>
          prev.map((t) =>
            t.supportId === ticket.supportId
              ? { ...t, messages: updatedMessages, updatedOn: new Date().toISOString() }
              : t
          )
        );
        setNewMessage("");
        setReplyingTo(null);
      }
    } catch (e) {
      console.error("[SupportHistory] Reply failed:", e);
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const sortedTickets = useMemo(
    () =>
      [...tickets].sort(
        (a, b) => new Date(b.updatedOn || b.timestamp).getTime() - new Date(a.updatedOn || a.timestamp).getTime()
      ),
    [tickets]
  );

  const openCount = tickets.filter((t) => t.status === "open" || t.status === "in_progress").length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md dark:shadow-none p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Support Tickets</h2>
          {openCount > 0 && (
            <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-xs font-medium px-2 py-0.5 rounded-full">
              {openCount} open
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchTickets}
            className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Refresh"
          >
            <FontAwesomeIcon icon={faRefresh} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {loading && tickets.length === 0 ? (
        <div className="text-center py-8">
          <FontAwesomeIcon icon={faSpinner} className="animate-spin text-2xl text-blue-500 mb-2" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading tickets...</p>
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-8">
          <FontAwesomeIcon icon={faTicketAlt} className="text-3xl text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-gray-500 dark:text-gray-400">No support tickets yet</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
            Use the chat button to get help
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedTickets.map((ticket) => {
            const isExpanded = expandedTicket === ticket.supportId;
            const categoryIcon = CATEGORY_ICONS[ticket.category] || faCircleQuestion;
            const statusColor = STATUS_COLORS[ticket.status] || STATUS_COLORS.open;
            const subLabel = SUBCATEGORY_LABELS[ticket.subCategory] || ticket.subCategory;

            return (
              <div
                key={ticket.supportId}
                className="border dark:border-gray-700 rounded-lg overflow-hidden"
              >
                {/* Ticket Header */}
                <button
                  onClick={() => setExpandedTicket(isExpanded ? null : ticket.supportId)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <FontAwesomeIcon
                    icon={categoryIcon}
                    className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-800 dark:text-white truncate">
                        {ticket.supportId}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor}`}>
                        {ticket.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {subLabel} &middot; {formatDate(ticket.updatedOn || ticket.timestamp)}
                    </p>
                  </div>
                  <FontAwesomeIcon
                    icon={isExpanded ? faChevronUp : faChevronDown}
                    className="w-4 h-4 text-gray-400 shrink-0"
                  />
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t dark:border-gray-700 p-3 space-y-3 bg-gray-50 dark:bg-gray-800/50">
                    {/* Messages */}
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {(ticket.messages || []).map((msg, i) => (
                        <div
                          key={i}
                          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-lg px-3 py-1.5 text-xs leading-relaxed ${
                              msg.role === "user"
                                ? "bg-blue-600 text-white"
                                : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                            }`}
                          >
                            {msg.content}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Reply Input */}
                    {ticket.status !== "closed" && ticket.status !== "resolved" && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={replyingTo === ticket.supportId ? newMessage : ""}
                          onChange={(e) => {
                            setReplyingTo(ticket.supportId);
                            setNewMessage(e.target.value);
                          }}
                          onFocus={() => setReplyingTo(ticket.supportId)}
                          placeholder="Reply..."
                          className="flex-1 text-xs border rounded-lg px-3 py-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleReply(ticket);
                            }
                          }}
                          disabled={sending}
                        />
                        <button
                          onClick={() => handleReply(ticket)}
                          disabled={!newMessage.trim() || sending || replyingTo !== ticket.supportId}
                          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-3 py-1.5 rounded-lg text-xs"
                        >
                          <FontAwesomeIcon icon={faSpinner} className={sending ? "animate-spin" : ""} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
