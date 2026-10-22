import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import Button from "./ui/Button";
import Badge from "./ui/Badge";
import { LogoutIcon } from "./ui/Icons";
import { RCA_CLASSES } from "./ui/ClassChips";
import { clearAuthStorage, persistAuth } from "../utils/auth";
import { errorMessage } from "./assignments/common";
import "./assignments/assignments.css";

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [cls, setCls] = useState("");
  const [nameMsg, setNameMsg] = useState({ type: "", text: "" });
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwMsg, setPwMsg] = useState({ type: "", text: "" });
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    api
      .get("/me")
      .then(({ data }) => {
        setUser(data.user);
        setName(data.user.name || data.user.username || "");
        setCls(data.user.class || "");
      })
      .catch((err) => setNameMsg({ type: "error", text: errorMessage(err, "Could not load your profile.") }));
  }, []);

  const saveName = async (e) => {
    e.preventDefault();
    setNameMsg({ type: "", text: "" });
    setSavingName(true);
    try {
      const payload = { name };
      if (user?.role === "student" && cls) payload.class = cls;
      const { data } = await api.put("/me", payload);
      persistAuth({ username: data.name });
      setUser((u) => ({ ...u, name: data.name, username: data.name, class: data.class || u.class }));
      setNameMsg({ type: "success", text: "Profile updated." });
    } catch (err) {
      setNameMsg({ type: "error", text: errorMessage(err) });
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPwMsg({ type: "", text: "" });
    setSavingPw(true);
    try {
      await api.put("/me/password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setPwMsg({ type: "success", text: "Password changed." });
    } catch (err) {
      setPwMsg({ type: "error", text: errorMessage(err) });
    } finally {
      setSavingPw(false);
    }
  };

  const logout = () => {
    clearAuthStorage();
    navigate("/login");
  };

  if (!user) return <p className="asg-sub">{nameMsg.text || "Loading…"}</p>;

  const roleLabel = user.role.charAt(0).toUpperCase() + user.role.slice(1);

  return (
    <div className="asg-page">
      <div className="asg-header">
        <div>
          <span className="asg-eyebrow">Account</span>
          <h1 className="asg-title">My profile</h1>
        </div>
        <Button variant="outline" icon={<LogoutIcon size={16} />} onClick={logout}>
          Log out
        </Button>
      </div>

      <div className="asg-panel" style={{ marginBottom: 20 }}>
        <div className="profile-card">
          <div className="profile-avatar-lg">{(user.name || user.email).charAt(0).toUpperCase()}</div>
          <div>
            <div className="asg-card-title" style={{ fontSize: "1.25rem" }}>{user.name || user.username}</div>
            <div className="asg-meta">{user.email}</div>
            <div style={{ marginTop: 8 }}>
              <Badge variant="indigo">{roleLabel}</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="asg-grid-2">
        <form className="asg-panel asg-form" style={{ maxHeight: "none" }} onSubmit={saveName}>
          <h3>Display name</h3>
          {nameMsg.text && <div className={`asg-alert ${nameMsg.type}`}>{nameMsg.text}</div>}
          <div className="asg-field">
            <label htmlFor="pf-name">Name</label>
            <input id="pf-name" className="asg-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          {user.role === "student" && (
            <div className="asg-field">
              <label htmlFor="pf-class">My class</label>
              <select id="pf-class" className="asg-input" value={cls} onChange={(e) => setCls(e.target.value)}>
                {!cls && <option value="">Choose your class…</option>}
                {RCA_CLASSES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              <div className="asg-meta">Your teachers give assignments to classes, so this must be correct.</div>
            </div>
          )}
          <div className="asg-form-actions">
            <Button type="submit" loading={savingName}>Save</Button>
          </div>
        </form>

        <form className="asg-panel asg-form" style={{ maxHeight: "none" }} onSubmit={savePassword}>
          <h3>Change password</h3>
          {pwMsg.text && <div className={`asg-alert ${pwMsg.type}`}>{pwMsg.text}</div>}
          <div className="asg-field">
            <label htmlFor="pf-cur">Current password</label>
            <input id="pf-cur" type="password" className="asg-input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="asg-field">
            <label htmlFor="pf-new">New password</label>
            <input id="pf-new" type="password" className="asg-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
            <div className="asg-meta">At least 8 characters with a letter, a number and a special character.</div>
          </div>
          <div className="asg-form-actions">
            <Button type="submit" loading={savingPw}>Update password</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
