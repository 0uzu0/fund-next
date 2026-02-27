import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { apiGet, apiPost, apiPut, apiDelete, getApiBase } from '../../utils/apiClient';
import { toast } from '../../utils/toast';

interface ApiKey {
  id: number;
  name: string;
  description?: string;
  permissions: string;
  rate_limit: number;
  active: number;
  last_used_at?: string;
  created_at: string;
  expires_at?: string;
  bind_user_id?: number;
  bind_username?: string;
  created_by?: string;
}

interface User {
  id: number;
  username: string;
  is_admin: boolean;
}

export default function ApiKeysManagement() {
  const router = useRouter();
  const [auth, setAuth] = useState<{ username: string; is_admin?: boolean } | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: 'read',
    rateLimit: 100,
    expiresAt: '',
    bindUserId: ''
  });

  useEffect(() => {
    // 检查登录状态
    apiGet<{ username?: string; is_admin?: boolean }>(getApiBase() + '/api/auth/me', { cache: { ttl: 0 } })
      .then((data) => {
        setAuth({ username: data.username ?? '', is_admin: data.is_admin });
        if (!data.is_admin) {
          router.replace('/portfolio');
        } else {
          // 管理员认证通过后立即加载数据
          loadData();
        }
      })
      .catch(() => router.replace('/login?redirect=/admin/api-keys'));
  }, [router]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [keysRes, usersRes] = await Promise.all([
        apiGet<{ success?: boolean; data?: ApiKey[]; rows?: ApiKey[]; message?: string }>(
          getApiBase() + '/api/admin/api-keys',
          { cache: { ttl: 0 } }
        ),
        apiGet<{ success?: boolean; data?: User[]; message?: string }>(
          getApiBase() + '/api/admin/users',
          { cache: { ttl: 0 } }
        )
      ]);
      
      console.log('API Keys response:', keysRes); // 调试用
      console.log('Users response:', usersRes); // 调试用
      
      // 处理 API Keys 响应 - 后端返回 { success: true, data: [...], pagination: {...} }
      if (keysRes.success) {
        setApiKeys(keysRes.data || keysRes.rows || []);
      } else {
        console.error('获取 API Keys 失败:', keysRes.message || '未知错误');
      }
      
      // 处理 Users 响应 - 后端返回 { success: true, data: [...] }
      console.log('Users response debug:', JSON.stringify(usersRes, null, 2)); // 详细调试
      if (usersRes.success && usersRes.data) {
        setUsers(usersRes.data);
        console.log('Users loaded count:', usersRes.data.length);
      } else {
        console.error('获取用户列表失败 - 完整响应:', usersRes);
        console.error('获取用户列表失败 - message:', usersRes.message);
        console.error('获取用户列表失败 - success:', usersRes.success);
        console.error('获取用户列表失败 - data:', usersRes.data);
      }
    } catch (error: any) {
      console.error('加载数据失败:', error);
      // 如果是 401 未授权，不显示 toast，让认证逻辑处理跳转
      if (error?.status === 401 || error?.message?.includes('unauthorized')) {
        return;
      }
      // 只在真正发生异常时显示 toast
      if (error instanceof Error) {
        toast.error('加载数据失败: ' + error.message);
      } else {
        toast.error('加载数据失败，请检查网络连接或刷新页面重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiPost<{
        success?: boolean;
        data?: { api_key?: string };
        message?: string;
      }>(getApiBase() + '/api/admin/api-keys', {
        name: formData.name,
        description: formData.description,
        permissions: formData.permissions,
        rateLimit: parseInt(formData.rateLimit.toString()),
        expiresAt: formData.expiresAt || undefined,
        bindUserId: formData.bindUserId ? parseInt(formData.bindUserId) : undefined
      });

      console.log('Create API Key response:', res); // 调试用

      if (res.success) {
        // 后端返回 { success: true, data: { api_key: 'xxx' } }
        const apiKey = res.data?.api_key;
        setNewlyCreatedKey(apiKey || null);
        setFormData({
          name: '',
          description: '',
          permissions: 'read',
          rateLimit: 100,
          expiresAt: '',
          bindUserId: ''
        });
        // 延迟刷新数据，确保数据库已更新
        setTimeout(() => {
          loadData();
        }, 500);
        toast.success('API Key 创建成功' + (apiKey ? '，请复制保存' : ''));
      } else {
        toast.error(res.message || '创建失败');
      }
    } catch (error) {
      console.error('创建 API Key 失败:', error);
      toast.error('创建失败');
    }
  };

  const handleToggle = async (id: number, currentActive: number) => {
    try {
      const res = await apiPut<{ success?: boolean; message?: string }>(
        getApiBase() + `/api/admin/api-keys/${id}/toggle`,
        { active: !currentActive }
      );
      if (res.success) {
        loadData();
        toast.success('状态已更新');
      } else {
        toast.error(res.message || '操作失败');
      }
    } catch (error) {
      console.error('切换状态失败:', error);
      toast.error('操作失败');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个 API Key 吗？此操作不可恢复。')) return;
    
    try {
      const res = await apiDelete<{ success?: boolean; message?: string }>(
        getApiBase() + `/api/admin/api-keys/${id}`
      );
      if (res.success) {
        loadData();
        toast.success('API Key 已删除');
      } else {
        toast.error(res.message || '删除失败');
      }
    } catch (error) {
      console.error('删除 API Key 失败:', error);
      toast.error('删除失败');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('已复制到剪贴板');
    }).catch(() => {
      toast.error('复制失败，请手动复制');
    });
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  if (!auth?.is_admin) return null;

  return (
    <>
      <Head>
        <title>API密钥管理 - LanFund</title>
      </Head>
      <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ marginBottom: 4 }}>API密钥管理</h1>
            <p style={{ color: 'var(--text-dim)' }}>管理第三方应用接入的 API Key</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '10px 20px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            + 新建 API Key
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
        ) : apiKeys.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>
            暂无 API Key，点击右上角按钮创建
          </div>
        ) : (
          <div style={{ background: 'var(--card-bg)', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  <th style={{ padding: 12, textAlign: 'left' }}>名称</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>权限</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>绑定用户</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>限流</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>状态</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>最后使用</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>创建时间</th>
                  <th style={{ padding: 12, textAlign: 'center' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((key) => (
                  <tr key={key.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                    <td style={{ padding: 12 }}>
                      <div>{key.name}</div>
                      {key.description && (
                        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{key.description}</div>
                      )}
                    </td>
                    <td style={{ padding: 12 }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 12,
                        background: key.permissions === 'admin' ? 'rgba(239, 68, 68, 0.2)' :
                                   key.permissions === 'write' ? 'rgba(245, 158, 11, 0.2)' :
                                   'rgba(34, 197, 94, 0.2)',
                        color: key.permissions === 'admin' ? '#ef4444' :
                               key.permissions === 'write' ? '#f59e0b' :
                               '#22c55e'
                      }}>
                        {key.permissions}
                      </span>
                    </td>
                    <td style={{ padding: 12 }}>
                      {key.bind_username || (key.bind_user_id ? `用户#${key.bind_user_id}` : '未绑定')}
                    </td>
                    <td style={{ padding: 12 }}>{key.rate_limit}/分钟</td>
                    <td style={{ padding: 12 }}>
                      <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={!!key.active}
                          onChange={() => handleToggle(key.id, key.active)}
                          style={{ cursor: 'pointer' }}
                        />
                        <span style={{ color: key.active ? '#22c55e' : '#ef4444' }}>
                          {key.active ? '启用' : '禁用'}
                        </span>
                      </label>
                    </td>
                    <td style={{ padding: 12 }}>{formatDate(key.last_used_at)}</td>
                    <td style={{ padding: 12 }}>{formatDate(key.created_at)}</td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <button
                        onClick={() => handleDelete(key.id)}
                        style={{
                          padding: '4px 12px',
                          background: 'transparent',
                          color: '#ef4444',
                          border: '1px solid #ef4444',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 12
                        }}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 创建弹窗 */}
        {showCreateModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: 'var(--card-bg)',
              borderRadius: 8,
              padding: 24,
              width: '90%',
              maxWidth: 500,
              maxHeight: '90vh',
              overflow: 'auto'
            }}>
              <h2 style={{ marginBottom: 16 }}>新建 API Key</h2>
              <form onSubmit={handleCreate}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 4 }}>名称 *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="例如：我的投资App"
                    style={{
                      width: '100%',
                      padding: 8,
                      borderRadius: 4,
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 4 }}>描述</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="用途说明（可选）"
                    style={{
                      width: '100%',
                      padding: 8,
                      borderRadius: 4,
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 4 }}>权限</label>
                  <select
                    value={formData.permissions}
                    onChange={(e) => setFormData({ ...formData, permissions: e.target.value })}
                    style={{
                      width: '100%',
                      padding: 8,
                      borderRadius: 4,
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value="read">只读 (read)</option>
                    <option value="write">读写 (write)</option>
                    <option value="admin">管理员 (admin)</option>
                  </select>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 4 }}>限流（次/分钟）</label>
                  <input
                    type="number"
                    value={formData.rateLimit}
                    onChange={(e) => setFormData({ ...formData, rateLimit: parseInt(e.target.value) || 100 })}
                    min={1}
                    max={10000}
                    style={{
                      width: '100%',
                      padding: 8,
                      borderRadius: 4,
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 4 }}>过期时间（可选）</label>
                  <input
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                    style={{
                      width: '100%',
                      padding: 8,
                      borderRadius: 4,
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', marginBottom: 4 }}>
                    绑定用户（可选）
                    <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 8 }}>
                      (共 {users.length} 个用户)
                    </span>
                  </label>
                  <select
                    value={formData.bindUserId}
                    onChange={(e) => setFormData({ ...formData, bindUserId: e.target.value })}
                    style={{
                      width: '100%',
                      padding: 8,
                      borderRadius: 4,
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value="">不绑定</option>
                    {users.length === 0 ? (
                      <option value="" disabled>暂无用户数据</option>
                    ) : (
                      users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.username} {user.is_admin ? '(管理员)' : ''}
                        </option>
                      ))
                    )}
                  </select>
                  <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
                    绑定后，该 API Key 可访问对应用户的持仓数据
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowCreateModal(false)}
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                  >
                    创建
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 显示新创建的 Key */}
        {newlyCreatedKey && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001
          }}>
            <div style={{
              background: 'var(--card-bg)',
              borderRadius: 8,
              padding: 24,
              width: '90%',
              maxWidth: 600
            }}>
              <h2 style={{ marginBottom: 16, color: '#22c55e' }}>✓ API Key 创建成功</h2>
              <p style={{ marginBottom: 16, color: 'var(--text-dim)' }}>
                请立即复制并保存此 API Key，它只会显示这一次！
              </p>
              <div style={{
                background: 'var(--bg-secondary)',
                padding: 16,
                borderRadius: 4,
                marginBottom: 16,
                wordBreak: 'break-all',
                fontFamily: 'monospace',
                fontSize: 14
              }}>
                {newlyCreatedKey}
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => copyToClipboard(newlyCreatedKey)}
                >
                  复制到剪贴板
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setNewlyCreatedKey(null)}
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
