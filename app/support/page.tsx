"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTicketAlt,
  faSpinner,
  faRefresh,
  faHeadset,
  faArrowRight,
} from "@fortawesome/free-solid-svg-icons";
import { securedApi } from "../../utils/auth";
import { useAppState } from "../context/AppContext";
import {
  Ticket,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  SUBCATEGORY_LABELS,
  relativeTime,
} from "../components/admin/support/constants";

type FilterStatus = "all" | "open" | "in_progress" | "resolved" | "closed";

export default function SupportPage() {
  const appData = useAppState();
  const userId = (appData as any)?.appData?.user?.userId || (appData as any)?.user?.userId || "";
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");

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
      console.error("[SupportPage] Failed to fetch tickets:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [userId]);

  const sortedTickets = useMemo(
    () =>
      [...tickets].sort(
        (a, b) => new Date(b.updatedOn || b.timestamp).getTime() - new Date(a.updatedOn || a.timestamp).getTime()
      ),
    [tickets]
  );

  const filteredTickets = useMemo(
    () =>
      filterStatus === "all"
        ? sortedTickets
        : sortedTickets.filter((t) => t.status === filterStatus),
    [sortedTickets, filterStatus]
  );

  const counts = useMemo(() => {
    const c = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
    for (const t of tickets) {
      if (t.status in c) c[t.status as keyof typeof c]++;
    }
    return c;
  }, [tickets]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FontAwesomeIcon icon={faHeadset} className="text-2xl text-blue-600 dark:text-blue-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Support</h1>
            {counts.open + counts.in_progress > 0 && (
              <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-xs font-medium px-2 py-0.5 rounded-full">
                {counts.open + counts.in_progress} active
              </span>
            )}
          </div>
          <button
            onClick={fetchTickets}
            className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Refresh"
          >
            <FontAwesomeIcon icon={faRefresh} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Status counts */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {(["open", "in_progress", "resolved", "closed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
              className={`p-3 rounded-lg border text-center transition-colors ${
                filterStatus === s
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{counts[s]}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{STATUS_LABELS[s]}</div>
            </button>
          ))}
        </div>

        {/* Ticket list */}
        {loading && tickets.length === 0 ? (
          <div className="text-center py-16">
            <FontAwesomeIcon icon={faSpinner} className="animate-spin text-3xl text-blue-500 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Loading tickets...</p>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg shadow-md dark:shadow-none">
            <FontAwesomeIcon icon={faTicketAlt} className="text-5xl text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-600 dark:text-gray-300 text-lg font-medium">
              {tickets.length === 0 ? "No support tickets yet" : "No tickets match this filter"}
            </p>
            <p className="text-gray-400 dark:text-gray-500 mt-2">
              {tickets.length === 0
                ? "Use the chat button below to get help"
                : "Try selecting a different filter"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTickets.map((ticket) => {
              const icon = CATEGORY_ICONS[ticket.category] || faTicketAlt;
              const statusColor = STATUS_COLORS[ticket.status] || STATUS_COLORS.open;
              const subLabel = SUBCATEGORY_LABELS[ticket.subCategory] || ticket.subCategory;
              const lastMsg = ticket.messages?.length
                ? ticket.messages[ticket.messages.length - 1].content
                : "";

              return (
                <Link
                  key={ticket.supportId}
                  href={`/support/${ticket.supportId}`}
                  className="block border dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow bg-white dark:bg-gray-800"
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <FontAwesomeIcon
                        icon={icon}
                        className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900 dark:text-white truncate">
                            {ticket.supportId}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor}`}>
                            {STATUS_LABELS[ticket.status] || ticket.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                          {CATEGORY_LABELS[ticket.category] || ticket.category} &middot; {subLabel}
                        </p>
                        {lastMsg && (
                          <p className="text-sm text-gray-500 dark:text-gray-500 truncate">
                            &ldquo;{lastMsg}&rdquo;
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {relativeTime(ticket.updatedOn || ticket.timestamp)}
                        </span>
                        <FontAwesomeIcon
                          icon={faArrowRight}
                          className="w-3 h-3 text-gray-300 dark:text-gray-600"
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
