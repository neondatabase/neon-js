"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Todo } from "@/db/schema";

function todosKey(orgId?: string | null) {
  return ["todos", orgId] as const;
}

export function useTodos(orgId?: string | null) {
  const queryClient = useQueryClient();

  const { data: todos = [], isLoading: loading } = useQuery({
    queryKey: todosKey(orgId),
    queryFn: async () => {
      const res = await fetch("/api/todos");
      const data = await res.json();
      return (data.todos || []) as Todo[];
    },
    enabled: !!orgId,
  });

  const addMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("Failed to add todo");
      const data = await res.json();
      return data.todo as Todo;
    },
    onSuccess: (newTodo) => {
      queryClient.setQueryData<Todo[]>(todosKey(orgId), (prev = []) => [
        newTodo,
        ...prev,
      ]);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const res = await fetch(`/api/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      if (!res.ok) throw new Error("Failed to toggle todo");
    },
    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey: todosKey(orgId) });
      const previous = queryClient.getQueryData<Todo[]>(todosKey(orgId));
      queryClient.setQueryData<Todo[]>(todosKey(orgId), (prev = []) =>
        prev.map((t) => (t.id === id ? { ...t, completed } : t))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(todosKey(orgId), context.previous);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/todos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete todo");
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: todosKey(orgId) });
      const previous = queryClient.getQueryData<Todo[]>(todosKey(orgId));
      queryClient.setQueryData<Todo[]>(todosKey(orgId), (prev = []) =>
        prev.filter((t) => t.id !== id)
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(todosKey(orgId), context.previous);
      }
    },
  });

  const addTodo = async (title: string) => {
    try {
      await addMutation.mutateAsync(title);
      return true;
    } catch {
      return false;
    }
  };

  const toggleTodo = (id: string, completed: boolean) => {
    toggleMutation.mutate({ id, completed });
  };

  const deleteTodo = (id: string) => {
    deleteMutation.mutate(id);
  };

  return {
    todos,
    loading,
    addTodo,
    toggleTodo,
    deleteTodo,
    refetch: () => queryClient.invalidateQueries({ queryKey: todosKey(orgId) }),
  };
}
