import React from "react";

export default function Skeleton({
  width = "100%",
  height = "20px",
  borderRadius = "12px",
  className = "",
  style = {},
}) {
  return (
    <div
      className={`rca-skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius,
        background: "linear-gradient(90deg, #E8EDF8 25%, #F4F6FC 50%, #E8EDF8 75%)",
        backgroundSize: "200% 100%",
        animation: "skeleton-shimmer 1.5s infinite ease-in-out",
        ...style,
      }}
    />
  );
}
