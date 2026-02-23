"use client";

import { Input } from "@/components/ui/input";
import { useRef, useState } from "react";
import { toast } from "sonner";

interface QuickAddProps {
  onAdd: (title: string) => Promise<boolean>;
}

export function QuickAdd({ onAdd }: QuickAddProps) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || submitting) return;

    setSubmitting(true);
    const ok = await onAdd(value.trim());
    setSubmitting(false);

    if (ok) {
      setValue("");
    } else {
      toast.error("Failed to add todo");
    }

    inputRef.current?.focus();
  }

  return (
    <form onSubmit={handleSubmit}>
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add a todo... (press Enter)"
        disabled={submitting}
        autoFocus
        className="text-base"
      />
    </form>
  );
}
