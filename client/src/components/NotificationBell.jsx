import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import { useRealtime } from "../hooks/useRealtime";
import { BellIcon, CheckIcon, CloseIcon } from "./ui/Icons";

export default function NotificationBell() {
  const navigate = useNavigate();
  const { subscribe } = useRealtime();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const menuRef = useRef(null);

  // Fetch notifications initially
  useEffect(() => {
    let isMounted = true;
    api.get("/notifications")
      .then(({ data }) => {
        if (isMounted) {
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  // Real-time event subscriptions
  useEffect(() => {
    const addToast = (title, message, link) => {
      const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
      setToasts((prev) => [...prev, { id, title, message, link }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    };

    const unsubNotification = subscribe("notification:new", (doc) => {
      setNotifications((prev) => [doc, ...prev]);
      setUnreadCount((c) => c + 1);
      addToast(doc.title, doc.message, doc.link);
    });

    const unsubPaper = subscribe("paper:created", (paper) => {
      addToast(
        "New Paper Uploaded",
        `${paper.title} (${paper.subject}, ${paper.year}) was uploaded by ${paper.uploadedBy}.`,
        `/view/${paper.id}`
      );
    });

    const unsubAssignment = subscribe("assignment:created", (assignment) => {
      const target = Array.isArray(assignment) ? assignment[0] : assignment;
      if (target) {
        const userRole = localStorage.getItem("role");
        const link = userRole === "teacher" ? "/teacher/assignments" : "/student/assignments";
        addToast(
          "New Assignment Posted",
          `${target.title} (${target.subject || "Resource"}).`,
          link
        );
      }
    });

    return () => {
      unsubNotification();
      unsubPaper();
      unsubAssignment();
    };
  }, [subscribe]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [open]);

  const handleMarkAllRead = async () => {
    try {
      await api.post("/notifications/mark-all-read");
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true }))
      );
      setUnreadCount(0);
    } catch (_) {}
  };

  const handleItemClick = async (notif) => {
    if (!notif.read) {
      try {
        await api.patch(`/notifications/${notif.id}/read`);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (_) {}
    }
    setOpen(false);
    if (notif.link) {
      if (notif.link.startsWith("/view/")) {
        window.open(notif.link, "_blank", "noopener,noreferrer");
      } else {
        navigate(notif.link);
      }
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return "";
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div style={{ position: "relative" }} ref={menuRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={`Notifications (${unreadCount} unread)`}
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          background: open ? "var(--color-surface-subtle)" : "transparent",
          border: "1px solid var(--color-border)",
          color: "var(--color-ink)",
          cursor: "pointer",
          transition: "all var(--transition-fast)",
        }}
      >
        <BellIcon size={19} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "2px",
              right: "2px",
              minWidth: "18px",
              height: "18px",
              padding: "0 4px",
              borderRadius: "999px",
              background: "var(--color-danger, #EF4444)",
              color: "#FFFFFF",
              fontSize: "0.68rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
              border: "2px solid var(--color-surface)",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Panel */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: "360px",
            maxWidth: "calc(100vw - 32px)",
            maxHeight: "480px",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "14px",
            boxShadow: "var(--shadow-lg)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            fontFamily: "var(--font-family)",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 18px",
              borderBottom: "1px solid var(--color-border)",
              background: "var(--color-surface)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--color-ink)" }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: "rgba(91, 115, 224, 0.15)",
                    color: "var(--color-primary)",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                  }}
                >
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--color-primary)",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: "6px",
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List items */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {notifications.length === 0 ? (
              <div
                style={{
                  padding: "48px 24px",
                  textAlign: "center",
                  color: "var(--color-muted)",
                }}
              >
                <p style={{ margin: 0, fontSize: "0.88rem", fontWeight: 500 }}>
                  No notifications yet.
                </p>
                <p style={{ margin: "4px 0 0", fontSize: "0.78rem" }}>
                  Realtime updates about papers and assignments will show up here.
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  style={{
                    padding: "12px 18px",
                    borderBottom: "1px solid var(--color-border)",
                    cursor: "pointer",
                    background: n.read ? "transparent" : "rgba(91, 115, 224, 0.04)",
                    transition: "background var(--transition-fast)",
                    display: "flex",
                    gap: "12px",
                    alignItems: "flex-start",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--color-surface-subtle)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = n.read
                      ? "transparent"
                      : "rgba(91, 115, 224, 0.04)";
                  }}
                >
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: n.read ? "transparent" : "var(--color-primary)",
                      marginTop: "6px",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.85rem",
                        fontWeight: n.read ? 600 : 700,
                        color: "var(--color-ink)",
                        lineHeight: 1.3,
                      }}
                    >
                      {n.title}
                    </p>
                    <p
                      style={{
                        margin: "3px 0 0",
                        fontSize: "0.78rem",
                        color: "var(--color-muted)",
                        lineHeight: 1.4,
                      }}
                    >
                      {n.message}
                    </p>
                    <span
                      style={{
                        display: "inline-block",
                        marginTop: "4px",
                        fontSize: "0.72rem",
                        color: "var(--color-muted)",
                      }}
                    >
                      {formatTime(n.createdAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Quiet floating toasts */}
      <div
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              pointerEvents: "auto",
              background: "var(--color-surface)",
              color: "var(--color-ink)",
              border: "1px solid var(--color-border)",
              borderLeft: "4px solid var(--color-primary)",
              borderRadius: "10px",
              padding: "12px 16px",
              boxShadow: "var(--shadow-lg)",
              maxWidth: "340px",
              fontFamily: "var(--font-family)",
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              animation: "slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <div style={{ flex: 1 }}>
              <strong style={{ display: "block", fontSize: "0.85rem", fontWeight: 700 }}>
                {t.title}
              </strong>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "0.78rem",
                  color: "var(--color-muted)",
                  lineHeight: 1.35,
                }}
              >
                {t.message}
              </p>
              {t.link && (
                <Link
                  to={t.link}
                  target={t.link.startsWith("/view/") ? "_blank" : undefined}
                  rel={t.link.startsWith("/view/") ? "noopener noreferrer" : undefined}
                  style={{
                    display: "inline-block",
                    marginTop: "6px",
                    fontSize: "0.76rem",
                    color: "var(--color-primary)",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                  onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
                >
                  View details
                </Link>
              )}
            </div>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--color-muted)",
                cursor: "pointer",
                padding: "2px",
                display: "inline-flex",
                alignItems: "center",
              }}
              aria-label="Dismiss toast"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
