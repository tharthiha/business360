"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() =>
        window.print()
      }
      className="print-hide rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white"
    >
      Print / Save PDF
    </button>
  );
}