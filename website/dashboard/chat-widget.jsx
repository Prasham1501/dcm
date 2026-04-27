// AI Chat widget — Medi assistant with claude.complete + tool calling.
// Floats bottom-right. Tools: check_balance, recharge_print, recharge_ai, create_ticket, list_devices.

const TOOLS = [
  { name: 'check_balance', desc: 'Check print or AI wallet balance', params: ['type:print|ai'] },
  { name: 'recharge_print', desc: 'Open print recharge modal', params: [] },
  { name: 'recharge_ai', desc: 'Open AI recharge modal', params: [] },
  { name: 'create_ticket', desc: 'Open new support ticket form', params: [] },
  { name: 'list_devices', desc: 'List registered devices and their status', params: [] },
];

const SYSTEM_PROMPT = `You are Medi, a helpful AI assistant for Mediview Pro — medical imaging software for Indian clinics. Be concise, warm, and practical. Reply in plain text (no markdown headings).

Available tools (respond with exactly one tool call OR a normal answer, never both):
- TOOL:check_balance:print — checks print wallet
- TOOL:check_balance:ai — checks AI wallet
- TOOL:recharge_print — opens print recharge modal
- TOOL:recharge_ai — opens AI recharge modal
- TOOL:create_ticket — opens support ticket form
- TOOL:list_devices — lists devices

Use tools when the user wants to DO something. For questions about the product, just answer.

When you call a tool, respond with ONLY the tool line, e.g. "TOOL:recharge_print". The system will execute it and surface a follow-up to the user.`;

