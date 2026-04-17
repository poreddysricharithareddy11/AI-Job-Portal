import React from "react";

export default function StatusBadge({ status }) {
  const statusConfig = {
    active: { color: "#3b82f6", label: "Active" },      // Blue
    selected: { color: "#10b981", label: "Selected" }, // Green
    rejected: { color: "#ef4444", label: "Rejected" }, // Red
    closed: { color: "#6b7280", label: "Closed" }       // Gray
  };

  const config = statusConfig[status] || statusConfig.active;

  const badgeStyle = {
    backgroundColor: `${config.color}15`, // Light transparent background
    color: config.color,
    border: `1px solid ${config.color}30`,
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "700",
    textTransform: "uppercase",
    display: "inline-block"
  };

  return <span style={badgeStyle}>{config.label}</span>;
}