'use client';
/**
 * @file User Management admin (Phase 4).
 * List (search + status/role filters, cursor paginated) + edit (status, active,
 * verified, role assignment) + soft-delete. Backed by /users and /admin/roles.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, Search, ChevronLeft, ChevronRight, ShieldCheck, BadgeCheck } from 'lucide-react';
import { usersApi, rolesApi, type UserSummary } from '@/features/admin/api/users-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const STATUSES = ['pending', 'active', 'suspended'];
const selCls = 'rounded-lg border bg-background p-2 text-sm';
const LIMIT = 20;
const statusVariant = (s: string): 'success' | 'warning' | 'destructive' | 'outline' =>
  s === 'active' ? 'success' : s === 'pending' ? 'warning' : s === 'suspended' ? 'destructive' : 'outline';

interface EditState { status: string; isActive: boolean; isVerified: boolean; roleId: string; }

export default function UsersAdminPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fRole, setFRole] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [stack, setStack] = useState<string[]>([]);

  const [editing, setEditing] = useState<UserSummary | null>(null);
  const [form, setForm] = useState<EditState>({ status: 'active', isActive: true, isVerified: true, roleId: '' });
  const [confirm, setConfirm] = useState<UserSummary | null>(null);

  const rolesQ = useQuery({ queryKey: ['admin', 'roles'], queryFn: () => rolesApi.list() });
  const roles = rolesQ.data ?? [];
  const roleBySlug = new Map(roles.map((r) => [r.slug, r.id]));

  const params = { search: q || undefined, status: fStatus || undefined, role: fRole || undefined, cursor: cursor || undefined, limit: LIMIT };
  const listQ = useQuery({ queryKey: ['admin', 'users', params], queryFn: () => usersApi.list(params), placeholderData: (p) => p });
  const users = listQ.data?.data ?? [];
  const pg = listQ.data?.pagination;

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'users'] });
  const resetPaging = () => { setCursor(null); setStack([]); };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      await usersApi.update(editing.id, { status: form.status, isActive: form.isActive, isVerified: form.isVerified });
      if (form.roleId && form.roleId !== roleBySlug.get(editing.role)) {
        await usersApi.assignRole(editing.id, form.roleId);
      }
    },
    onSuccess: () => { toast.success('Saved', 'User updated.'); setEditing(null); invalidate(); },
    onError: (e) => toast.fromError(e, 'Could not update user'),
  });

  const delMut = useMutation({
    mutationFn: (u: UserSummary) => usersApi.remove(u.id),
    onSuccess: () => { toast.success('Deleted', 'User removed.'); setConfirm(null); invalidate(); },
    onError: (e) => { toast.fromError(e, 'Could not delete user'); setConfirm(null); },
  });

  function openEdit(u: UserSummary) {
    setEditing(u);
    setForm({ status: u.status, isActive: u.isActive ?? true, isVerified: u.isVerified, roleId: '' });
  }

  return (
    <div>
      <div>
        <h1 className="font-display text-2xl font-semibold">User Management</h1>
        <p className="text-sm text-muted-foreground">Manage accounts, status, verification and roles.</p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <form className="relative lg:col-span-2" onSubmit={(e) => { e.preventDefault(); resetPaging(); setQ(search.trim()); }}>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search email / username…" className="pl-9" />
        </form>
        <select className={selCls} value={fStatus} onChange={(e) => { setFStatus(e.target.value); resetPaging(); }} aria-label="Status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className={selCls} value={fRole} onChange={(e) => { setFRole(e.target.value); resetPaging(); }} aria-label="Role">
          <option value="">All roles</option>
          {roles.map((r) => <option key={r.id} value={r.slug}>{r.name}</option>)}
        </select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 font-medium">Email</th>
              <th className="p-3 font-medium">Username</th>
              <th className="p-3 font-medium">Role</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Verified</th>
              <th className="w-24 p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {listQ.isLoading ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground"><Spinner /></td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No users found.</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="border-b last:border-0 hover:bg-secondary/40">
                <td className="p-3">{u.email}</td>
                <td className="p-3 text-muted-foreground">{u.username ?? '—'}</td>
                <td className="p-3"><Badge variant="outline"><ShieldCheck className="mr-1 h-3 w-3" />{u.role}</Badge></td>
                <td className="p-3"><Badge variant={statusVariant(u.status)}>{u.status}</Badge></td>
                <td className="p-3">{u.isVerified ? <BadgeCheck className="h-4 w-4 text-success" /> : <span className="text-xs text-muted-foreground">no</span>}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" title="Edit" onClick={() => openEdit(u)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" title="Delete" onClick={() => setConfirm(u)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>{pg?.total != null ? `${pg.total} total` : ''}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={stack.length === 0} onClick={() => { const s = [...stack]; const prev = s.pop() ?? null; setStack(s); setCursor(prev); }}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" disabled={!pg?.hasMore} onClick={() => { if (pg?.cursor) { setStack((s) => [...s, cursor ?? '']); setCursor(pg.cursor); } }}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Edit */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>{editing?.email}</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }} className="space-y-4 py-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Status</label>
              <select className={`${selCls} w-full`} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Assign role</label>
              <select className={`${selCls} w-full`} value={form.roleId} onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}>
                <option value="">— keep current ({editing?.role}) —</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">Selecting a role grants it to the user.</p>
            </div>
            <div className="flex gap-6 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} /> Active</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.isVerified} onChange={(e) => setForm((f) => ({ ...f, isVerified: e.target.checked }))} /> Verified</label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" disabled={saveMut.isPending}>{saveMut.isPending ? <Spinner className="text-primary-foreground" /> : 'Save changes'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Delete user</DialogTitle>
            <DialogDescription>Soft-delete {confirm?.email} and revoke their sessions. Super-admins and your own account cannot be deleted.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant="destructive" disabled={delMut.isPending} onClick={() => confirm && delMut.mutate(confirm)}>{delMut.isPending ? <Spinner className="text-primary-foreground" /> : 'Delete'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