const ChatWidget = () => {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState([
    { role: 'assistant', content: "Hi! I'm Medi 🩺 — your assistant. I can check balances, top up wallets, raise tickets, or just answer questions. What's up?" },
  ]);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const scrollRef = React.useRef(null);
  const inputRef = React.useRef(null);

  // Listen for external open events
  React.useEffect(() => {
    const onOpen = () => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 100); };
    window.addEventListener('mv:open-chat', onOpen);
    return () => window.removeEventListener('mv:open-chat', onOpen);
  }, []);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  const handleTool = (toolLine) => {
    const [, name, arg] = toolLine.split(':').map(s => s?.trim());
    switch (name) {
      case 'check_balance':
        if (arg === 'print') return `You have ${mockData?.printBalance?.toLocaleString('en-IN') || '2,847'} print credits — about ${Math.round((mockData?.printBalance || 2847) / 280)} days at your current pace. Want to top up?`;
        if (arg === 'ai') return `${mockData?.aiBalance?.toLocaleString('en-IN') || '1,250'} AI credits remaining. Credits never expire.`;
        return 'Which wallet — print or AI?';
      case 'recharge_print':
        setTimeout(() => { window.location.hash = '#/dashboard/wallet'; window.dispatchEvent(new CustomEvent('mv:open-recharge', { detail: 'print' })); }, 400);
        return 'Opening the print top-up form for you now…';
      case 'recharge_ai':
        setTimeout(() => { window.location.hash = '#/dashboard/ai'; window.dispatchEvent(new CustomEvent('mv:open-recharge', { detail: 'ai' })); }, 400);
        return 'Opening AI credit top-up…';
      case 'create_ticket':
        setTimeout(() => { window.location.hash = '#/dashboard/tickets'; window.dispatchEvent(new CustomEvent('mv:new-ticket')); }, 400);
        return "Got it. I'm opening the ticket form — fill in what's wrong and our team will get back within 4 hours.";
      case 'list_devices':
        const devs = mockData?.devices || [];
        return `You have ${devs.length} registered devices: ${devs.map(d => `${d.name} (${d.status})`).join(', ')}.`;
      default:
        return null;
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setBusy(true);

    try {
      let reply = "I'm here. What can I help with?";
      if (window.claude?.complete) {
        const apiMessages = [
          ...next.map(m => ({ role: m.role, content: m.content })),
        ];
        try {
          reply = await window.claude.complete({
            system: SYSTEM_PROMPT,
            messages: apiMessages,
          });
        } catch (e) {
          // Fall back to canned responses
          reply = fallbackReply(text);
        }
      } else {
        reply = fallbackReply(text);
      }

      // Tool detection
      const trimmed = (reply || '').trim();
      if (trimmed.startsWith('TOOL:')) {
        const toolResult = handleTool(trimmed);
        setMessages(m => [...m, { role: 'assistant', content: toolResult || "Done." }]);
      } else {
        setMessages(m => [...m, { role: 'assistant', content: trimmed || "Sorry, I missed that. Could you say it differently?" }]);
      }
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: "I'm having trouble right now. Try again in a moment, or use the support page." }]);
    } finally {
      setBusy(false);
    }
  };

  const fallbackReply = (q) => {
    const t = q.toLowerCase();
    if (t.includes('balance') && t.includes('ai')) return 'TOOL:check_balance:ai';
    if (t.includes('balance') || t.includes('credit') || t.includes('how many')) return 'TOOL:check_balance:print';
    if ((t.includes('top up') || t.includes('recharge') || t.includes('buy')) && t.includes('ai')) return 'TOOL:recharge_ai';
    if (t.includes('top up') || t.includes('recharge') || t.includes('buy')) return 'TOOL:recharge_print';
    if (t.includes('ticket') || t.includes('support') || t.includes('help')) return 'TOOL:create_ticket';
    if (t.includes('device') || t.includes('workstation')) return 'TOOL:list_devices';
    if (t.includes('hello') || t.includes('hi') || t.includes('hey')) return 'Hello! Ask me about your wallet, devices, or any product question.';
    return "I can check balances, recharge wallets, or open a support ticket. What would you like to do?";
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const quickActions = [
    { label: 'Check print balance', q: 'How many print credits do I have?' },
    { label: 'Top up prints',       q: 'I want to recharge my print wallet' },
    { label: 'Top up AI',           q: 'Buy AI credits' },
    { label: 'Raise a ticket',      q: 'I need to file a support ticket' },
  ];

  return (
    <>
      {/* Toggle button */}
      {!open && (
        <button
          onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 100); }}
          className="fixed bottom-6 right-6 z-[90] h-14 w-14 rounded-full bg-rose hover:bg-rose-dark text-white shadow-2xl shadow-rose/30 grid place-items-center transition hover:scale-105 group"
          title="Chat with Medi"
        >
          <I.MessageCircle size={22}/>
          <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-amber-400 border-2 border-white"/>
          <span className="absolute right-full mr-3 px-3 py-1.5 rounded-lg bg-ink text-paper text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition">Chat with Medi</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-[95] w-[calc(100vw-3rem)] sm:w-[400px] h-[600px] max-h-[calc(100vh-3rem)] rounded-2xl bg-white dark:bg-mid2 border border-[var(--line)] shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-rose to-rose-dark text-white flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-white/20 grid place-items-center text-lg">🩺</div>
            <div className="flex-1">
              <div className="font-display font-bold">Medi</div>
              <div className="text-[10px] flex items-center gap-1.5 opacity-90"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"/> Online · powered by Claude</div>
            </div>
            <button onClick={() => setOpen(false)} className="h-8 w-8 rounded-lg hover:bg-white/15 grid place-items-center" title="Close">
              <I.X size={16}/>
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-paper2 dark:bg-mid2/80">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm ${
                  m.role === 'user'
                    ? 'bg-rose text-white rounded-br-md'
                    : 'bg-white dark:bg-white/[0.06] border border-[var(--line)] rounded-bl-md'
                }`}>{m.content}</div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-white dark:bg-white/[0.06] border border-[var(--line)]">
                  <span className="inline-flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose animate-bounce" style={{ animationDelay: '0ms' }}/>
                    <span className="h-1.5 w-1.5 rounded-full bg-rose animate-bounce" style={{ animationDelay: '150ms' }}/>
                    <span className="h-1.5 w-1.5 rounded-full bg-rose animate-bounce" style={{ animationDelay: '300ms' }}/>
                  </span>
                </div>
              </div>
            )}

            {messages.length === 1 && (
              <div className="pt-2">
                <div className="text-[10px] uppercase tracking-wider font-bold text-[var(--muted)] mb-2 px-1">Try</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {quickActions.map(qa => (
                    <button key={qa.label} onClick={() => { setInput(qa.q); setTimeout(send, 50); }} className="text-left px-3 py-2 rounded-lg bg-white dark:bg-white/[0.04] border border-[var(--line)] hover:border-rose hover:text-rose text-xs font-semibold transition">
                      {qa.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-[var(--line)] bg-white dark:bg-mid2">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="Ask anything…"
                rows={1}
                className="flex-1 px-3 py-2 rounded-xl border border-[var(--line)] bg-paper2 dark:bg-white/[0.04] text-sm resize-none max-h-32 focus:outline-none focus:ring-2 focus:ring-rose/40 focus:border-rose"
              />
              <button onClick={send} disabled={!input.trim() || busy} className="h-10 w-10 shrink-0 rounded-xl bg-rose hover:bg-rose-dark text-white grid place-items-center disabled:opacity-40 disabled:cursor-not-allowed">
                <I.Send size={15}/>
              </button>
            </div>
            <div className="mt-1.5 text-[10px] text-[var(--muted)] text-center">Medi can make mistakes — always verify important actions.</div>
          </div>
        </div>
      )}
    </>
  );
};

window.ChatWidget = ChatWidget;
