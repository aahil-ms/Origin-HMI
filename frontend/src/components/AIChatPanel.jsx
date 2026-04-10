import { useState, useRef, useEffect } from 'react'
import { MessageSquare, X, Send, Sparkles, Loader, ChevronRight } from 'lucide-react'

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

const EXAMPLE_PROMPTS = [
  'Navigate to the shelf, pick a box, then deliver it',
  'Patrol waypoints 1, 2, and 3, then charge',
  'Move forward, wait 5 seconds, then return to dock',
]

export default function AIChatPanel({ onNodesGenerated }) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! Describe a robot task in plain English and I\'ll build the workflow for you. 🤖' }
  ])
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendPrompt(text) {
    const userMsg = text || prompt
    if (!userMsg.trim()) return

    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setPrompt('')
    setLoading(true)

    try {
      const res = await fetch(`${BACKEND}/api/ai/build-flow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMsg }),
      })
      const data = await res.json()

      if (data.nodes && data.edges) {
        // REPLACE the entire canvas with the AI-generated graph
        onNodesGenerated(data.nodes, data.edges, true)
        setMessages(prev => [...prev, {
          role: 'assistant',
          text: `✅ Generated ${data.nodes.length}-step workflow with ${data.edges.length} connections. Canvas replaced.`
        }])
      } else {
        throw new Error(data.error || 'Backend returned no flow data')
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', text: `❌ Error: ${e.message}` }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Toggle FAB */}
      <button
        onClick={() => setOpen(o => !o)}
        title="AI Graph Builder"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 200,
          width: 52, height: 52, borderRadius: '50%', border: 'none',
          background: 'linear-gradient(135deg, var(--accent), var(--accent2, #8b5cf6))',
          color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
      >
        {open ? <X size={22} /> : <MessageSquare size={22} />}
      </button>

      {/* Sliding Panel */}
      <div style={{
        position: 'fixed', top: 56, right: 0, bottom: 0, zIndex: 190,
        width: 360,
        background: 'var(--bg-surface, #111827)',
        borderLeft: '1px solid var(--border, #1f2937)',
        display: 'flex', flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: open ? '-8px 0 32px rgba(0,0,0,0.4)' : 'none',
      }}>
        {/* Panel Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <div style={{
            width: 32, height: 32, background: 'linear-gradient(135deg, var(--accent), #8b5cf6)',
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>AI Graph Builder</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 1 }}>
              Describe a task → get a workflow
            </div>
          </div>
        </div>

        {/* Example Prompts */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Try an example
          </div>
          {EXAMPLE_PROMPTS.map((p, i) => (
            <button key={i} onClick={() => sendPrompt(p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                background: 'var(--bg-raised, #1a2035)', border: '1px solid var(--border)',
                borderRadius: 7, padding: '6px 10px', marginBottom: 5,
                color: 'var(--text-secondary)', fontSize: '0.78rem', cursor: 'pointer',
                textAlign: 'left', transition: 'background 0.15s',
                fontFamily: 'inherit',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay, #212840)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-raised, #1a2035)'}
            >
              <ChevronRight size={11} style={{ flexShrink: 0, color: 'var(--accent)' }} />
              {p}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                maxWidth: '85%', padding: '9px 13px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-raised, #1a2035)',
                color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
                fontSize: '0.83rem', lineHeight: 1.5,
                border: m.role === 'user' ? 'none' : '1px solid var(--border)',
              }}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                padding: '9px 14px', borderRadius: '14px 14px 14px 4px',
                background: 'var(--bg-raised, #1a2035)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 10,
                color: 'var(--text-secondary)', fontSize: '0.83rem',
              }}>
                <Loader size={13} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>Generating workflow…</div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: 2 }}>Talking to Gemini AI</div>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0,
          display: 'flex', gap: 8,
        }}>
          <input
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendPrompt() } }}
            placeholder="Describe your robot task..."
            style={{
              flex: 1, background: 'var(--bg-raised)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '9px 12px', color: 'var(--text-primary)',
              fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          <button
            onClick={() => sendPrompt()}
            disabled={loading || !prompt.trim()}
            style={{
              width: 38, height: 38, borderRadius: 10, border: 'none',
              background: 'var(--accent)', color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, opacity: (loading || !prompt.trim()) ? 0.5 : 1,
              transition: 'opacity 0.15s, transform 0.15s',
            }}
            onMouseEnter={e => { if (!loading && prompt.trim()) e.currentTarget.style.transform = 'scale(1.08)' }}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <Send size={15} />
          </button>
        </div>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </>
  )
}
