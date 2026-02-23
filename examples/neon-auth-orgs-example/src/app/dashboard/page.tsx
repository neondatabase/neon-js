"use client";

import { authClient } from "@/lib/auth/client";
import { QuickAdd } from "@/components/quick-add";
import { TodoList } from "@/components/todo-list";
import { useTodos } from "@/hooks/use-todos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const { data: activeOrg } = authClient.useActiveOrganization();
  const { todos, loading, addTodo, toggleTodo, deleteTodo } = useTodos(activeOrg?.id);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().includes("MAC"));
  }, []);

  if (!activeOrg) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Create or select an organization to get started.
        </CardContent>
      </Card>
    );
  }

  const modKey = isMac ? "⌥" : "Alt";

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{activeOrg.name} Todos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <QuickAdd key={activeOrg.id} onAdd={addTodo} />
          <TodoList
            todos={todos}
            loading={loading}
            onToggle={toggleTodo}
            onDelete={deleteTodo}
          />
        </CardContent>
      </Card>
      <div className="text-xs text-muted-foreground px-3">
        <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">↑↓</kbd>{" "}
        navigate{" "}
        <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Space</kbd>{" "}
        toggle{" "}
        <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Del</kbd>{" "}
        delete{" "}
        <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">
          {modKey}+←→
        </kbd>{" "}
        switch org{" "}
        <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">⌘K</kbd>{" "}
        menu
      </div>
    </>
  );
}
