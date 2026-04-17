import React, { useEffect, useState } from 'react';
import { PlusIcon, TrashIcon, PencilIcon, CheckCircleIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import api from '../api/client';
import toast from 'react-hot-toast';
import { format, parseISO, isToday, isPast, isTomorrow } from 'date-fns';

interface Task {
  id: number;
  title: string;
  notes?: string;
  is_done: boolean;
  due_date?: string;
  priority: 'low' | 'normal' | 'high';
  created_by_name?: string;
  created_at: string;
  done_at?: string;
}

const PRIORITY_STYLES: Record<string, string> = {
  high:   'bg-red-100 text-red-700',
  normal: 'bg-blue-100 text-blue-700',
  low:    'bg-ink-700/20 text-ink-400',
};

function dueBadge(due?: string): { label: string; cls: string } | null {
  if (!due) return null;
  const d = parseISO(due);
  if (isToday(d)) return { label: 'Due Today', cls: 'bg-orange-100 text-orange-700' };
  if (isTomorrow(d)) return { label: 'Due Tomorrow', cls: 'bg-yellow-100 text-yellow-700' };
  if (isPast(d)) return { label: `Overdue · ${format(d, 'MMM d')}`, cls: 'bg-red-100 text-red-700' };
  return { label: format(d, 'MMM d, yyyy'), cls: 'bg-ink-700/10 text-ink-300' };
}

const EMPTY: Partial<Task> = { title: '', notes: '', priority: 'normal', due_date: '' };

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Partial<Task> | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('open');

  const load = () => {
    api.get('/tasks').then(r => setTasks(r.data || [])).catch(() => toast.error('Failed to load tasks')).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggle = async (task: Task) => {
    try {
      const { data } = await api.patch(`/tasks/${task.id}/toggle`);
      setTasks(prev => prev.map(t => t.id === task.id ? data : t));
    } catch { toast.error('Failed to update'); }
  };

  const save = async () => {
    if (!modal?.title?.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      if (modal.id) {
        const { data } = await api.put(`/tasks/${modal.id}`, modal);
        setTasks(prev => prev.map(t => t.id === modal.id ? data : t));
        toast.success('Task updated');
      } else {
        const { data } = await api.post('/tasks', modal);
        setTasks(prev => [data, ...prev]);
        toast.success('Task added');
      }
      setModal(null);
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const del = async (id: number) => {
    if (!confirm('Delete this task?')) return;
    try {
      await api.delete(`/tasks/${id}`);
      setTasks(prev => prev.filter(t => t.id !== id));
      toast.success('Deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const visible = tasks.filter(t =>
    filter === 'all' ? true : filter === 'open' ? !t.is_done : t.is_done
  );

  const openCount = tasks.filter(t => !t.is_done).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-50">Tasks</h1>
          <p className="text-sm text-ink-400 mt-0.5">{openCount} open {openCount === 1 ? 'task' : 'tasks'}</p>
        </div>
        <button className="btn btn-gold flex items-center gap-2" onClick={() => setModal({ ...EMPTY })}>
          <PlusIcon className="w-4 h-4" /> Add Task
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-ink-700">
        {(['open','all','done'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${filter === f ? 'border-[#F96B2F] text-[#F96B2F]' : 'border-transparent text-ink-400 hover:text-ink-200'}`}>
            {f === 'open' ? 'Open' : f === 'done' ? 'Completed' : 'All'}
          </button>
        ))}
      </div>

      {/* Task list */}
      {loading ? (
        <div className="text-center py-16 text-ink-400">Loading...</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircleIcon className="w-12 h-12 text-ink-600 mx-auto mb-3" />
          <p className="text-ink-400 font-medium">{filter === 'done' ? 'No completed tasks yet' : 'No open tasks — you\'re all caught up!'}</p>
          {filter === 'open' && <button className="mt-4 btn btn-gold text-sm" onClick={() => setModal({ ...EMPTY })}>Add your first task</button>}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(task => {
            const due = dueBadge(task.due_date);
            return (
              <div key={task.id} className={`card p-4 flex gap-3 items-start transition-opacity ${task.is_done ? 'opacity-60' : ''}`}>
                {/* Checkbox */}
                <button onClick={() => toggle(task)} className="mt-0.5 flex-shrink-0 text-ink-400 hover:text-[#F96B2F] transition-colors">
                  {task.is_done
                    ? <CheckCircleSolid className="w-5 h-5 text-[#F96B2F]" />
                    : <CheckCircleIcon className="w-5 h-5" />}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-ink-50 ${task.is_done ? 'line-through text-ink-400' : ''}`}>{task.title}</p>
                  {task.notes && <p className="text-sm text-ink-400 mt-0.5 whitespace-pre-wrap">{task.notes}</p>}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {task.priority !== 'normal' && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_STYLES[task.priority]}`}>
                        {task.priority === 'high' ? '↑ High' : '↓ Low'}
                      </span>
                    )}
                    {due && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${due.cls}`}>
                        <CalendarDaysIcon className="w-3 h-3" />{due.label}
                      </span>
                    )}
                    {task.is_done && task.done_at && (
                      <span className="text-xs text-ink-500">Completed {format(parseISO(task.done_at), 'MMM d')}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => setModal(task)} className="p-1.5 text-ink-400 hover:text-ink-200 rounded transition-colors">
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button onClick={() => del(task.id)} className="p-1.5 text-ink-400 hover:text-red-500 rounded transition-colors">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="card p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold text-ink-50 mb-4">{modal.id ? 'Edit Task' : 'New Task'}</h2>
            <div className="space-y-4">
              <div className="field">
                <label className="label">Task Title *</label>
                <input className="input" placeholder="What needs to be done?" value={modal.title||''} onChange={e => setModal(m => ({ ...m!, title: e.target.value }))} autoFocus />
              </div>
              <div className="field">
                <label className="label">Notes</label>
                <textarea className="input" rows={3} placeholder="Additional details..." value={modal.notes||''} onChange={e => setModal(m => ({ ...m!, notes: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="field">
                  <label className="label">Due Date</label>
                  <input type="date" className="input" value={modal.due_date||''} onChange={e => setModal(m => ({ ...m!, due_date: e.target.value }))} />
                </div>
                <div className="field">
                  <label className="label">Priority</label>
                  <select className="input" value={modal.priority||'normal'} onChange={e => setModal(m => ({ ...m!, priority: e.target.value as Task['priority'] }))}>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn btn-gold flex-1" onClick={save} disabled={saving}>{saving ? 'Saving...' : modal.id ? 'Save Changes' : 'Add Task'}</button>
              <button className="btn flex-1 bg-ink-700 text-ink-200 hover:bg-ink-600" onClick={() => setModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
