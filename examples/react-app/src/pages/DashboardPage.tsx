import { AuthLoading, UserAvatar } from '@neondatabase/neon-js/auth/react';
import { Link } from 'react-router-dom';
import { useContext, useState, useEffect, useCallback } from 'react';
import { AuthUIContext } from '@neondatabase/neon-js/auth/react';
import { neonClient } from '../client';
import type { Tables } from '../../database.types';

type Todo = Tables<'todos'>;
type FilterType = 'all' | 'active' | 'completed';

export function DashboardPage() {
  return (
    <>
      {/* Loading state */}
      <AuthLoading>
        <DashboardSkeleton />
      </AuthLoading>

      {/* Dashboard content - protection disabled for testing */}
      <DashboardContent />
    </>
  );
}

function DashboardContent() {
  const { hooks } = useContext(AuthUIContext);
  const { data: session } = hooks.useSession();

  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = session?.user?.id;

  // Check if user is anonymous or not signed in
  const isAnonymous: boolean =
    session?.user && 'isAnonymous' in session.user
      ? Boolean(session?.user?.isAnonymous)
      : false;
  const isAuthenticated = Boolean(userId) && !isAnonymous;
  const isReadOnly = !isAuthenticated;

  // Fetch todos
  const fetchTodos = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let query = neonClient
        .from('todos')
        .select('*')
        .order('created_at', { ascending: false });

      // If user is not authenticated, only show public todos
      if (!isAuthenticated) {
        query = query.eq('is_public', true);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setTodos(data || []);
    } catch (err) {
      setError('Failed to load todos');
      console.error('Error fetching todos:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isAuthenticated]);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  // Add todo
  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim() || !userId) return;

    setIsAdding(true);
    setError(null);

    try {
      const { data, error: insertError } = await neonClient
        .from('todos')
        .insert({
          title: newTodoTitle.trim(),
          user_id: userId,
          completed: false,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setTodos((prev) => [data, ...prev]);
      setNewTodoTitle('');
    } catch (err) {
      setError('Failed to add todo');
      console.error('Error adding todo:', err);
    } finally {
      setIsAdding(false);
    }
  };

  // Toggle todo completion
  const toggleTodo = async (todo: Todo) => {
    setError(null);

    // Optimistic update
    setTodos((prev) =>
      prev.map((t) =>
        t.id === todo.id ? { ...t, completed: !t.completed } : t
      )
    );

    try {
      const { error: updateError } = await neonClient
        .from('todos')
        .update({ completed: !todo.completed })
        .eq('id', todo.id);

      if (updateError) throw updateError;
    } catch (err) {
      // Revert on error
      setTodos((prev) =>
        prev.map((t) =>
          t.id === todo.id ? { ...t, completed: todo.completed } : t
        )
      );
      setError('Failed to update todo');
      console.error('Error updating todo:', err);
    }
  };

  // Delete todo
  const deleteTodo = async (todoId: string) => {
    setError(null);

    // Optimistic update
    const previousTodos = todos;
    setTodos((prev) => prev.filter((t) => t.id !== todoId));

    try {
      const { error: deleteError } = await neonClient
        .from('todos')
        .delete()
        .eq('id', todoId);

      if (deleteError) throw deleteError;
    } catch (err) {
      // Revert on error
      setTodos(previousTodos);
      setError('Failed to delete todo');
      console.error('Error deleting todo:', err);
    }
  };

  // Toggle todo public status
  const togglePublic = async (todo: Todo) => {
    setError(null);

    // Optimistic update
    setTodos((prev) =>
      prev.map((t) =>
        t.id === todo.id ? { ...t, is_public: !t.is_public } : t
      )
    );

    try {
      const { error: updateError } = await neonClient
        .from('todos')
        .update({ is_public: !todo.is_public })
        .eq('id', todo.id);

      if (updateError) throw updateError;
    } catch (err) {
      // Revert on error
      setTodos((prev) =>
        prev.map((t) =>
          t.id === todo.id ? { ...t, is_public: todo.is_public } : t
        )
      );
      setError('Failed to update todo visibility');
      console.error('Error updating todo visibility:', err);
    }
  };

  // Clear completed todos
  const clearCompleted = async () => {
    const completedIds = todos.filter((t) => t.completed).map((t) => t.id);
    if (completedIds.length === 0) return;

    setError(null);
    const previousTodos = todos;
    setTodos((prev) => prev.filter((t) => !t.completed));

    try {
      const { error: deleteError } = await neonClient
        .from('todos')
        .delete()
        .in('id', completedIds);

      if (deleteError) throw deleteError;
    } catch (err) {
      setTodos(previousTodos);
      setError('Failed to clear completed todos');
      console.error('Error clearing completed:', err);
    }
  };

  // Filter todos
  const filteredTodos = todos.filter((todo) => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true;
  });

  const activeTodosCount = todos.filter((t) => !t.completed).length;
  const completedTodosCount = todos.filter((t) => t.completed).length;

  return (
    <div style={styles.container}>
      {/* Guest Banner */}
      {isReadOnly && (
        <div style={styles.guestBanner}>
          <span style={{ fontSize: '1.25rem' }}>👀</span>
          <div style={{ flex: 1 }}>
            <p style={styles.guestBannerTitle}>Viewing Public Tasks</p>
            <p style={styles.guestBannerText}>
              Sign in or create an account to manage your own tasks.
            </p>
          </div>
          <Link to="/auth/sign-in" style={styles.guestSignInButton}>
            Sign In
          </Link>
        </div>
      )}

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.userInfo}>
          {isAuthenticated ? (
            <>
              <UserAvatar
                user={session?.user}
                style={{ width: 48, height: 48 }}
              />
              <div>
                <h1 style={styles.welcomeTitle}>
                  {session?.user?.name || 'User'}'s Tasks
                </h1>
                <p style={styles.email}>{session?.user?.email}</p>
              </div>
            </>
          ) : (
            <>
              <span style={{ fontSize: '2.5rem' }}>🌐</span>
              <div>
                <h1 style={styles.welcomeTitle}>Public Tasks</h1>
                <p style={styles.email}>
                  {isAnonymous
                    ? 'Browsing as guest'
                    : 'Browse public tasks from our community'}
                </p>
              </div>
            </>
          )}
        </div>
        {isAuthenticated && (
          <Link to="/account/settings" style={styles.settingsButton}>
            ⚙️ Settings
          </Link>
        )}
      </div>

      {/* Stats Cards */}
      <div style={styles.stats}>
        <div style={styles.statCard}>
          <div style={styles.statHeader}>
            <span style={styles.statTitle}>Total Tasks</span>
            <span style={{ fontSize: '1.25rem' }}>📋</span>
          </div>
          <p style={styles.statValue}>{todos.length}</p>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statHeader}>
            <span style={styles.statTitle}>Active</span>
            <span style={{ fontSize: '1.25rem' }}>🎯</span>
          </div>
          <p style={styles.statValue}>{activeTodosCount}</p>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statHeader}>
            <span style={styles.statTitle}>Completed</span>
            <span style={{ fontSize: '1.25rem' }}>✅</span>
          </div>
          <p style={styles.statValue}>{completedTodosCount}</p>
        </div>
      </div>

      {/* Main Todo Card */}
      <div style={styles.todoCard}>
        <div style={styles.todoHeader}>
          <h2 style={styles.todoTitle}>
            {isReadOnly ? '🌐 Public Tasks' : '📝 My Tasks'}
          </h2>
          {!isReadOnly && completedTodosCount > 0 && (
            <button onClick={clearCompleted} style={styles.clearButton}>
              Clear completed ({completedTodosCount})
            </button>
          )}
        </div>

        {/* Add Todo Form - Only for authenticated users */}
        {!isReadOnly && (
          <form onSubmit={addTodo} style={styles.addForm}>
            <input
              type="text"
              value={newTodoTitle}
              onChange={(e) => setNewTodoTitle(e.target.value)}
              placeholder="What needs to be done?"
              style={styles.addInput}
              disabled={isAdding}
            />
            <button
              type="submit"
              disabled={!newTodoTitle.trim() || isAdding}
              style={{
                ...styles.addButton,
                opacity: !newTodoTitle.trim() || isAdding ? 0.5 : 1,
                cursor:
                  !newTodoTitle.trim() || isAdding ? 'not-allowed' : 'pointer',
              }}
            >
              {isAdding ? '...' : '+ Add'}
            </button>
          </form>
        )}

        {/* Filter Tabs */}
        <div style={styles.filterTabs}>
          {(['all', 'active', 'completed'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                ...styles.filterTab,
                backgroundColor:
                  filter === f
                    ? 'color-mix(in oklch, var(--primary) 20%, transparent)'
                    : 'transparent',
                borderColor:
                  filter === f
                    ? 'color-mix(in oklch, var(--primary) 50%, transparent)'
                    : 'var(--border)',
                color:
                  filter === f ? 'var(--primary)' : 'var(--muted-foreground)',
              }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'all' && ` (${todos.length})`}
              {f === 'active' && ` (${activeTodosCount})`}
              {f === 'completed' && ` (${completedTodosCount})`}
            </button>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div style={styles.errorMessage}>
            ⚠️ {error}
            <button onClick={() => setError(null)} style={styles.dismissError}>
              ×
            </button>
          </div>
        )}

        {/* Todo List */}
        <div style={styles.todoList}>
          {isLoading ? (
            <div style={styles.loadingState}>
              <div style={styles.spinner} />
              <p>Loading tasks...</p>
            </div>
          ) : filteredTodos.length === 0 ? (
            <div style={styles.emptyState}>
              <span
                style={{
                  fontSize: '3rem',
                  marginBottom: '1rem',
                  display: 'block',
                }}
              >
                {isReadOnly
                  ? '🔍'
                  : filter === 'completed'
                    ? '🎉'
                    : filter === 'active'
                      ? '✨'
                      : '📋'}
              </span>
              <p style={styles.emptyTitle}>
                {isReadOnly
                  ? 'No public tasks available'
                  : filter === 'completed'
                    ? 'No completed tasks yet'
                    : filter === 'active'
                      ? 'All tasks completed!'
                      : 'No tasks yet'}
              </p>
              <p style={styles.emptySubtitle}>
                {isReadOnly
                  ? 'Sign in to create your own tasks'
                  : filter === 'completed'
                    ? 'Complete some tasks to see them here'
                    : filter === 'active'
                      ? 'Time to add more tasks'
                      : 'Add a task above to get started'}
              </p>
            </div>
          ) : (
            filteredTodos.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={toggleTodo}
                onTogglePublic={togglePublic}
                onDelete={deleteTodo}
                isReadOnly={isReadOnly}
              />
            ))
          )}
        </div>
      </div>

      {/* Footer with tips */}
      <div style={styles.tipsCard}>
        <h3 style={styles.tipsTitle}>💡 Quick Tips</h3>
        <ul style={styles.tipsList}>
          <li>Click the checkbox to mark a task as complete</li>
          <li>Use filters to focus on active or completed tasks</li>
          <li>Click 🔒/🌐 to toggle public visibility for anonymous users</li>
          <li>Clear completed tasks to keep your list tidy</li>
        </ul>
      </div>
    </div>
  );
}

