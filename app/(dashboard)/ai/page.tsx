"use client";

import { useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const starters = [
  "How is my business performing this month?",
  "Which customers need collection attention?",
  "What inventory risks should I act on?",
  "Summarize my payables and cash pressure.",
];

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "I’m Business360 AI Assistant. Ask me about sales, receivables, payables, expenses, inventory and business priorities.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function ask(question?: string) {
    const text = String(question ?? input).trim();
    if (!text || sending) return;

    setMessages((current) => [...current, { role: "user", content: text }]);
    setInput("");
    setSending(true);
    setError("");

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result?.error || "AI Assistant could not answer.");
        return;
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: result?.answer || "No answer returned.",
        },
      ]);
    } catch (err) {
      console.error(err);
      setError("Could not connect to Business360 AI Assistant.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-gray-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            Business360 AI
          </span>
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-green-700">
            Read-only
          </span>
        </div>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-gray-900">
          AI Assistant
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Ask questions about your company performance and operational priorities.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="min-h-[480px] space-y-4 p-5">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.role === "user"
                      ? "rounded-br-md bg-gray-900 text-white"
                      : "rounded-bl-md bg-gray-100 text-gray-800"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-500">
                  Analyzing Business360 data...
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="mx-5 mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask();
            }}
            className="border-t border-gray-200 p-4"
          >
            <div className="flex gap-3">
              <textarea
                value={input}
                rows={2}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Business360 AI..."
                className="flex-1 resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none"
                style={{
                  backgroundColor: "#ffffff",
                  color: "#111827",
                  WebkitTextFillColor: "#111827",
                  colorScheme: "light",
                }}
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="self-end rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                Ask
              </button>
            </div>
          </form>
        </section>

        <aside className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Try asking</h2>
          <div className="mt-4 space-y-2">
            {starters.map((starter) => (
              <button
                key={starter}
                type="button"
                onClick={() => ask(starter)}
                disabled={sending}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-left text-xs leading-5 text-gray-700"
              >
                {starter}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
