import type { InputHTMLAttributes } from "react";

export function Input(
  props: InputHTMLAttributes<HTMLInputElement>
) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 ${props.className || ""}`}
    />
  );
}