import React, { useEffect, useState, useCallback } from 'react';
import {
  PlusIcon, TrashIcon, PencilIcon, CheckCircleIcon,
  CalendarDaysIcon, SparklesIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import api from '../api/client';
import toast from 'react-hot-toast';
import { format, parseISO, addDays, startOfWeek } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GoalLog { id: number; note?: string; logged_at: string; }

interface Goal {
  id: number;
  title: string;
  category?: string;
  target_per_week: number;
  notes?: string;
  sort_order: number;
  completed_count: number;
  logs: GoalLog[] | null;
}

interface Task {
  id: number;
  title: string;
  notes?: string;
  is_done: boolean;
  due_date?: string;
  priority: 'low' | 'normal' | 'high';
  done_at?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMondayOf(date = new Date()): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

function weekLabel(monday: string): string {
  const start = parseISO(monday);
  const end = addDays(start, 6);
  return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Gov Contracting': 'bg-blue-100 text-blue-700',
  'Carriers':        'bg-emerald-100 text-emerald-700',
};

const PRIORITY_STYLES: Record<string, string> = {
  high:   'bg-red-100 text-red-700',
  normal: 'bg-blue-100 text-blue-700',
  low:    'bg-ink-700/20 text-ink-400',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function GamePlanPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [weekStart, setWeekStart] = useState(getMondayOf());
  const [loading, setLoading] = useState(true);
  const [taskFilter, setTaskFilter] = useState<'open' | 'done'>('open');

  // Modals
  const [goalModal, setGoalModal] = useState<Partial<Goal> | null>(null);
  const [taskModal, setTaskModal] = useState<Partial<Task> | null>(null);
  const [saving, setSaving] = useState(false);

  const loadGoals = useCallback(() => {
    api.get(`/game-plan/goals?week=${weekStart}`)
      .then(r => setGoals(r.data.goals || []))
      .catch(() => toast.error('Failed to load goals'));
  }, [weekStart]);

  const loadTasks = useCallback(() => {
    api.get('/tasks')
      .then(r => setTasks(r.data || []))
      .catch(() => toast.error('Failed to load tasks'));
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/game-plan/goals?week=${weekStart}`),
      api.get('/tasks'),
    ]).then(([g, t]) => {
      setGoals(g.data.goals || []);
      setTasks(t.data || []);
    }).catch(() => toast.error('Failed to load'))
    .finally(() => setLoading(false));
  }, [weekStart]);

  // ── Goals ────────────────────────────────────────────────────────────────

  const logGoal = async (goal: Goal) => {
    if (goal.completed_count >= goal.target_per_week) return;
    try {
      await api.post(`/game-plan/goals/${goal.id}/log`, { week_start: weekStart });
      loadGoals();
      if (goal.completed_count + 1 >= goal.target_per_week) {
        toast.success(`${goal.title} — weekly goal hit! 🎉`);
      }
    } catch { toast.error('Failed'); }
  };

  const undoLog = async (logId: number) => {
    try {
      await api.delete(`/game-plan/log/${logId}`);
      loadGoals();
    } catch { toast.error('Failed to undo'); }
  };

  const saveGoal = async () => {
    if (!goalModal?.title?.trim()) { toast.error('Title required'); return; }
    setSaving(true);
    try {
      if (goalModal.id) {
        await api.put(`/game-plan/goals/${goalModal.id}`, goalModal);
        toast.success('Goal updated');
      } else {
        await api.post('/game-plan/goals', goalModal);
        toast.success('Goal added');
      }
      setGoalModal(null);
      loadGoals();
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const deleteGoal = async (id: number) => {
    if (!confirm('Remove this goal?')) return;
    try {
      await api.delete(`/game-plan/goals/${id}`);
      loadGoals();
      toast.success('Removed');
    } catch { toast.error('Failed'); }
  };

  // ── Tasks ─────────────────────────────────────────────────────────────────

  const toggleTask = async (task: Task) => {
    try {
      const { data } = await api.patch(`/tasks/${task.id}/toggle`);
      setTasks(prev => prev.map(t => t.id === task.id ? data : t));
    } catch { toast.error('Failed'); }
  };

  const saveTask = async () => {
    if (!taskModal?.title?.trim()) { toast.error('Title required'); return; }
    setSaving(true);
    try {
      if (taskModal.id) {
        const { data } = await api.put(`/tasks/${taskModal.id}`, taskModal);
        setTasks(prev => prev.map(t => t.id === taskModal.id ? data : t));
      } else {
        const { data } = await api.post('/tasks', taskModal);
        setTasks(prev => [data, ...prev]);
      }
      setTaskModal(null);
      toast.success(taskModal.id ? 'Updated' : 'Task added');
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const deleteTask = async (id: number) => {
    if (!confirm('Delete this task?')) return;
    try {
      await api.delete(`/tasks/${id}`);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch { toast.error('Failed'); }
  };

  const visibleTasks = tasks.filter(t => taskFilter === 'open' ? !t.is_done : t.is_done);
  const openTaskCount = tasks.filter(t => !t.is_done).length;
  const totalGoalProgress = goals.reduce((a, g) => a + Math.min(g.completed_count, g.target_per_week), 0);
  const totalGoalTarget = goals.reduce((a, g) => a + g.target_per_week, 0);

  if (loading) return <div className="flex items-center justify-center h-64 text-ink-400">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-50 flex items-center gap-2">
            <SparklesIcon className="w-6 h-6 text-[#F96B2F]" /> Game Plan
          </h1>
          <p className="text-sm text-ink-400 mt-0.5">Week of {weekLabel(weekStart)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart(w => format(addDays(parseISO(w), -7), 'yyyy-MM-dd'))}
            className="btn bg-ink-700 text-ink-200 hover:bg-ink-600 text-xs px-3 py-1.5">← Prev</button>
          <button onClick={() => setWeekStart(getMondayOf())}
            className="btn bg-ink-700 text-ink-200 hover:bg-ink-600 text-xs px-3 py-1.5">This Week</button>
          <button onClick={() => setWeekStart(w => format(addDays(parseISO(w), 7), 'yyyy-MM-dd'))}
            className="btn bg-ink-700 text-ink-200 hover:bg-ink-600 text-xs px-3 py-1.5">Next →</button>
        </div>
      </div>

      {/* ── Overall week progress ── */}
      {totalGoalTarget > 0 && (
        <div className="card p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-ink-200">Weekly Progress</span>
            <span className="text-sm font-bold text-[#F96B2F]">{totalGoalProgress} / {totalGoalTarget}</span>
          </div>
          <div className="w-full bg-ink-700 rounded-full h-2.5">
            <div className="bg-[#F96B2F] h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (totalGoalProgress / totalGoalTarget) * 100)}%` }} />
          </div>
          {totalGoalProgress >= totalGoalTarget && (
            <p className="text-xs text-[#F96B2F] font-semibold mt-2 text-center">You crushed this week's goals! 🎉</p>
          )}
        </div>
      )}

      {/* ── Weekly Goals ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-ink-100">Weekly Goals</h2>
          <button onClick={() => setGoalModal({ title: '', category: 'Gov Contracting', target_per_week: 1 })}
            className="btn btn-gold text-xs px-3 py-1.5 flex items-center gap-1.5">
            <PlusIcon className="w-3.5 h-3.5" /> Add Goal
          </button>
        </div>

        <div className="space-y-3">
          {goals.map(goal => {
            const pct = Math.min(100, (goal.completed_count / goal.target_per_week) * 100);
            const done = goal.completed_count >= goal.target_per_week;
            const lastLog = goal.logs?.[0];
            return (
              <div key={goal.id} className={`card p-4 transition-all ${done ? 'border-[#F96B2F]/40' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-semibold text-sm ${done ? 'text-[#F96B2F]' : 'text-ink-50'}`}>{goal.title}</span>
                      {goal.category && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[goal.category] || 'bg-ink-700/20 text-ink-400'}`}>
                          {goal.category}
                        </span>
                      )}
                      {done && <span className="text-[10px] text-[#F96B2F] font-bold uppercase tracking-wide">✓ Done</span>}
                    </div>
                    {goal.notes && <p className="text-xs text-ink-400 mt-0.5">{goal.notes}</p>}

                    {/* Progress bar */}
                    <div className="mt-2.5">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-ink-400">{goal.completed_count} of {goal.target_per_week} this week</span>
                        {lastLog && (
                          <button onClick={() => undoLog(lastLog.id)}
                            className="text-[10px] text-ink-500 hover:text-red-400 transition-colors">undo last</button>
                        )}
                      </div>
                      <div className="w-full bg-ink-700 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full transition-all duration-500 ${done ? 'bg-[#F96B2F]' : 'bg-[#F96B2F]/60'}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
                    <button
                      onClick={() => logGoal(goal)}
                      disabled={done}
                      title={done ? 'Goal complete!' : 'Log one completion'}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all
                        ${done ? 'bg-[#F96B2F]/20 text-[#F96B2F] cursor-default' : 'bg-[#F96B2F] text-white hover:bg-[#E55A20] active:scale-95'}`}>
                      {done ? '✓' : '+'}
                    </button>
                    <button onClick={() => setGoalModal(goal)} className="p-1.5 text-ink-400 hover:text-ink-200 transition-colors">
                      <PencilIcon className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteGoal(goal.id)} className="p-1.5 text-ink-400 hover:text-red-500 transition-colors">
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Daily Task List ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-ink-100">Task List</h2>
            <p className="text-xs text-ink-400">{openTaskCount} open {openTaskCount === 1 ? 'task' : 'tasks'}</p>
          </div>
          <button onClick={() => setTaskModal({ title: '', priority: 'normal' })}
            className="btn btn-gold text-xs px-3 py-1.5 flex items-center gap-1.5">
            <PlusIcon className="w-3.5 h-3.5" /> Add Task
          </button>
        </div>

        {/* Filter */}
        <div className="flex gap-1 border-b border-ink-700 mb-3">
          {(['open','done'] as const).map(f => (
            <button key={f} onClick={() => setTaskFilter(f)}
              className={`px-4 py-1.5 text-xs font-medium capitalize border-b-2 -mb-px transition-colors
                ${taskFilter === f ? 'border-[#F96B2F] text-[#F96B2F]' : 'border-transparent text-ink-400 hover:text-ink-200'}`}>
              {f === 'open' ? 'Open' : 'Completed'}
            </button>
          ))}
        </div>

        {visibleTasks.length === 0 ? (
          <div className="text-center py-10">
            <CheckCircleIcon className="w-10 h-10 text-ink-600 mx-auto mb-2" />
            <p className="text-ink-400 text-sm">{taskFilter === 'done' ? 'No completed tasks yet' : 'No open tasks — you\'re all caught up!'}</p>
            {taskFilter === 'open' && (
              <button className="mt-3 btn btn-gold text-xs" onClick={() => setTaskModal({ title: '', priority: 'normal' })}>
                Add a task
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {visibleTasks.map(task => (
              <div key={task.id} className={`card p-3 flex gap-3 items-start ${task.is_done ? 'opacity-60' : ''}`}>
                <button onClick={() => toggleTask(task)} className="mt-0.5 flex-shrink-0 text-ink-400 hover:text-[#F96B2F] transition-colors">
                  {task.is_done
                    ? <CheckCircleSolid className="w-5 h-5 text-[#F96B2F]" />
                    : <CheckCircleIcon className="w-5 h-5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${task.is_done ? 'line-through text-ink-400' : 'text-ink-50'}`}>{task.title}</p>
                  {task.notes && <p className="text-xs text-ink-400 mt-0.5">{task.notes}</p>}
                  <div className="flex gap-2 mt-1.5 flex-wrap">
                    {task.priority !== 'normal' && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_STYLES[task.priority]}`}>
                        {task.priority === 'high' ? '↑ High' : '↓ Low'}
                      </span>
                    )}
                    {task.due_date && (
                      <span className="text-[10px] text-ink-400 flex items-center gap-0.5">
                        <CalendarDaysIcon className="w-3 h-3" />
                        {format(parseISO(task.due_date), 'MMM d')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => setTaskModal(task)} className="p-1 text-ink-400 hover:text-ink-200 transition-colors">
                    <PencilIcon className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteTask(task.id)} className="p-1 text-ink-400 hover:text-red-500 transition-colors">
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Goal Modal ── */}
      {goalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="card p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-ink-50">{goalModal.id ? 'Edit Goal' : 'New Weekly Goal'}</h2>
              <button onClick={() => setGoalModal(null)} className="text-ink-400 hover:text-ink-200"><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="field">
                <label className="label">Goal Title *</label>
                <input className="input" placeholder="e.g. Submit Proposals" value={goalModal.title||''} onChange={e => setGoalModal(m => ({ ...m!, title: e.target.value }))} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="field">
                  <label className="label">Target per Week</label>
                  <input type="number" min={1} max={100} className="input" value={goalModal.target_per_week||1} onChange={e => setGoalModal(m => ({ ...m!, target_per_week: parseInt(e.target.value)||1 }))} />
                </div>
                <div className="field">
                  <label className="label">Category</label>
                  <select className="input" value={goalModal.category||''} onChange={e => setGoalModal(m => ({ ...m!, category: e.target.value }))}>
                    <option value="">None</option>
                    <option>Gov Contracting</option>
                    <option>Carriers</option>
                    <option>Admin</option>
                    <option>Networking</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label className="label">Notes / Guidance</label>
                <textarea className="input" rows={2} placeholder="Why this goal matters..." value={goalModal.notes||''} onChange={e => setGoalModal(m => ({ ...m!, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button className="btn btn-gold flex-1" onClick={saveGoal} disabled={saving}>{saving ? 'Saving...' : goalModal.id ? 'Save' : 'Add Goal'}</button>
              <button className="btn bg-ink-700 text-ink-200 hover:bg-ink-600 flex-1" onClick={() => setGoalModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Task Modal ── */}
      {taskModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="card p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-ink-50">{taskModal.id ? 'Edit Task' : 'New Task'}</h2>
              <button onClick={() => setTaskModal(null)} className="text-ink-400 hover:text-ink-200"><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="field">
                <label className="label">Task *</label>
                <input className="input" placeholder="What needs to be done?" value={taskModal.title||''} onChange={e => setTaskModal(m => ({ ...m!, title: e.target.value }))} autoFocus />
              </div>
              <div className="field">
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={taskModal.notes||''} onChange={e => setTaskModal(m => ({ ...m!, notes: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="field">
                  <label className="label">Due Date</label>
                  <input type="date" className="input" value={taskModal.due_date||''} onChange={e => setTaskModal(m => ({ ...m!, due_date: e.target.value }))} />
                </div>
                <div className="field">
                  <label className="label">Priority</label>
                  <select className="input" value={taskModal.priority||'normal'} onChange={e => setTaskModal(m => ({ ...m!, priority: e.target.value as Task['priority'] }))}>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button className="btn btn-gold flex-1" onClick={saveTask} disabled={saving}>{saving ? 'Saving...' : taskModal.id ? 'Save' : 'Add Task'}</button>
              <button className="btn bg-ink-700 text-ink-200 hover:bg-ink-600 flex-1" onClick={() => setTaskModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