function TodoItem({
  todo,
  onToggle,
  onTogglePublic,
  onDelete,
  isReadOnly = false,
}: {
  todo: Todo;
  onToggle: (todo: Todo) => void;
  onTogglePublic: (todo: Todo) => void;
  onDelete: (id: string) => void;
  isReadOnly?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      style={{
        ...styles.todoItem,
        backgroundColor: isHovered
          ? 'color-mix(in oklch, var(--muted) 80%, transparent)'
          : 'color-mix(in oklch, var(--muted) 50%, transparent)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Checkbox - clickable only for authenticated users */}
      {isReadOnly ? (
        <div
          style={{
            ...styles.checkbox,
            backgroundColor: todo.completed ? 'var(--primary)' : 'transparent',
            borderColor: todo.completed ? 'var(--primary)' : 'var(--border)',
            cursor: 'default',
          }}
        >
          {todo.completed && <span style={styles.checkmark}>✓</span>}
        </div>
      ) : (
        <button
          onClick={() => onToggle(todo)}
          style={{
            ...styles.checkbox,
            backgroundColor: todo.completed ? 'var(--primary)' : 'transparent',
            borderColor: todo.completed ? 'var(--primary)' : 'var(--border)',
          }}
        >
          {todo.completed && <span style={styles.checkmark}>✓</span>}
        </button>
      )}

      <div style={styles.todoContent}>
        <span
          style={{
            ...styles.todoText,
            textDecoration: todo.completed ? 'line-through' : 'none',
            color: todo.completed
              ? 'var(--muted-foreground)'
              : 'var(--foreground)',
          }}
        >
          {todo.title}
        </span>
        <span style={styles.todoDate}>
          {new Date(todo.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      {/* Public badge (read-only indicator for anonymous users) */}
      {isReadOnly ? (
        <span style={styles.publicBadge} title="This is a public task">
          🌐
        </span>
      ) : (
        <>
          <button
            onClick={() => onTogglePublic(todo)}
            style={{
              ...styles.publicButton,
              backgroundColor: todo.is_public
                ? 'color-mix(in oklch, var(--primary) 20%, transparent)'
                : 'transparent',
              borderColor: todo.is_public ? 'var(--primary)' : 'var(--border)',
              color: todo.is_public
                ? 'var(--primary)'
                : 'var(--muted-foreground)',
            }}
            title={
              todo.is_public
                ? 'Public - click to make private'
                : 'Private - click to make public'
            }
          >
            {todo.is_public ? '🌐' : '🔒'}
          </button>

          <button
            onClick={() => onDelete(todo.id)}
            style={{
              ...styles.deleteButton,
              opacity: isHovered ? 1 : 0,
            }}
            aria-label="Delete todo"
          >
            🗑️
          </button>
        </>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.userInfo}>
          <div style={styles.skeletonAvatar} />
          <div>
            <div style={{ ...styles.skeletonText, width: 200, height: 24 }} />
            <div
              style={{
                ...styles.skeletonText,
                width: 150,
                height: 16,
                marginTop: 8,
              }}
            />
          </div>
        </div>
      </div>
      <div style={styles.stats}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ ...styles.statCard, ...styles.skeletonCard }} />
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '2rem 1.5rem',
  },
  guestBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem 1.25rem',
    backgroundColor: 'color-mix(in oklch, var(--primary) 10%, transparent)',
    border: '1px solid color-mix(in oklch, var(--primary) 30%, transparent)',
    borderRadius: 'var(--radius)',
    marginBottom: '1.5rem',
  },
  guestBannerTitle: {
    color: 'var(--foreground)',
    fontSize: '0.875rem',
    fontWeight: 600,
    margin: 0,
  },
  guestBannerText: {
    color: 'var(--muted-foreground)',
    fontSize: '0.75rem',
    margin: '0.25rem 0 0',
  },
  guestSignInButton: {
    backgroundColor: 'var(--primary)',
    color: 'var(--primary-foreground)',
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius)',
    textDecoration: 'none',
    fontSize: '0.875rem',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  welcomeTitle: {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    color: 'var(--foreground)',
    margin: 0,
  },
  email: {
    color: 'var(--muted-foreground)',
    margin: 0,
    fontSize: '0.875rem',
  },
  settingsButton: {
    backgroundColor: 'var(--secondary)',
    border: '1px solid var(--border)',
    color: 'var(--secondary-foreground)',
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius)',
    textDecoration: 'none',
    fontSize: '0.875rem',
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1rem',
    marginBottom: '2rem',
  },
  statCard: {
    backgroundColor: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '1.25rem',
  },
  statHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  statTitle: {
    color: 'var(--muted-foreground)',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  statValue: {
    color: 'var(--card-foreground)',
    fontSize: '1.75rem',
    fontWeight: 'bold',
    margin: 0,
  },
  todoCard: {
    backgroundColor: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '1rem',
    padding: '1.5rem',
    marginBottom: '2rem',
  },
  todoHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
  },
  todoTitle: {
    color: 'var(--card-foreground)',
    fontSize: '1.25rem',
    fontWeight: 600,
    margin: 0,
  },
  clearButton: {
    background: 'none',
    border: 'none',
    color: 'var(--muted-foreground)',
    fontSize: '0.875rem',
    cursor: 'pointer',
    padding: '0.25rem 0.5rem',
    borderRadius: '0.25rem',
  },
  addForm: {
    display: 'flex',
    gap: '0.75rem',
    marginBottom: '1.5rem',
  },
  addInput: {
    flex: 1,
    backgroundColor: 'var(--input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '0.75rem 1rem',
    color: 'var(--foreground)',
    fontSize: '1rem',
    outline: 'none',
  },
  addButton: {
    backgroundColor: 'var(--primary)',
    border: 'none',
    borderRadius: 'var(--radius)',
    padding: '0.75rem 1.5rem',
    color: 'var(--primary-foreground)',
    fontWeight: 600,
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  filterTabs: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1rem',
    borderBottom: '1px solid var(--border)',
    paddingBottom: '1rem',
  },
  filterTab: {
    padding: '0.5rem 1rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 500,
    transition: 'all 0.2s',
  },
  errorMessage: {
    backgroundColor: 'color-mix(in oklch, var(--destructive) 10%, transparent)',
    border:
      '1px solid color-mix(in oklch, var(--destructive) 30%, transparent)',
    borderRadius: 'var(--radius)',
    padding: '0.75rem 1rem',
    color: 'var(--destructive)',
    marginBottom: '1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dismissError: {
    background: 'none',
    border: 'none',
    color: 'var(--destructive)',
    fontSize: '1.25rem',
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
  },
  todoList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  todoItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem',
    borderRadius: 'var(--radius)',
    transition: 'background-color 0.15s',
  },
  checkbox: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    border: '2px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'all 0.2s',
  },
  checkmark: {
    color: 'var(--primary-foreground)',
    fontSize: '0.875rem',
    fontWeight: 'bold',
  },
  todoContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    minWidth: 0,
  },
  todoText: {
    fontSize: '1rem',
    wordBreak: 'break-word',
  },
  todoDate: {
    fontSize: '0.75rem',
    color: 'var(--muted-foreground)',
  },
  deleteButton: {
    background: 'none',
    border: 'none',
    fontSize: '1rem',
    cursor: 'pointer',
    padding: '0.25rem',
    transition: 'opacity 0.15s',
  },
  publicButton: {
    border: '1px solid',
    borderRadius: 'var(--radius)',
    fontSize: '0.875rem',
    cursor: 'pointer',
    padding: '0.25rem 0.5rem',
    transition: 'all 0.2s',
    flexShrink: 0,
  },
  publicBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.875rem',
    padding: '0.25rem 0.5rem',
    flexShrink: 0,
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '3rem',
    color: 'var(--muted-foreground)',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid var(--muted)',
    borderTopColor: 'var(--primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginBottom: '1rem',
  },
  emptyState: {
    textAlign: 'center',
    padding: '3rem 1rem',
  },
  emptyTitle: {
    color: 'var(--foreground)',
    fontSize: '1.125rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
  },
  emptySubtitle: {
    color: 'var(--muted-foreground)',
    fontSize: '0.875rem',
  },
  tipsCard: {
    backgroundColor: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '1.25rem',
  },
  tipsTitle: {
    color: 'var(--card-foreground)',
    fontSize: '1rem',
    fontWeight: 600,
    margin: 0,
    marginBottom: '0.75rem',
  },
  tipsList: {
    margin: 0,
    paddingLeft: '1.25rem',
    color: 'var(--muted-foreground)',
    fontSize: '0.875rem',
    lineHeight: 1.8,
  },
  skeletonAvatar: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    backgroundColor: 'var(--muted)',
  },
  skeletonText: {
    backgroundColor: 'var(--muted)',
    borderRadius: '0.25rem',
  },
  skeletonCard: {
    height: '100px',
    backgroundColor: 'var(--muted)',
  },
};
