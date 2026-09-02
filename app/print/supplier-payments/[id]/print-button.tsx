"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{
        backgroundColor: "#111827",
        color: "#ffffff",
        border: "none",
        borderRadius: "8px",
        padding: "10px 16px",
        fontSize: "14px",
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      Print / Save PDF
    </button>
  );
}