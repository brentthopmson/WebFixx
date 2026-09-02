"use client";

import { useState, useMemo, useCallback } from "react";
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
  faReply,
  faCheckCircle,
  faTimesCircle,
} from "@fortawesome/free-solid-svg-icons";
import { securedApi } from "../../../../utils/auth";
import { useAppState } from "../../../context/AppContext";
import { rowsToObjects } from "../../../utils/rows";

interface Ticket {
  supportId: string;
  timestamp: string;
  userId: string;
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

type FilterStatus = "all" | "open" | "in_progress" | "resolved" | "closed";
type FilterCategory = "all" | "campaigns" | "billing" | "projects" | "account" | "technical" | "general";

export default function AdminSupportPanel() {
  const appData = useAppState();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterCategory, setFilterCategory] = useState<FilterCategory>("all");

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const supportData = (appData as any)?.data?.support || (appData as any)?.appData?.data?.support;
      if (supportData?.data && Array.isArray(supportData.data)) {
        const parsed = rowsToObjects(supportData.headers || [], supportData.data) as unknown as Ticket[];
        setTickets(parsed);
      }
    } catch (e) {
      console.error("[AdminSupport] Failed to load tickets:", e);
    } finally {
      setLoading(false);
    }
  }, [appData]);

  useMemo(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleReply = async (ticket: Ticket) => {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    try {
      const updatedMessages = [
        ...(ticket.messages || []),
        { role: "admin", content: newMessage.trim(), ts: new Date().toISOString() },
      ];
      const result = await securedApi.callBackendFunction({
        functionName: "updateTicket",
        supportId: ticket.supportId,
        messages: updatedMessages,
        status: "in_progress",
      });
      if (result?.success) {
        setTickets((prev) =>
          prev.map((t) =>
            t.supportId === ticket.supportId
              ? { ...t, messages: updatedMessages, updatedOn: new Date().toISOString(), status: "in_progress" }
              : t
          )
        );
        setNewMessage("");
        setReplyingTo(null);
      }
    } catch (e) {
      console.error("[AdminSupport] Reply failed:", e);
    } finally {
      setSending(false);
    }
  };

  const updateTicketStatus = async (ticket: Ticket, newStatus: string) => {
    try {
      const result = await securedApi.callBackendFunction({
        functionName: "updateTicket",
        supportId: ticket.supportId,
        status: newStatus,
      });
      if (result?.success) {
        setTickets((prev) =>
          prev.map((t) =>
            t.supportId === ticket.supportId
              ? { ...t, status: newStatus, updatedOn: new Date().toISOString() }
              : t
          )
        );
      }
    } catch (e) {
      console.error("[AdminSupport] Status update failed:", e);
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

  const filteredTickets = useMemo(() => {
    return tickets
      .filter((t) => filterStatus === "all" || t.status === filterStatus)
      .filter((t) => filterCategory === "all" || t.category === filterCategory)
      .sort(
        (a, b) =>
          new Date(b.updatedOn || b.timestamp).getTime() -
          new Date(a.updatedOn || a.timestamp).getTime()
      );
  }, [tickets, filterStatus, filterCategory]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
    tickets.forEach((t) => {
      if (counts[t.status] !== undefined) counts[t.status]++;
    });
    return counts;
  }, [tickets]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Support Tickets</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tickets.length} total &middot; {statusCounts.open} open &middot; {statusCounts.in_progress} in progress
          </p>
        </div>
        <button
          onClick={fetchTickets}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
        >
          <FontAwesomeIcon icon={faRefresh} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {(["all", "open", "in_progress", "resolved", "closed"] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1 rounded-md text-xs font-medium ${
                filterStatus === s
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"
              }`}
            >
              {s === "all" ? "All" : s.replace("_", " ")}
            </button>
          ))}
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as FilterCategory)}
          className="text-xs border rounded-lg px-3 py-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          <option value="all">All Categories</option>
          <option value="campaigns">Campaigns</option>
          <option value="billing">Billing</option>
          <option value="projects">Projects</option>
          <option value="account">Account</option>
          <option value="technical">Technical</option>
          <option value="general">General</option>
        </select>
      </div>

      {/* Tickets List */}
      {loading && tickets.length === 0 ? (
        <div className="text-center py-12">
          <FontAwesomeIcon icon={faSpinner} className="animate-spin text-2xl text-blue-500 mb-2" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading tickets...</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="text-center py-12">
          <FontAwesomeIcon icon={faTicketAlt} className="text-4xl text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            {tickets.length === 0 ? "No support tickets" : "No tickets match your filters"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((ticket) => {
            const isExpanded = expandedTicket === ticket.supportId;
            const categoryIcon = CATEGORY_ICONS[ticket.category] || faCircleQuestion;
            const statusColor = STATUS_COLORS[ticket.status] || STATUS_COLORS.open;
            const subLabel = SUBCATEGORY_LABELS[ticket.subCategory] || ticket.subCategory;

            return (
              <div
                key={ticket.supportId}
                className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg overflow-hidden"
              >
                {/* Ticket Header */}
                <button
                  onClick={() => setExpandedTicket(isExpanded ? null : ticket.supportId)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <FontAwesomeIcon
                    icon={categoryIcon}
                    className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-800 dark:text-white">
                        {ticket.supportId}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor}`}>
                        {ticket.status.replace("_", " ")}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {ticket.category}
                      </span>
                      {ticket.entityId && (
                        <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded">
                          {ticket.entityId}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      User: {ticket.userId} &middot; {subLabel} &middot; {formatDate(ticket.updatedOn || ticket.timestamp)}
                    </p>
                  </div>
                  <FontAwesomeIcon
                    icon={isExpanded ? faChevronUp : faChevronDown}
                    className="w-4 h-4 text-gray-400 shrink-0"
                  />
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t dark:border-gray-700 p-4 space-y-3 bg-gray-50 dark:bg-gray-800/50">
                    {/* Messages */}
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {(ticket.messages || []).map((msg, i) => (
                        <div
                          key={i}
                          className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                              msg.role === "user"
                                ? "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                                : msg.role === "admin"
                                ? "bg-blue-600 text-white"
                                : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                            }`}
                          >
                            <div className="text-xs opacity-70 mb-0.5">
                              {msg.role === "admin" ? "Admin" : msg.role === "user" ? "User" : "System"}
                            </div>
                            {msg.content}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t dark:border-gray-700">
                      {ticket.status === "open" && (
                        <button
                          onClick={() => updateTicketStatus(ticket, "in_progress")}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1"
                        >
                          <FontAwesomeIcon icon={faReply} />
                          Claim
                        </button>
                      )}
                      {ticket.status === "in_progress" && (
                        <button
                          onClick={() => updateTicketStatus(ticket, "resolved")}
                          className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1"
                        >
                          <FontAwesomeIcon icon={faCheckCircle} />
                          Resolve
                        </button>
                      )}
                      {(ticket.status === "resolved" || ticket.status === "in_progress") && (
                        <button
                          onClick={() => updateTicketStatus(ticket, "closed")}
                          className="bg-gray-500 hover:bg-gray-600 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1"
                        >
                          <FontAwesomeIcon icon={faTimesCircle} />
                          Close
                        </button>
                      )}
                    </div>

                    {/* Reply Input */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={replyingTo === ticket.supportId ? newMessage : ""}
                        onChange={(e) => {
                          setReplyingTo(ticket.supportId);
                          setNewMessage(e.target.value);
                        }}
                        onFocus={() => setReplyingTo(ticket.supportId)}
                        placeholder="Reply to this ticket..."
                        className="flex-1 text-sm border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-1"
                      >
                        {sending ? (
                          <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                        ) : (
                          <FontAwesomeIcon icon={faReply} />
                        )}
                      </button>
                    </div>
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
