"use client";

import { useEffect, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type AIStatus = {
  plan: string;
  status: string;
  enabled: boolean;
  used: number;
  limit: number | null;
  remaining: number | null;
  resetAt: string | null;
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
  const [status, setStatus] = useState<AIStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        const response = await fetch("/api/ai", {
          method: "GET",
          cache: "no-store",
        });

        const result = await response.json();

        if (!cancelled && response.ok) {
          setStatus(result);
        }
      } catch (err) {
        console.error("[ai-status]", err);
      }
    }

    void loadStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  const limitReached =
    status?.enabled === false ||
    (
      status?.limit != null &&
      status.used >= status.limit
    );

  async function ask(question?: string) {
    const text = String(question ?? input).trim();
    if (!text || sending || limitReached) return;

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

      if (result?.usage) {
        setStatus(result.usage);
      }

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
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-indigo-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            Business360 AI
          </span>
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-green-700">
            Read-only
          </span>

          {status && (
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
              {status.plan} Plan
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              AI Assistant
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Ask questions about your company performance and operational priorities.
            </p>
          </div>

          {status && (
            <div className="min-w-[240px] rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-700">
                  Daily AI usage
                </span>
                <span className="font-semibold text-indigo-700">
                  {status.used}
                  {status.limit == null ? " used" : ` / ${status.limit}`}
                </span>
              </div>

              {status.limit != null && (
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(0, (status.used / Math.max(status.limit, 1)) * 100)
                      )}%`,
                    }}
                  />
                </div>
              )}

              <div className="mt-2 text-[11px] text-gray-500">
                {status.limit == null
                  ? "Unlimited AI questions on your current plan."
                  : `${Math.max(status.limit - status.used, 0)} question${
                      Math.max(status.limit - status.used, 0) === 1 ? "" : "s"
                    } remaining today.`}
              </div>
            </div>
          )}
        </div>
      </header>

      {limitReached && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="text-sm font-semibold text-amber-900">
            Daily AI limit reached
          </div>
          <p className="mt-1 text-sm leading-6 text-amber-800">
            {status?.enabled === false
              ? "AI Assistant is not enabled on your current plan."
              : `You’ve used ${status?.used || 0} of ${
                  status?.limit || 0
                } AI questions today. Your quota resets automatically.`}
          </p>
          <div className="mt-3 text-xs font-medium text-amber-800">
            Current plan: {status?.plan || "Free"}
          </div>
        </div>
      )}

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
                      ? "rounded-br-md bg-indigo-600 text-white"
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
                disabled={sending || limitReached}
                placeholder={
                  limitReached
                    ? "Daily AI limit reached"
                    : "Ask Business360 AI..."
                }
                className="flex-1 resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                style={{
                  backgroundColor: "#ffffff",
                  color: "#111827",
                  WebkitTextFillColor: "#111827",
                  colorScheme: "light",
                }}
              />
              <button
                type="submit"
                disabled={sending || !input.trim() || limitReached}
                className="self-end rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40"
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
                disabled={sending || limitReached}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-left text-xs leading-5 text-gray-700 transition hover:bg-gray-100 disabled:opacity-40"
              >
                {starter}
              </button>
            ))}
          </div>

          {status && (
            <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Subscription
              </div>
              <div className="mt-2 text-sm font-semibold text-gray-900">
                {status.plan} Plan
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Status: {status.status}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
