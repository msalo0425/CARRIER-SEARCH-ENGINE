import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { PlusIcon, TrashIcon, CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, parseISO, addMonths, subMonths } from 'date-fns';
import { useAuthStore } from '../../store/authStore';

interface CalendarEvent {
  id: number;
  title: string;
  event_type: string;
  event_date?: string;
  start_date: string;
  end_date?: string;
  notes?: string;
  related_proposal_id?: number;
  related_opportunity_id?: number;
  created_at: string;
}

const EVENT_TYPES = ['Proposal Due', 'Sources Sought Due', 'Meeting', 'Conference', 'Reminder', 'Contract Start', 'Contract End', 'Follow-Up', 'Other'];

const TYPE_COLORS: Record<string, string> = {
  'Proposal Due': 'bg-red-600',
  'Sources Sought Due': 'bg-orange-600',
  'Meeting': 'bg-blue-600',
  'Conference': 'bg-purple-600',
  'Reminder': 'bg-gold-600',
  'Contract Start': 'bg-green-600',
  'Contract End': 'bg-red-700',
  'Follow-Up': 'bg-amber-600',
  'Other': 'bg-ink-500',
};

const EMPTY: Partial<CalendarEvent> = { title: '', event_type: 'Reminder', start_date: format(new Date(), 'yyyy-MM-dd'), end_date: '', notes: '' };

