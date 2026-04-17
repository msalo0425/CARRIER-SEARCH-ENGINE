import React, { useEffect, useState, useRef } from 'react';
import api from '../../api/client';
import { DocumentTextIcon, ArrowUpTrayIcon, ArrowDownTrayIcon, TrashIcon, MagnifyingGlassIcon, FolderIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { useAuthStore } from '../../store/authStore';

interface Document {
  id: number;
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type?: string;
  category?: string;
  description?: string;
  version?: string;
  uploaded_by_name?: string;
  created_at: string;
}

const CATEGORIES = ['Proposals', 'Certifications', 'Contracts', 'Teaming Agreements', 'Past Performance', 'Company Capabilities', 'Financial Documents', 'Insurance Certificates', 'Templates', 'Misc'];

export default function DocumentsPage() {
  const { user } = useAuthStore();
  const isViewer = user?.role === 'viewer';
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadCat, setUploadCat] = useState('Misc');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadVersion, setUploadVersion] = useState('1.0');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const params: Record<string, string> = {};
      if (q) params.q = q;
      if (catFilter) params.category = catFilter;
      const { data } = await api.get('/govcon/documents', { params });
      setDocs(data || []);
    } catch { toast.error('Failed to load documents'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const upload = async () => {
    if (!fileRef.current?.files?.length) { toast.error('Select a file'); return; }
    setUploading(true);
    const formData = new FormData();
    formData.append('file', fileRef.current.files[0]);
    formData.append('category', uploadCat);
    formData.append('description', uploadDesc);
    formData.append('version', uploadVersion);
    try {
      const { data } = await api.post('/govcon/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setDocs(prev => [data, ...prev]);
      setShowUpload(false); setUploadDesc(''); setUploadVersion('1.0');
      if (fileRef.current) fileRef.current.value = '';
      toast.success('Uploaded');
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const download = async (doc: Document) => {
    try {
      const res = await api.get(`/govcon/documents/${doc.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a'); a.href = url; a.download = doc.original_filename || doc.filename; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Download failed'); }
  };

  const del = async (id: number) => {
    if (!confirm('Delete this document?')) return;
    try { await api.delete(`/govcon/documents/${id}`); setDocs(prev => prev.filter(d => d.id !== id)); toast.success('Deleted'); }
    catch { toast.error('Failed'); }
  };

  const formatSize = (bytes: number) => {
    if (bytes > 1e6) return `${(bytes/1e6).toFixed(1)} MB`;
    if (bytes > 1e3) return `${(bytes/1e3).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  const fmtDate = (s: string) => { try { return format(parseISO(s), 'MMM d, yyyy'); } catch { return s; } };

  const byCategory = CATEGORIES.map(cat => ({ cat, docs: docs.filter(d => (d.category || 'Misc') === cat) })).filter(g => g.docs.length > 0);
  const filtered = q || catFilter ? docs : null;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Document Library</h1>
          <p className="page-sub">{docs.length} documents · {CATEGORIES.length} categories</p>
        </div>
        {!isViewer && (
          <button onClick={() => setShowUpload(!showUpload)} className="btn btn-gold flex items-center gap-2">
            <ArrowUpTrayIcon className="w-4 h-4" /> Upload Document
          </button>
        )}
      </div>

      {/* Upload panel */}
      {showUpload && !isViewer && (
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-ink-50">Upload Document</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="field sm:col-span-3">
              <label className="label">File *</label>
              <input ref={fileRef} type="file" className="input py-2" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg" />
            </div>
            <div className="field">
              <label className="label">Category</label>
              <select className="select" value={uploadCat} onChange={e => setUploadCat(e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">Version</label>
              <input className="input" value={uploadVersion} onChange={e => setUploadVersion(e.target.value)} placeholder="1.0" />
            </div>
            <div className="field sm:col-span-3">
              <label className="label">Description</label>
              <input className="input" value={uploadDesc} onChange={e => setUploadDesc(e.target.value)} placeholder="Brief description of this document..." />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={upload} disabled={uploading} className="btn btn-gold">{uploading ? 'Uploading...' : 'Upload'}</button>
            <button onClick={() => setShowUpload(false)} className="btn btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input className="input pl-9" placeholder="Search documents..." value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} />
        </div>
        <select className="select w-48" value={catFilter} onChange={e => { setCatFilter(e.target.value); }}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={load} className="btn btn-outline text-sm">Search</button>
      </div>

      {/* Document grid — by category if no filter */}
      {filtered ? (
        <DocTable docs={filtered} onDownload={download} onDelete={del} formatSize={formatSize} fmtDate={fmtDate} isViewer={isViewer} />
      ) : (
        <div className="space-y-6">
          {docs.length === 0 ? (
            <div className="card p-16 text-center">
              <FolderIcon className="w-12 h-12 mx-auto mb-4 text-ink-600" />
              <p className="text-ink-50 font-medium">No documents yet</p>
              <p className="text-ink-400 text-sm mt-1">Upload your first document to get started</p>
            </div>
          ) : byCategory.map(({ cat, docs: catDocs }) => (
            <div key={cat} className="card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-ink-700 bg-ink-800/50">
                <FolderIcon className="w-4 h-4 text-gold-400" />
                <h3 className="text-sm font-semibold text-ink-50">{cat}</h3>
                <span className="text-xs text-ink-400 ml-auto">{catDocs.length} file{catDocs.length !== 1 ? 's' : ''}</span>
              </div>
              <DocTable docs={catDocs} onDownload={download} onDelete={del} formatSize={formatSize} fmtDate={fmtDate} isViewer={isViewer} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DocTable({ docs, onDownload, onDelete, formatSize, fmtDate, isViewer }: {
  docs: any[]; onDownload: (d: any) => void; onDelete: (id: number) => void;
  formatSize: (b: number) => string; fmtDate: (s: string) => string; isViewer: boolean;
}) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-ink-800/30 border-b border-ink-700">
        <tr>
          <th className="th text-left">File Name</th>
          <th className="th">Description</th>
          <th className="th">Version</th>
          <th className="th">Size</th>
          <th className="th">Uploaded By</th>
          <th className="th">Date</th>
          <th className="th">Actions</th>
        </tr>
      </thead>
      <tbody>
        {docs.map(d => (
          <tr key={d.id} className="tr-hover">
            <td className="td">
              <div className="flex items-center gap-2">
                <DocumentTextIcon className="w-4 h-4 text-ink-400 flex-shrink-0" />
                <span className="text-ink-50 font-medium text-xs truncate max-w-[180px]">{d.original_filename || d.filename}</span>
              </div>
            </td>
            <td className="td text-center text-xs text-ink-400"><span className="truncate block max-w-[160px]">{d.description || '—'}</span></td>
            <td className="td text-center text-xs text-ink-400">v{d.version || '1.0'}</td>
            <td className="td text-center text-xs text-ink-400">{formatSize(d.file_size || 0)}</td>
            <td className="td text-center text-xs text-ink-400">{d.uploaded_by_name || '—'}</td>
            <td className="td text-center text-xs text-ink-400">{fmtDate(d.created_at)}</td>
            <td className="td">
              <div className="flex items-center justify-center gap-1">
                <button onClick={() => onDownload(d)} className="btn btn-ghost py-0.5 px-1.5 text-gold-400"><ArrowDownTrayIcon className="w-3.5 h-3.5" /></button>
                {!isViewer && <button onClick={() => onDelete(d.id)} className="btn btn-ghost py-0.5 px-1.5 text-red-400"><TrashIcon className="w-3.5 h-3.5" /></button>}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
