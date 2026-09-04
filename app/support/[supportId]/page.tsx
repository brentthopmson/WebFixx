"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faSpinner,
  faPaperPlane,
} from "@fortawesome/free-solid-svg-icons";
import { securedApi } from "../../../utils/auth";
import { useAppState } from "../../context/AppContext";
import {
  Ticket,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  SUBCATEGORY_LABELS,
  formatDate,
} from "../../components/admin/support/constants";

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supportId = params.supportId as string;
  const appData = useAppState();
  const userId = (appData as any)?.appData?.user?.userId || (appData as any)?.user?.userId || "";

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchTicket = async () => {
    if (!userId || !supportId) return;
    setLoading(true);
    try {
      const result = await securedApi.callBackendFunction({
        functionName: "getTickets",
        userId,
      });
      if (result?.success) {
        const all = (result as any).tickets || [];
        const found = all.find((t: Ticket) => t.supportId === supportId);
        setTicket(found || null);
      }
    } catch (e) {
      console.error("[TicketDetail] Failed to fetch ticket:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicket();
  }, [userId, supportId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages]);

  const handleReply = async () => {
    if (!newMessage.trim() || sending || !ticket) return;
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
        setTicket((prev) =>
          prev
            ? { ...prev, messages: updatedMessages, updatedOn: new Date().toISOString() }
            : prev
        );
        setNewMessage("");
      }
    } catch (e) {
      console.error("[TicketDetail] Reply failed:", e);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <FontAwesomeIcon icon={faSpinner} className="animate-spin text-3xl text-blue-500" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-3xl mx-auto">
          <Link href="/support" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm mb-4 inline-flex items-center gap-1">
            <FontAwesomeIcon icon={faArrowLeft} className="w-3 h-3" /> Back to Support
          </Link>
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg shadow-md dark:shadow-none">
            <p className="text-gray-500 dark:text-gray-400">Ticket not found</p>
          </div>
        </div>
      </div>
    );
  }

  const icon = CATEGORY_ICONS[ticket.category] || faSpinner;
  const statusColor = STATUS_COLORS[ticket.status] || STATUS_COLORS.open;
  const subLabel = SUBCATEGORY_LABELS[ticket.subCategory] || ticket.subCategory;
  const isClosed = ticket.status === "closed" || ticket.status === "resolved";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Back link */}
        <Link
          href="/support"
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm mb-4 inline-flex items-center gap-1"
        >
          <FontAwesomeIcon icon={faArrowLeft} className="w-3 h-3" /> Back to Support
        </Link>

        {/* Ticket header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md dark:shadow-none p-6 mb-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <FontAwesomeIcon icon={icon} className="text-xl text-gray-400 dark:text-gray-500" />
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{ticket.supportId}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {CATEGORY_LABELS[ticket.category] || ticket.category} &middot; {subLabel}
                </p>
              </div>
            </div>
            <span className={`text-sm px-3 py-1 rounded-full ${statusColor}`}>
              {STATUS_LABELS[ticket.status] || ticket.status}
            </span>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-gray-400 dark:text-gray-500">
            <span>Created: {formatDate(ticket.timestamp)}</span>
            {ticket.entityId && <span>Entity: {ticket.entityId}</span>}
            <span>{ticket.messages?.length || 0} messages</span>
          </div>
        </div>

        {/* Message thread */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md dark:shadow-none p-6 mb-4">
          <div className="space-y-4 max-h-[500px] overflow-y-auto mb-4">
            {(ticket.messages || []).map((msg, i) => {
              const isUser = msg.role === "user";
              const isSystem = msg.role === "system";
              return (
                <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] ${isUser ? "order-2" : "order-1"}`}>
                    <div className={`text-xs font-medium mb-1 ${isUser ? "text-right text-gray-500" : "text-gray-400"}`}>
                      {isSystem ? "System" : isUser ? "You" : "Support"}
                    </div>
                    <div
                      className={`rounded-lg px-4 py-2 text-sm leading-relaxed ${
                        isUser
                          ? "bg-blue-600 text-white"
                          : isSystem
                          ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300 border border-green-200 dark:border-green-800"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                      }`}
                    >
                      {msg.content}
                    </div>
                    <div className={`text-xs text-gray-400 dark:text-gray-500 mt-1 ${isUser ? "text-right" : ""}`}>
                      {formatDate(msg.ts)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply input */}
          {!isClosed ? (
            <div className="border-t dark:border-gray-700 pt-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your reply..."
                  className="flex-1 border rounded-lg px-4 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleReply();
                    }
                  }}
                  disabled={sending}
                />
                <button
                  onClick={handleReply}
                  disabled={!newMessage.trim() || sending}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  <FontAwesomeIcon icon={sending ? faSpinner : faPaperPlane} className={sending ? "animate-spin" : ""} />
                </button>
              </div>
            </div>
          ) : (
            <div className="border-t dark:border-gray-700 pt-4 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This ticket is {ticket.status}. No further replies can be added.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
