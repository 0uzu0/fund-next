import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { getApiBase, apiGet, apiPost } from '../../utils/apiClient';
import { toast } from '../../utils/toast';

type UserRow = {
  id: number;
  username: string;
  is_admin: boolean;
  created_at: string;
};

export default function AdminUsers() {
  const router = useRouter();
  const [auth, setAuth] = useState<{ username: string; is_admin?: boolean } | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addUsername, setAddUsername] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addConfirm, setAddConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchUsers = useCallback(() => {
    apiGet<{ users?: UserRow[] }>(getApiBase() + '/api/admin/users', { cache: { ttl: 0 } })
      .then((data) => setUsers(data.users || []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    apiGet<{ username?: string; is_admin?: boolean }>(getApiBase() + '/api/auth/me', { cache: { ttl: 0 } })
      .then((data) => {
        setAuth({ username: data.username ?? '', is_admin: data.is_admin });
        if (!data.is_admin) router.replace('/portfolio');
        else fetchUsers();
      })
      .catch(() => router.replace('/login?redirect=/admin/users'));
  }, [router, fetchUsers]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = addUsername.trim();
    if (!u || !addPassword) {
      toast.error('请输入用户名和密码');
      return;
    }
    if (u.length < 3 || u.length > 20) {
      toast.error('用户名长度应为 3–20 个字符');
      return;
    }
    if (addPassword.length < 6) {
      toast.error('密码长度至少为 6 个字符');
      return;
    }
    if (addPassword !== addConfirm) {
      toast.error('两次输入的密码不一致');
      return;
    }
    setSubmitting(true);
    try {
      const data = await apiPost<{ success?: boolean; message?: string }>(
        getApiBase() + '/api/admin/add-user',
        { username: u, password: addPassword }
      );
      if (data.success) {
        toast.success(data.message || '用户已创建');
        setAddUsername('');
        setAddPassword('');
        setAddConfirm('');
        fetchUsers();
      } else {
        toast.error(data.message || '创建失败');
      }
    } catch {
      toast.error('请求失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (user: UserRow) => {
    if (!confirm('确定要删除用户「' + user.username + '」吗？其基金数据将一并删除。')) return;
    setDeletingId(user.id);
    apiPost<{ success?: boolean; message?: string }>(getApiBase() + '/api/admin/delete-user', { user_id: user.id })
      .then((data) => {
        if (data.success) {
          toast.success(data.message || '已删除');
          fetchUsers();
        } else {
          toast.error(data.message || '删除失败');
        }
      })
      .catch(() => toast.error('请求失败'))
      .finally(() => setDeletingId(null));
  };

  if (!auth) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        加载中…
      </div>
    );
  }

  if (!auth.is_admin) return null;

  return (
    <>
      <Head><title>用户管理 - LanFund</title></Head>
          <h1 style={{ marginBottom: 4 }}>用户管理</h1>
          <p style={{ color: 'var(--text-dim)', marginBottom: 24 }}>
            新增用户、查看与删除已有用户；
            <Link href="/admin/profile" style={{ color: 'var(--accent)', marginLeft: 8 }}>修改管理员账号</Link>
          </p>

          <div className="content-card" style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: '1rem', color: 'var(--text-dim)', marginBottom: 16 }}>新增用户</h2>
            <form onSubmit={handleAddUser}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: 'var(--text-dim)' }}>用户名</label>
                <input
                  type="text"
                  value={addUsername}
                  onChange={(e) => setAddUsername(e.target.value)}
                  placeholder="3-20 个字符"
                  minLength={3}
                  maxLength={20}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text-main)', fontSize: 14 }}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: 'var(--text-dim)' }}>密码</label>
                <input
                  type="password"
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  placeholder="至少 6 位"
                  minLength={6}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text-main)', fontSize: 14 }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: 'var(--text-dim)' }}>确认密码</label>
                <input
                  type="password"
                  value={addConfirm}
                  onChange={(e) => setAddConfirm(e.target.value)}
                  placeholder="再次输入密码"
                  minLength={6}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text-main)', fontSize: 14 }}
                />
              </div>
              <button type="submit" className="btn" style={{ background: 'var(--accent)', color: '#fff' }} disabled={submitting}>
                {submitting ? '创建中…' : '创建用户'}
              </button>
            </form>
          </div>

          <div className="content-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>已有用户</div>
            <div style={{ padding: 16 }}>
              {loading ? (
                <p style={{ color: 'var(--text-dim)' }}>加载中…</p>
              ) : users.length === 0 ? (
                <p style={{ color: 'var(--text-dim)' }}>暂无用户</p>
              ) : (
                <div className="table-container">
                  <table className="style-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>用户名</th>
                        <th>创建时间</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td>{u.id}</td>
                          <td>
                            {u.username}
                            {u.is_admin && <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'var(--accent)', color: '#fff' }}>管理员</span>}
                          </td>
                          <td style={{ color: 'var(--text-dim)' }}>{u.created_at || '—'}</td>
                          <td>
                            {!u.is_admin && u.username !== auth.username ? (
                              <button type="button" className="btn" style={{ background: 'var(--down-color)', color: '#fff', padding: '6px 12px', fontSize: 13 }} onClick={() => handleDelete(u)} disabled={deletingId === u.id}>
                                {deletingId === u.id ? '删除中…' : '删除'}
                              </button>
                            ) : (
                              <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
    </>
  );
}
