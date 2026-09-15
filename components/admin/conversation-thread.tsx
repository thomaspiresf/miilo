"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CheckCheck, Clock, SmilePlus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatWhatsAppPhone } from "@/lib/format";
import {
  sendManualReplyAction,
  pauseConversationAction,
  resumeConversationAction,
} from "@/app/admin/conversas/actions";
import type { ConversationMessage } from "@/lib/data/whatsapp-conversations";

const POLL_MS = 6000;

// Emojis mais usados numa conversa de loja — não precisa de um seletor
// completo (nem da dependência extra que isso puxaria) pra cobrir o uso
// real aqui.
const EMOJIS = [
  "😊", "😄", "🙂", "😉", "😍", "🥰", "😘", "🤗",
  "👍", "🙏", "👏", "🎉", "✅", "❤️", "😢", "😅",
  "🤔", "😮", "😴", "👋", "🛍️", "📦", "💳", "🔥",
];

function MessageStatusIcon({ status }: { status: ConversationMessage["status"] }) {
  if (status === "read") return <CheckCheck className="h-3.5 w-3.5 text-sky-500" />;
  if (status === "delivered") return <CheckCheck className="h-3.5 w-3.5 text-muted" />;
  if (status === "sent") return <Check className="h-3.5 w-3.5 text-muted" />;
  if (status === "failed") return <TriangleAlert className="h-3.5 w-3.5 text-danger" />;
  return null;
}

export function ConversationThread({
  phone,
  initialMessages,
  initialPaused,
}: {
  phone: string;
  initialMessages: ConversationMessage[];
  initialPaused: boolean;
}) {
  const router = useRouter();
  const [paused, setPaused] = useState(initialPaused);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [emojiOpen, setEmojiOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Mensagens novas chegam pelo webhook, fora do ciclo de vida dessa página —
  // um refresh simples a cada alguns segundos é suficiente pra "acompanhar"
  // (e pra ver o status virar entregue/lida) sem precisar de um canal em
  // tempo real.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [initialMessages.length]);

  useEffect(() => {
    if (!emojiOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) setEmojiOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [emojiOpen]);

  function insertEmoji(emoji: string) {
    const el = textareaRef.current;
    if (!el) {
      setText((t) => t + emoji);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + emoji.length;
    });
  }

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const res = await sendManualReplyAction(phone, trimmed);
      if (!res.ok) {
        setError(res.error ?? "Não consegui enviar.");
        return;
      }
      setText("");
      setPaused(true);
      router.refresh();
    });
  }

  function handleTogglePause() {
    startTransition(async () => {
      if (paused) {
        await resumeConversationAction(phone);
        setPaused(false);
      } else {
        await pauseConversationAction(phone);
        setPaused(true);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href="/admin/conversas" className="text-muted hover:text-foreground" aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-black">{formatWhatsAppPhone(phone)}</h1>
            <p className="text-xs text-muted">{paused ? "Bot pausado — você está no controle" : "Bot ativo"}</p>
          </div>
        </div>
        <Button variant={paused ? "primary" : "outline"} size="sm" onClick={handleTogglePause} disabled={pending}>
          {paused ? "Reativar bot" : "Pausar bot"}
        </Button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto rounded-2xl border border-border bg-surface p-4">
        {initialMessages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                m.role === "user" ? "bg-black/5" : m.sender === "human" ? "bg-primary/20" : "bg-primary/10"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted">
                {m.role === "assistant" && (m.sender === "human" ? "Você · " : "Bot · ")}
                {formatDateTime(m.created_at)}
                {m.role === "assistant" && <MessageStatusIcon status={m.status} />}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {pending && (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted">
          <Clock className="h-3 w-3 animate-pulse" /> Enviando...
        </p>
      )}

      <div className="relative mt-3 flex items-end gap-2">
        {emojiOpen && (
          <div
            ref={emojiPickerRef}
            className="absolute bottom-full left-0 mb-2 grid w-64 grid-cols-8 gap-1 rounded-xl border border-border bg-surface p-2 shadow-lg"
          >
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => insertEmoji(emoji)}
                className="rounded-lg p-1 text-lg hover:bg-black/5"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Emojis"
          onClick={() => setEmojiOpen((v) => !v)}
        >
          <SmilePlus className="h-4 w-4" />
        </Button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Mandar mensagem manual..."
          rows={2}
          className="flex-1 resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <Button onClick={handleSend} disabled={pending || !text.trim()}>
          Enviar
        </Button>
      </div>
    </div>
  );
}
