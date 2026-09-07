"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faSpinner,
  faPaperPlane,
  faCheckCircle,
  faTimesCircle,
  faUserShield,
} from "@fortawesome/free-solid-svg-icons";
import { securedApi } from "../../../../../utils/auth";
import { useAppState } from "../../../../context/AppContext";
import { rowsToObjects } from "../../../../utils/rows";
import {
  Ticket,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  SUBCATEGORY_LABELS,
  formatDate,
} from "../../../../components/admin/support/constants";

export default function AdminTicketDetail() {
  const { supportId } = useParams<{ supportId: string }>();
  const router = useRouter();
  const appData = useAppState();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages]);

  useEffect(() => {
    try {
      const support = (appData as any)?.data?.support || (appData as any)?.appData?.data?.support;
      if (!support?.data || !Array.isArray(support.data)) {
        setLoading(false);
        return;
      }
      const parsed = rowsToObjects(support.headers || [], support.data) as unknown as Ticket[];
      const found = parsed.find((t) => t.supportId === supportId);
      setTicket(found || null);
    } catch (e) {
      console.error("[AdminTicketDetail] Parse error:", e);
    } finally {
      setLoading(false);
    }
  }, [appData, supportId]);

  const messages = useMemo(() => {
    if (!ticket) return [];
    try {
      if (Array.isArray(ticket.messages)) return ticket.messages;
      return JSON.parse(ticket.messages || "[]");
    } catch { return []; }
  }, [ticket]);

  const handleReply = async () => {
    if (!newMessage.trim() || sending || !ticket) return;
    setSending(true);
    try {
      const updatedMessages = [
        ...messages,
        { role: "admin", content: newMessage.trim(), ts: new Date().toISOString() },
      ];
      const result = await securedApi.callBackendFunction({
        functionName: "updateTicket",
        supportId: ticket.supportId,
        messages: updatedMessages,
        status: ticket.status === "open" ? "in_progress" : ticket.status,
      });
      if (result?.success) {
        setTicket((prev) =>
          prev ? { ...prev, messages: updatedMessages, updatedOn: new Date().toISOString() } : prev
        );
        setNewMessage("");
      }
    } catch (e) {
      console.error("[AdminTicketDetail] Reply failed:", e);
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!ticket || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      const result = await securedApi.callBackendFunction({
        functionName: "updateTicket",
        supportId: ticket.supportId,
        status: newStatus,
      });
      if (result?.success) {
        setTicket((prev) =>
          prev ? { ...prev, status: newStatus, updatedOn: new Date().toISOString() } : prev
        );
      }
    } catch (e) {
      console.error("[AdminTicketDetail] Status update failed:", e);
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <FontAwesomeIcon icon={faSpinner} className="animate-spin text-2xl text-blue-500" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-6">
        <Link href="/root/support/tickets" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm inline-flex items-center gap-1 mb-4">
          <FontAwesomeIcon icon={faArrowLeft} className="w-3 h-3" /> Back to Tickets
        </Link>
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <p className="text-gray-500 dark:text-gray-400">Ticket not found</p>
        </div>
      </div>
    );
  }

  const icon = CATEGORY_ICONS[ticket.category] || faSpinner;
  const statusColor = STATUS_COLORS[ticket.status] || STATUS_COLORS.open;
  const subLabel = SUBCATEGORY_LABELS[ticket.subCategory] || ticket.subCategory;
  const isClosed = ticket.status === "closed" || ticket.status === "resolved";

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <Link href="/root/support/tickets" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm inline-flex items-center gap-1 mb-4">
        <FontAwesomeIcon icon={faArrowLeft} className="w-3 h-3" /> Back to Tickets
      </Link>

      {/* Ticket header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm dark:shadow-none p-6 mb-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <FontAwesomeIcon icon={icon} className="text-xl text-gray-400 dark:text-gray-500" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{ticket.supportId}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {CATEGORY_LABELS[ticket.category] || ticket.category}
                {subLabel && <> &middot; {subLabel}</>}
              </p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>
            {STATUS_LABELS[ticket.status] || ticket.status}
          </span>
        </div>

        <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span>User: {ticket.userId}</span>
          <span>Created: {formatDate(ticket.timestamp)}</span>
          <span>Updated: {formatDate(ticket.updatedOn)}</span>
        </div>

        {/* Status actions */}
        <div className="flex gap-2 mt-4">
          {ticket.status === "open" && (
            <button
              onClick={() => updateStatus("in_progress")}
              disabled={updatingStatus}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              <FontAwesomeIcon icon={faUserShield} className="mr-1" /> Claim
            </button>
          )}
          {ticket.status === "in_progress" && (
            <button
              onClick={() => updateStatus("resolved")}
              disabled={updatingStatus}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              <FontAwesomeIcon icon={faCheckCircle} className="mr-1" /> Resolve
            </button>
          )}
          {!isClosed && (
            <button
              onClick={() => updateStatus("closed")}
              disabled={updatingStatus}
              className="px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              <FontAwesomeIcon icon={faTimesCircle} className="mr-1" /> Close
            </button>
          )}
        </div>
      </div>

      {/* Message thread */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm dark:shadow-none p-4 mb-4">
        <div className="max-h-[50vh] overflow-y-auto space-y-3">
          {messages.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">No messages yet</p>
          ) : (
            messages.map((msg: any, i: number) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-md"
                    : msg.role === "admin"
                    ? "bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-300 rounded-bl-md"
                    : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-bl-md"
                }`}>
                  {msg.content}
                  <div className={`text-xs mt-1 ${msg.role === "user" ? "text-blue-200" : "text-gray-400 dark:text-gray-500"}`}>
                    {msg.ts ? formatDate(msg.ts) : ""}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Reply input */}
      {!isClosed && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm dark:shadow-none p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
              placeholder="Type your reply..."
              className="flex-1 px-4 py-2.5 rounded-xl border dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleReply}
              disabled={!newMessage.trim() || sending}
              className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-colors"
            >
              <FontAwesomeIcon icon={sending ? faSpinner : faPaperPlane} className={sending ? "animate-spin" : "w-4 h-4"} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
