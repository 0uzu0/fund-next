import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import Modal from './Modal';
import { apiGet, apiPost } from '../utils/apiClient';
import { toast } from '../utils/toast';

const markdownBlockStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--font-size-md)',
  lineHeight: 1.55,
  wordBreak: 'break-word',
};
const markdownComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  p: ({ children }) => <p style={{ ...markdownBlockStyle, marginBottom: 8 }}>{children}</p>,
  ul: ({ children }) => <ul style={{ ...markdownBlockStyle, paddingLeft: 20, marginBottom: 8 }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ ...markdownBlockStyle, paddingLeft: 20, marginBottom: 8 }}>{children}</ol>,
  li: ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
  strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
  code: ({ className, children, ...rest }) => {
    const isBlock = className?.startsWith('language-');
    return (
      <code
        style={
          isBlock
            ? { display: 'block', background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 6, overflow: 'auto', fontSize: '0.9em', marginBottom: 8 }
            : { background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: 4, fontSize: '0.92em' }
        }
        {...rest}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => <pre style={{ margin: 0 }}>{children}</pre>,
  h1: ({ children }) => <div style={{ ...markdownBlockStyle, fontWeight: 600, marginBottom: 8, fontSize: '1.1em' }}>{children}</div>,
  h2: ({ children }) => <div style={{ ...markdownBlockStyle, fontWeight: 600, marginBottom: 6, fontSize: '1.05em' }}>{children}</div>,
  h3: ({ children }) => <div style={{ ...markdownBlockStyle, fontWeight: 600, marginBottom: 4 }}>{children}</div>,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>{children}</a>,
};

export type AiMessage = { role: 'user' | 'assistant'; content: string };

export type AiAssistantProps = {
  /** 可选：发给 AI 的上下文（如持仓摘要），会作为 system 消息 */
  context?: string;
};

export default function AiAssistant({ context }: AiAssistantProps) {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<{ enabled: boolean }>('/api/ai/config')
      .then((res) => { if (!cancelled) setEnabled(!!res?.enabled); })
      .catch(() => { if (!cancelled) setEnabled(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [open, messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const userMsg: AiMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      const body = {
        messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
        context: context || undefined,
      };
      const res = await apiPost<{ success: boolean; reply?: string; message?: string }>(
        '/api/ai/chat',
        body
      );
      if (res?.success && res.reply != null) {
        setMessages((prev) => [...prev, { role: 'assistant', content: res.reply! }]);
      } else {
        toast.error(res?.message || 'AI 回复失败');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '请求失败');
    } finally {
      setLoading(false);
    }
  };

  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="AI 助手"
        aria-label="打开 AI 助手"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9998,
          width: 52,
          height: 52,
          borderRadius: '50%',
          border: '1px solid var(--border)',
          background: 'var(--card-bg)',
          color: 'var(--text-main)',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.4rem',
        }}
      >
        🤖
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="AI 助手"
        showCloseButton
        closeDisabled={loading}
        maxWidth={560}
        width="95%"
        contentStyle={{ display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}
      >
        <div
          ref={listRef}
          style={{
            flex: 1,
            minHeight: 300,
            maxHeight: 420,
            overflowY: 'auto',
            padding: '14px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {messages.length === 0 && (
            <div style={{ color: 'var(--text-dim)', fontSize: 'var(--font-size-md)', padding: 10, lineHeight: 1.5 }}>
              {context
                ? '可以问我关于持仓、基金或市场的问题，我会结合当前上下文回答。'
                : '输入问题与我对话。'}
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '90%',
                padding: '12px 16px',
                borderRadius: 10,
                background: m.role === 'user' ? 'var(--up-color)' : 'var(--bg-secondary)',
                color: m.role === 'user' ? '#fff' : 'var(--text-main)',
                wordBreak: 'break-word',
                fontSize: 'var(--font-size-md)',
                lineHeight: 1.55,
                ...(m.role === 'user' ? { whiteSpace: 'pre-wrap' } : {}),
              }}
            >
              {m.role === 'assistant' ? (
                <ReactMarkdown components={markdownComponents}>{m.content}</ReactMarkdown>
              ) : (
                m.content
              )}
            </div>
          ))}
          {loading && (
            <div
              style={{
                alignSelf: 'flex-start',
                padding: '12px 16px',
                borderRadius: 10,
                background: 'var(--bg-secondary)',
                color: 'var(--text-dim)',
                fontSize: 'var(--font-size-md)',
              }}
            >
              正在思考…
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="输入问题，Enter 发送"
            rows={2}
            disabled={loading}
            style={{
              flex: 1,
              resize: 'none',
              padding: '12px 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--card-bg)',
              color: 'var(--text-main)',
              fontSize: 'var(--font-size-md)',
            }}
          />
          <button
            type="button"
            onClick={send}
            disabled={loading || !input.trim()}
            style={{
              padding: '12px 18px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--up-color)',
              color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 'var(--font-size-md)',
              alignSelf: 'flex-end',
            }}
          >
            发送
          </button>
        </div>
      </Modal>
    </>
  );
}