export default function CalendarPage() {
  const { user } = useAuthStore();
  const isViewer = user?.role === 'viewer';
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [modal, setModal] = useState<Partial<CalendarEvent> | null>(null);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'month' | 'list'>('month');

  const load = async () => {
    try {
      const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      const { data } = await api.get('/govcon/calendar', { params: { start, end } });
      setEvents(data || []);
    } catch { toast.error('Failed to load calendar'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [currentMonth]);

  const save = async () => {
    if (!modal?.title?.trim()) { toast.error('Title required'); return; }
    if (!modal?.start_date) { toast.error('Date required'); return; }
    setSaving(true);
    try {
      const { data } = await api.post('/govcon/calendar', { ...modal, start_date: modal.start_date });
      setEvents(prev => [...prev, data]);
      toast.success('Event created'); setModal(null);
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const del = async (id: number) => {
    try { await api.delete(`/govcon/calendar/${id}`); setEvents(prev => prev.filter(e => e.id !== id)); toast.success('Deleted'); }
    catch { toast.error('Failed'); }
  };

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const firstDayOfWeek = startOfMonth(currentMonth).getDay();
  const eventsOnDay = (day: Date) => events.filter(e => { try { return isSameDay(parseISO(e.start_date || e.event_date || ''), day); } catch { return false; } });
  const selectedDayEvents = selectedDay ? eventsOnDay(selectedDay) : [];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Calendar & Reminders</h1>
          <p className="page-sub">{events.length} events this month</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setView('month')} className={`btn ${view === 'month' ? 'btn-gold' : 'btn-ghost'} text-sm`}>Month</button>
          <button onClick={() => setView('list')} className={`btn ${view === 'list' ? 'btn-gold' : 'btn-ghost'} text-sm`}>List</button>
          {!isViewer && (
            <button onClick={() => { setModal({ ...EMPTY, start_date: selectedDay ? format(selectedDay, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd') }); }} className="btn btn-gold flex items-center gap-2">
              <PlusIcon className="w-4 h-4" /> Add Event
            </button>
          )}
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-4">
        <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="btn btn-ghost p-2"><ChevronLeftIcon className="w-4 h-4" /></button>
        <h2 className="text-lg font-bold text-white w-48 text-center">{format(currentMonth, 'MMMM yyyy')}</h2>
        <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="btn btn-ghost p-2"><ChevronRightIcon className="w-4 h-4" /></button>
        <button onClick={() => setCurrentMonth(new Date())} className="btn btn-outline text-xs px-3">Today</button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1.5 text-xs text-ink-300">
            <span className={`w-2.5 h-2.5 rounded-full ${color}`} />{type}
          </span>
        ))}
      </div>

      {view === 'month' && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="card overflow-hidden">
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-ink-700">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                  <div key={d} className="text-center text-xs font-semibold text-ink-400 py-2">{d}</div>
                ))}
              </div>
              {/* Calendar grid */}
              <div className="grid grid-cols-7">
                {/* Leading empty cells */}
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square border-r border-b border-ink-700/50 bg-ink-900/30" />
                ))}
                {days.map(day => {
                  const dayEvents = eventsOnDay(day);
                  const isSelected = selectedDay && isSameDay(day, selectedDay);
                  return (
                    <button
                      key={day.toString()}
                      onClick={() => setSelectedDay(isSelected ? null : day)}
                      className={`aspect-square border-r border-b border-ink-700/50 p-1 text-left hover:bg-ink-700/30 transition-colors ${isSelected ? 'bg-gold-900/20' : ''} ${isToday(day) ? 'bg-gold-950/30' : ''}`}
                    >
                      <span className={`text-xs font-medium block mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday(day) ? 'bg-gold-500 text-ink-950 font-bold' : isSameMonth(day, currentMonth) ? 'text-white' : 'text-ink-600'}`}>
                        {format(day, 'd')}
                      </span>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 2).map(e => (
                          <div key={e.id} className={`${TYPE_COLORS[e.event_type] || 'bg-ink-500'} rounded text-[9px] text-white px-1 py-0.5 truncate`}>{e.title}</div>
                        ))}
                        {dayEvents.length > 2 && <div className="text-[9px] text-ink-400">+{dayEvents.length - 2} more</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Day detail panel */}
          <div className="card">
            {selectedDay ? (
              <>
                <div className="flex items-center justify-between p-4 border-b border-ink-700">
                  <h3 className="font-semibold text-white text-sm">{format(selectedDay, 'EEEE, MMMM d')}</h3>
                  {!isViewer && (
                    <button onClick={() => setModal({ ...EMPTY, start_date: format(selectedDay, 'yyyy-MM-dd') })} className="btn btn-ghost p-1 text-gold-400">
                      <PlusIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="divide-y divide-ink-700">
                  {selectedDayEvents.length === 0 ? (
                    <div className="p-6 text-center text-ink-400 text-sm">No events this day.</div>
                  ) : selectedDayEvents.map(e => (
                    <div key={e.id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${TYPE_COLORS[e.event_type] || 'bg-ink-500'}`} />
                            <span className="text-sm font-medium text-white">{e.title}</span>
                          </div>
                          <span className="text-xs text-ink-400 ml-4">{e.event_type}</span>
                          {e.notes && <p className="text-xs text-ink-400 mt-1 ml-4">{e.notes}</p>}
                        </div>
                        {!isViewer && <button onClick={() => del(e.id)} className="btn btn-ghost p-1 text-red-400 flex-shrink-0"><TrashIcon className="w-3.5 h-3.5" /></button>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="p-6 text-center text-ink-400">
                <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Click a day to view events</p>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'list' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-800 border-b border-ink-700">
              <tr>
                <th className="th text-left">Event</th>
                <th className="th">Type</th>
                <th className="th">Date</th>
                <th className="th">End Date</th>
                <th className="th">Notes</th>
                {!isViewer && <th className="th">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-ink-400 text-sm">No events this month.</td></tr>
              ) : events.sort((a, b) => (a.start_date||'').localeCompare(b.start_date||'')).map(e => (
                <tr key={e.id} className="tr-hover">
                  <td className="td font-medium text-white">{e.title}</td>
                  <td className="td text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] text-white ${TYPE_COLORS[e.event_type] || 'bg-ink-500'}`}>{e.event_type}</span>
                  </td>
                  <td className="td text-center text-xs text-ink-300">{e.start_date ? format(parseISO(e.start_date), 'MMM d, yyyy') : '—'}</td>
                  <td className="td text-center text-xs text-ink-400">{e.end_date ? format(parseISO(e.end_date), 'MMM d') : '—'}</td>
                  <td className="td text-xs text-ink-400 max-w-[180px] truncate">{e.notes || '—'}</td>
                  {!isViewer && (
                    <td className="td text-center">
                      <button onClick={() => del(e.id)} className="btn btn-ghost py-0.5 px-1.5 text-red-400"><TrashIcon className="w-3.5 h-3.5" /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {modal && !isViewer && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">Add Event</h2>
            <div className="field">
              <label className="label">Title *</label>
              <input className="input" value={modal.title || ''} onChange={e => setModal(m => ({ ...m!, title: e.target.value }))} />
            </div>
            <div className="field">
              <label className="label">Event Type</label>
              <select className="select" value={modal.event_type || 'Reminder'} onChange={e => setModal(m => ({ ...m!, event_type: e.target.value }))}>
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label className="label">Start Date *</label>
                <input type="date" className="input" value={modal.start_date || ''} onChange={e => setModal(m => ({ ...m!, start_date: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">End Date</label>
                <input type="date" className="input" value={modal.end_date || ''} onChange={e => setModal(m => ({ ...m!, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="field">
              <label className="label">Notes</label>
              <textarea className="input" rows={3} value={modal.notes || ''} onChange={e => setModal(m => ({ ...m!, notes: e.target.value }))} />
            </div>
            <div className="flex gap-3">
              <button onClick={save} disabled={saving} className="btn btn-gold flex-1">Save</button>
              <button onClick={() => setModal(null)} className="btn btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
