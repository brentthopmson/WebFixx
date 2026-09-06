"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTicketAlt,
  faSpinner,
  faRefresh,
  faChevronDown,
  faChevronUp,
  faArrowRight,
} from "@fortawesome/free-solid-svg-icons";
import { useAppState } from "../../../context/AppContext";
import { rowsToObjects } from "../../../utils/rows";
import {
  Ticket,
  CATEGORY_ICONS,
  STATUS_COLORS,
  STATUS_LABELS,
  SUBCATEGORY_LABELS,
  relativeTime,
} from "../../../components/admin/support/constants";

type FilterStatus = "all" | "open" | "in_progress" | "resolved" | "closed";

export default function AdminTicketList() {
  const appData = useAppState();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");

  const fetchTickets = useCallback(() => {
    setLoading(true);
    try {
      const support = (appData as any)?.appData?.data?.support;
      if (!support?.data || !Array.isArray(support.data)) {
        setTickets([]);
        return;
      }
      const parsed = rowsToObjects(support.headers || [], support.data) as unknown as Ticket[];
      setTickets(parsed);
    } catch (e) {
      console.error("[AdminTicketList] Failed to parse tickets:", e);
    } finally {
      setLoading(false);
    }
  }, [appData]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const sortedTickets = useMemo(
    () => [...tickets].sort((a, b) => new Date(b.updatedOn || b.timestamp).getTime() - new Date(a.updatedOn || a.timestamp).getTime()),
    [tickets]
  );

  const filteredTickets = useMemo(
    () => filterStatus === "all" ? sortedTickets : sortedTickets.filter((t) => t.status === filterStatus),
    [sortedTickets, filterStatus]
  );

  const counts = useMemo(() => {
    const c = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
    for (const t of tickets) if (t.status in c) c[t.status as keyof typeof c]++;
    return c;
  }, [tickets]);

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <FontAwesomeIcon icon={faTicketAlt} className="text-blue-600" />
          Support Tickets
        </h1>
        <button onClick={fetchTickets} className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" title="Refresh">
          <FontAwesomeIcon icon={loading ? faSpinner : faRefresh} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Status filter bar */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {(["all", "open", "in_progress", "resolved", "closed"] as FilterStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filterStatus === s
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            {s === "all" ? `All (${tickets.length})` : `${STATUS_LABELS[s] || s} (${counts[s]})`}
          </button>
        ))}
      </div>

      {/* Ticket list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <FontAwesomeIcon icon={faSpinner} className="animate-spin text-2xl text-blue-500" />
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <FontAwesomeIcon icon={faTicketAlt} className="text-4xl text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No tickets found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((ticket) => {
            const isExpanded = expandedTicket === ticket.supportId;
            const icon = CATEGORY_ICONS[ticket.category] || faTicketAlt;
            const statusColor = STATUS_COLORS[ticket.status] || STATUS_COLORS.open;
            const subLabel = SUBCATEGORY_LABELS[ticket.subCategory] || ticket.subCategory;
            const messages = (() => {
              try {
                if (Array.isArray(ticket.messages)) return ticket.messages;
                return JSON.parse(ticket.messages || "[]");
              } catch { return []; }
            })();

            return (
              <div key={ticket.supportId} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 overflow-hidden">
                {/* Ticket header */}
                <button
                  onClick={() => setExpandedTicket(isExpanded ? null : ticket.supportId)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <FontAwesomeIcon icon={icon} className="text-gray-400 dark:text-gray-500 w-5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 dark:text-white text-sm">{ticket.supportId}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                        {STATUS_LABELS[ticket.status] || ticket.status}
                      </span>
                      {subLabel && <span className="text-xs text-gray-500 dark:text-gray-400">{subLabel}</span>}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {ticket.userId} &middot; {relativeTime(ticket.updatedOn || ticket.timestamp)}
                    </p>
                  </div>
                  <FontAwesomeIcon icon={isExpanded ? faChevronUp : faChevronDown} className="text-gray-400 w-4" />
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t dark:border-gray-700 p-4 space-y-3">
                    {/* Message thread */}
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {messages.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-4">No messages yet</p>
                      ) : (
                        messages.map((msg: any, i: number) => (
                          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs ${
                              msg.role === "user"
                                ? "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-300"
                                : msg.role === "admin"
                                ? "bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-300"
                                : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                            }`}>
                              <span className="font-medium capitalize">{msg.role}: </span>
                              {msg.content}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* View full ticket link */}
                    <Link
                      href={`/root/support/tickets/${ticket.supportId}`}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
                    >
                      Open full ticket <FontAwesomeIcon icon={faArrowRight} className="w-3 h-3" />
                    </Link>
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
