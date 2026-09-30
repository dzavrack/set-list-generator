"use client";
import { useEffect, useState } from "react";
import { CircleCheck } from "lucide-react";

type Listener = (msg: string) => void;
const listeners = new Set<Listener>();

export function toast(msg: string) {
  listeners.forEach((l) => l(msg));
}

export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const l: Listener = (m) => {
      setMsg(m);
      setN((x) => x + 1);
    };
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2800);
    return () => clearTimeout(t);
  }, [msg, n]);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex justify-center px-4 lg:bottom-6">
      {msg && (
        <div key={n} className="flex items-center gap-2.5 rounded-xl border border-line-strong bg-surface-2/95 py-2.5 pr-4 pl-3 text-sm text-ink shadow-[0_16px_50px_rgb(0_0_0/0.7)] backdrop-blur-xl">
          <CircleCheck className="h-4 w-4 text-neon-hot" strokeWidth={2} />
          {msg}
        </div>
      )}
    </div>
  );
}
