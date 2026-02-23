"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Trash2 } from "lucide-react";
import type { Todo } from "@/db/schema";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface TodoListProps {
  todos: Todo[];
  loading: boolean;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}

export function TodoList({
  todos,
  loading,
  onToggle,
  onDelete,
}: TodoListProps) {
  const [focusIndex, setFocusIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        if (e.key === "ArrowDown" && todos.length > 0) {
          e.preventDefault();
          setFocusIndex(0);
          listRef.current?.focus();
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusIndex((i) => Math.min(i + 1, todos.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusIndex((i) => {
            const next = i - 1;
            if (next < 0) {
              const input = document.querySelector<HTMLInputElement>(
                'input[placeholder*="todo"]'
              );
              input?.focus();
              return -1;
            }
            return next;
          });
          break;
        case " ":
          e.preventDefault();
          if (focusIndex >= 0 && focusIndex < todos.length) {
            const t = todos[focusIndex];
            onToggle(t.id, !t.completed);
          }
          break;
        case "Delete":
        case "Backspace":
          if (focusIndex >= 0 && focusIndex < todos.length) {
            e.preventDefault();
            const deleteIdx = focusIndex;
            onDelete(todos[deleteIdx].id);
            setFocusIndex((i) => Math.min(i, todos.length - 2));
          }
          break;
        case "Escape":
          setFocusIndex(-1);
          break;
      }
    },
    [focusIndex, todos, onToggle, onDelete]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (loading) {
    return (
      <div className="text-muted-foreground text-sm py-8 text-center">
        Loading...
      </div>
    );
  }

  if (todos.length === 0) {
    return (
      <div className="text-muted-foreground text-sm py-8 text-center">
        No todos yet. Start typing above to add one.
      </div>
    );
  }

  return (
    <>
      <div ref={listRef} className="space-y-1" role="list" tabIndex={-1}>
        {todos.map((t, i) => (
          <div
            key={t.id}
            role="listitem"
            className={cn(
              "group flex items-center gap-3 rounded-md px-3 py-2 transition-colors",
              "hover:bg-accent cursor-pointer",
              i === focusIndex && "bg-accent outline-none"
            )}
            onClick={() => setFocusIndex(i)}
          >
            <Checkbox
              checked={t.completed}
              onCheckedChange={(checked) => onToggle(t.id, checked === true)}
            />
            <span
              className={cn(
                "flex-1 text-sm",
                t.completed && "line-through text-muted-foreground"
              )}
            >
              {t.title}
            </span>
            <Avatar className="h-6 w-6" title={t.createdByName}>
              <AvatarImage src={t.createdByImage || undefined} alt={t.createdByName} />
              <AvatarFallback className="text-[10px] font-semibold uppercase">
                {(t.createdByName || "?").split(" ").map((w) => w[0]).slice(0, 2).join("")}
              </AvatarFallback>
            </Avatar>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 focus:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(t.id);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </>
  );
}
