import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import "./AdminDashboard.css";

function AdminDashboard() {
  const [form, setForm] = useState({ username: "", email: "" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [teachers, setTeachers] = useState([]);

  const loadTeachers = async () => {
    try {
      const { data } = await api.get("/admin/teachers");
      setTeachers(data.teachers || []);
    } catch (e) {
      // ignore for now
    }
  };

  useEffect(() => { loadTeachers(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg(""); setErr(""); setLoading(true);
    try {
      const { data } = await api.post("/admin/teachers", form);
      setMsg(data.message + (data.previewUrl ? ` (preview: ${data.previewUrl})` : ""));
      setForm({ username: "", email: "" });
      loadTeachers();
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to create teacher");
    } finally {
      setLoading(false);
    }
  };

  const resend = async (email) => {
    setMsg(""); setErr("");
    try {
      const { data } = await api.post("/admin/teachers/resend-invite", { email });
      setMsg(data.message + (data.previewUrl ? ` (preview: ${data.previewUrl})` : ""));
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to resend");
    }
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h2>Rwanda Coding Academy — Admin</h2>
        <Link to="/" className="logout-btn">Logout</Link>
      </header>

      <div className="dashboard-content">
        <h3>Create Teacher Account</h3>
        <p>Teachers cannot self-register. Create their account here and they'll receive an email to set their password.</p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10, maxWidth: 420 }}>
          <input
            placeholder="Teacher full name / username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
          <input
            type="email"
            placeholder="Teacher email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <button className="action-btn" disabled={loading}>
            {loading ? "Creating..." : "Create teacher & send setup email"}
          </button>
          {msg && <div style={{ color: "green" }}>{msg}</div>}
          {err && <div style={{ color: "crimson" }}>{err}</div>}
        </form>

        <h3 style={{ marginTop: 30 }}>Teachers</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr><th align="left">Name</th><th align="left">Email</th><th align="left">Status</th><th></th></tr>
          </thead>
          <tbody>
            {teachers.map((t) => (
              <tr key={t.email}>
                <td>{t.username}</td>
                <td>{t.email}</td>
                <td>{t.status || "active"}</td>
                <td>
                  {t.status === "pending_password_setup" && (
                    <button onClick={() => resend(t.email)}>Resend invite</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminDashboard;
