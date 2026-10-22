import React from "react";
import boyAvatar from "../../assets/avatars/student-boy.svg";
import girlAvatar from "../../assets/avatars/student-girl.svg";

/**
 * Avatar component with line-art flat-vector student illustrations & fallback initials
 * Supports boy, girl, color themes, and initials
 */
export default function Avatar({
  name = "Student",
  variant = "boy",
  size = "md",
  className = "",
  style = {},
  showStatus = false,
  status = "online",
}) {
  const sizeMap = {
    xs: 28,
    sm: 36,
    md: 44,
    lg: 56,
    xl: 80,
    hero: 120,
  };

  const px = sizeMap[size] || (typeof size === "number" ? size : 44);

  const getInitials = (str) => {
    if (!str) return "S";
    const parts = str.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const isIllustrated = variant === "boy" || variant === "girl";
  const illustrationSrc = variant === "girl" ? girlAvatar : boyAvatar;

  return (
    <div
      className={`rca-avatar-container ${className}`}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: `${px}px`,
        height: `${px}px`,
        borderRadius: "50%",
        flexShrink: 0,
        ...style,
      }}
    >
      {isIllustrated ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            overflow: "hidden",
            background: "linear-gradient(135deg, #EEF0F6 0%, #E4E8FA 100%)",
            border: "2px solid #FFFFFF",
            boxShadow: "0 2px 8px rgba(35, 44, 107, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={illustrationSrc}
            alt={name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: "scale(1.18) translateY(4%)",
            }}
          />
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #3F4FA8 0%, #232C6B 100%)",
            color: "#FFFFFF",
            fontWeight: 700,
            fontSize: `${Math.round(px * 0.4)}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid #FFFFFF",
            boxShadow: "0 2px 8px rgba(35, 44, 107, 0.12)",
            letterSpacing: "-0.02em",
          }}
        >
          {getInitials(name)}
        </div>
      )}

      {showStatus && (
        <span
          style={{
            position: "absolute",
            bottom: "0px",
            right: "0px",
            width: `${Math.max(8, Math.round(px * 0.25))}px`,
            height: `${Math.max(8, Math.round(px * 0.25))}px`,
            borderRadius: "50%",
            background: status === "online" ? "#10B981" : "#949EBF",
            border: "2px solid #FFFFFF",
          }}
        />
      )}
    </div>
  );
}
