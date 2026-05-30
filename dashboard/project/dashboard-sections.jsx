/* LEKHA Dashboard — Section views */

/* ============== OVERVIEW ============== */
const OverviewView = ({ state, setActive }) => {
  const topicsOn = Object.values(state.topics).filter(Boolean).length;
  const toolsOn = Object.values(state.tools).filter(Boolean).length;
  const connsOn = Object.values(state.connections).filter(Boolean).length;
  return (
    <div className="row-gap">
      <div className="section-hdr">
        <div className="section-eyebrow">Workspace · Overview</div>
        <h1 className="section-title">Welcome back, <span className="gold-text">Alex.</span></h1>
        <p className="section-desc">Your assistant is ready. Make her yours — customize what she briefs you on, which tools she runs, and how she remembers you.</p>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="v"><span className="gold-text">{topicsOn}</span><span style={{opacity:0.35}}>/7</span></div>
          <div className="lbl">Topics<br/>Active</div>
          <div className="trend">+2 this week</div>
        </div>
        <div className="stat">
          <div className="v"><span className="gold-text">{toolsOn}</span><span style={{opacity:0.35}}>/5</span></div>
          <div className="lbl">Tools<br/>Enabled</div>
          <div className="trend">All connected</div>
        </div>
        <div className="stat">
          <div className="v">{state.memories.length}</div>
          <div className="lbl">Memory<br/>Entries</div>
          <div className="trend">compacts at {state.compactAt}</div>
        </div>
        <div className="stat">
          <div className="v"><span className="gold-text">2</span><span style={{opacity:0.35}}>×</span></div>
          <div className="lbl">Daily Briefs<br/>Scheduled</div>
          <div className="trend">{state.morningTime} · {state.eveningTime}</div>
        </div>
      </div>

      <div className="grid-2">
        <button className="card" style={{textAlign:'left', cursor:'pointer', fontFamily:'inherit', color:'inherit'}}
          onClick={() => setActive('briefing')}>
          <div className="card-hdr">
            <div className="card-hdr-icon"><I.news/></div>
            <div>
              <h3>Daily Brief Topics</h3>
              <p className="sub">{topicsOn} of 7 verticals — read in 90 seconds.</p>
            </div>
            <div className="card-hdr-trail"><I.caret/></div>
          </div>
          <div className="chips">
            {TOPICS.filter(t => state.topics[t.id]).map(t => (
              <span key={t.id} className="chip on" style={{cursor:'default'}}>{t.emoji} {t.name}</span>
            ))}
            {topicsOn === 0 && <span className="muted" style={{fontSize:12.5}}>No topics yet — tap to add some.</span>}
          </div>
        </button>

        <button className="card" style={{textAlign:'left', cursor:'pointer', fontFamily:'inherit', color:'inherit'}}
          onClick={() => setActive('tools')}>
          <div className="card-hdr">
            <div className="card-hdr-icon"><I.bolt/></div>
            <div>
              <h3>Productivity Tools</h3>
              <p className="sub">{toolsOn} of 5 surfaces running.</p>
            </div>
            <div className="card-hdr-trail"><I.caret/></div>
          </div>
          <div className="chips">
            {TOOLS.filter(t => state.tools[t.id]).map(t => (
              <span key={t.id} className="chip on" style={{cursor:'default'}}>{t.name}</span>
            ))}
          </div>
        </button>

        <button className="card" style={{textAlign:'left', cursor:'pointer', fontFamily:'inherit', color:'inherit'}}
          onClick={() => setActive('connections')}>
          <div className="card-hdr">
            <div className="card-hdr-icon"><I.link/></div>
            <div>
              <h3>Connections</h3>
              <p className="sub">{connsOn} of 6 services connected.</p>
            </div>
            <div className="card-hdr-trail"><I.caret/></div>
          </div>
          <div style={{display:'flex', gap:8}}>
            {CONNECTIONS.filter(c => state.connections[c.id]).slice(0,5).map(c => (
              <div key={c.id} style={{
                width: 32, height: 32, borderRadius: 8,
                background: c.brand, display: 'grid', placeItems: 'center',
                fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: 14,
                color: 'white', boxShadow: '0 0 0 2px rgba(7,17,44,1)'
              }}>{c.glyph}</div>
            ))}
          </div>
        </button>

        <button className="card" style={{textAlign:'left', cursor:'pointer', fontFamily:'inherit', color:'inherit'}}
          onClick={() => setActive('memory')}>
          <div className="card-hdr">
            <div className="card-hdr-icon"><I.brain/></div>
            <div>
              <h3>Memory &amp; Persona</h3>
              <p className="sub">{state.memories.length} memories · tone is <span className="gold-text">{state.persona.tone}</span></p>
            </div>
            <div className="card-hdr-trail"><I.caret/></div>
          </div>
          <div className="mem-list">
            {state.memories.slice(0, 2).map((m, i) => (
              <div key={i} className="mem-row" style={{pointerEvents:'none'}}>
                <span className="mem-tag">{m.tag}</span>
                <span className="mem-text">{m.text}</span>
              </div>
            ))}
          </div>
        </button>
      </div>
    </div>
  );
};

/* ============== DAILY BRIEF VIEW ============== */
const BriefingView = ({ state, set }) => {
  const topicsOn = Object.values(state.topics).filter(Boolean).length;
  return (
    <div className="row-gap">
      <div className="section-hdr">
        <div className="section-eyebrow">Customize Lekha · Daily Brief</div>
        <h1 className="section-title">Wake up to <span className="gold-text">what actually matters.</span></h1>
        <p className="section-desc">Pick the verticals Lekha scans overnight. She reads 200+ sources per topic and assembles a personal briefing in 90 seconds.</p>
      </div>

      {/* Schedule */}
      <div className="card">
        <div className="card-hdr">
          <div className="card-hdr-icon"><I.cal/></div>
          <div>
            <h3>Briefing schedule</h3>
            <p className="sub">Two daily slots — morning intel and evening wrap.</p>
          </div>
        </div>
        <div className="sched">
          <div className={`sched-slot ${state.morningOn ? 'on' : ''}`}>
            <div className="sched-slot-hdr">
              <div className="sched-slot-name"><span className="ico">☀️</span> Morning briefing</div>
              <Toggle on={state.morningOn} onChange={v => set({ morningOn: v })}/>
            </div>
            <input type="time" className="sched-time-input" value={state.morningTime}
              onChange={(e) => set({ morningTime: e.target.value })}/>
            <div className="sched-meta">{state.morningOn ? `Sent ${state.morningTime} · Asia/Bangkok` : 'Off — turn on to receive'}</div>
          </div>
          <div className={`sched-slot ${state.eveningOn ? 'on' : ''}`}>
            <div className="sched-slot-hdr">
              <div className="sched-slot-name"><span className="ico">🌙</span> Evening wrap</div>
              <Toggle on={state.eveningOn} onChange={v => set({ eveningOn: v })}/>
            </div>
            <input type="time" className="sched-time-input" value={state.eveningTime}
              onChange={(e) => set({ eveningTime: e.target.value })}/>
            <div className="sched-meta">{state.eveningOn ? `Sent ${state.eveningTime} · Asia/Bangkok` : 'Off — turn on to receive'}</div>
          </div>
        </div>

        <div style={{height: 18}}/>
        <div className="field">
          <div className="field-label">Delivery channels</div>
          <div className="field-control">
            {[
              { id: 'line',  label: '💬 LINE chat' },
              { id: 'email', label: '📧 Email' },
              { id: 'push',  label: '🔔 Push notification' },
            ].map(c => {
              const on = state.briefChannels[c.id];
              return (
                <button key={c.id} className={`ch-pill ${on ? 'on' : ''}`}
                  onClick={() => set({ briefChannels: { ...state.briefChannels, [c.id]: !on } })}>
                  <span className="dot"/>{c.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Topics */}
      <div className="card">
        <div className="card-hdr">
          <div className="card-hdr-icon"><I.news/></div>
          <div>
            <h3>Topic verticals</h3>
            <p className="sub">Pick what Lekha briefs you on. Re-mix anytime, mid-week.</p>
          </div>
          <div className="card-hdr-trail">
            <span className="kbd">{topicsOn} ON</span>
          </div>
        </div>
        <div className="topic-grid">
          {TOPICS.map(t => {
            const on = !!state.topics[t.id];
            return (
              <div key={t.id} className={`topic ${on ? 'on' : ''}`} role="button" tabIndex={0}
                onClick={() => set({ topics: { ...state.topics, [t.id]: !on } })}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); set({ topics: { ...state.topics, [t.id]: !on } }); }}}>
                <div className="topic-top">
                  <div className="topic-emoji">{t.emoji}</div>
                  <Toggle on={on} onChange={() => set({ topics: { ...state.topics, [t.id]: !on } })}/>
                </div>
                <div>
                  <div className="topic-title">{t.name}</div>
                  <div className="topic-thai">{t.thai}</div>
                </div>
                <div className="topic-desc">{t.desc}</div>
                <div className="topic-sources"><span className="pip"/> {t.sources} sources</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Format */}
      <div className="card">
        <div className="card-hdr">
          <div className="card-hdr-icon"><I.doc/></div>
          <div>
            <h3>Format &amp; language</h3>
            <p className="sub">How Lekha presents the briefing in chat.</p>
          </div>
        </div>
        <div className="row-gap" style={{gap: 14}}>
          <div className="field">
            <div className="field-label">Length</div>
            <div className="field-control">
              <Seg value={state.briefLength} options={['Headlines', 'Bullets', 'Full']}
                onChange={(v) => set({ briefLength: v })}/>
              <span className="field-help">~{state.briefLength === 'Headlines' ? '30s' : state.briefLength === 'Bullets' ? '90s' : '3 min'} read</span>
            </div>
          </div>
          <div className="field">
            <div className="field-label">Language</div>
            <div className="field-control">
              <Seg value={state.briefLang} options={['English', 'ไทย', 'EN + ไทย']}
                onChange={(v) => set({ briefLang: v })}/>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============== TOOLS VIEW ============== */
const ToolField = ({ field, settings, onSet }) => {
  if (field.kind === 'seg') {
    return (
      <div className="field">
        <div className="field-label">{field.label}</div>
        <div className="field-control"><Seg value={settings[field.id]} options={field.options} onChange={(v) => onSet(field.id, v)}/></div>
      </div>
    );
  }
  if (field.kind === 'chips') {
    return (
      <div className="field">
        <div className="field-label">{field.label}</div>
        <div className="field-control"><Chips value={settings[field.id]} options={field.options} onChange={(v) => onSet(field.id, v)}/></div>
      </div>
    );
  }
  if (field.kind === 'slider') {
    return (
      <div className="field">
        <div className="field-label">{field.label}</div>
        <div className="field-control"><Slider value={settings[field.id]} min={field.min} max={field.max} step={field.step} fmt={field.fmt} onChange={(v) => onSet(field.id, v)}/></div>
      </div>
    );
  }
  if (field.kind === 'toggle') {
    return (
      <div className="field">
        <div className="field-label">{field.label}</div>
        <div className="field-control"><Toggle on={settings[field.id]} onChange={(v) => onSet(field.id, v)}/></div>
      </div>
    );
  }
  if (field.kind === 'time-range') {
    const startKey = field.id === 'quiet' ? 'quietStart' : 'deepStart';
    const endKey   = field.id === 'quiet' ? 'quietEnd'   : 'deepEnd';
    return (
      <div className="field">
        <div className="field-label">{field.label}</div>
        <div className="field-control">
          <span className="time-input active">
            <span className="label">From</span>
            <input type="time" style={{background:'transparent', border:'none', color:'inherit', font:'inherit', outline:'none', width: 70}}
              value={settings[startKey]} onChange={(e) => onSet(startKey, e.target.value)}/>
          </span>
          <span className="muted">→</span>
          <span className="time-input active">
            <span className="label">To</span>
            <input type="time" style={{background:'transparent', border:'none', color:'inherit', font:'inherit', outline:'none', width: 70}}
              value={settings[endKey]} onChange={(e) => onSet(endKey, e.target.value)}/>
          </span>
        </div>
      </div>
    );
  }
  if (field.kind === 'days') {
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    return (
      <div className="field">
        <div className="field-label">{field.label}</div>
        <div className="field-control"><Chips multi value={settings[field.id]} options={days} onChange={(v) => onSet(field.id, v)}/></div>
      </div>
    );
  }
  return null;
};

const ToolsView = ({ state, set }) => {
  const [open, setOpen] = useState({ todo: false });
  const toolsOn = Object.values(state.tools).filter(Boolean).length;
  return (
    <div className="row-gap">
      <div className="section-hdr">
        <div className="section-eyebrow">Customize Lekha · Productivity Tools</div>
        <h1 className="section-title">Five surfaces. <span className="gold-text">One assistant.</span></h1>
        <p className="section-desc">Lekha runs as much or as little of your day as you let her. Toggle a tool and click the caret to fine-tune its behavior.</p>
      </div>

      <div className="card tight">
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div style={{fontSize:13.5, color:'var(--ink-dim)'}}>
            <span style={{color: 'var(--gold)', fontFamily:'JetBrains Mono, monospace', fontWeight:600, marginRight:8}}>{toolsOn} / 5</span>
            tools enabled · last used <span className="mono" style={{color:'var(--ink)'}}>2m ago</span>
          </div>
          <div className="seg">
            <button className="on">All</button>
            <button>Recent</button>
            <button>Disabled</button>
          </div>
        </div>
      </div>

      <div className="tool-list">
        {TOOLS.map(t => {
          const on = !!state.tools[t.id];
          const isOpen = open[t.id];
          return (
            <div key={t.id} className={`tool ${on ? 'on' : ''}`}>
              <div className="tool-head">
                <div className="tool-ico">{t.icon}</div>
                <div className="tool-body">
                  <div className="tool-name">{t.name}</div>
                  <div className="tool-sub">{t.sub}</div>
                </div>
                <Toggle on={on} onChange={(v) => set({ tools: { ...state.tools, [t.id]: v } })}/>
                <button className={`tool-expand ${isOpen ? 'open' : ''}`}
                  onClick={() => setOpen({ ...open, [t.id]: !isOpen })}
                  aria-label="Expand settings"><I.caret/></button>
              </div>
              {isOpen && (
                <div className="tool-settings">
                  {t.fields.map(f => (
                    <ToolField key={f.id} field={f}
                      settings={state.toolSettings[t.id]}
                      onSet={(k, v) => set({
                        toolSettings: { ...state.toolSettings,
                          [t.id]: { ...state.toolSettings[t.id], [k]: v }
                        }
                      })}/>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ============== CONNECTIONS VIEW ============== */
const ConnectionsView = ({ state, set }) => {
  return (
    <div className="row-gap">
      <div className="section-hdr">
        <div className="section-eyebrow">Customize Lekha · Connections</div>
        <h1 className="section-title">Plug in <span className="gold-text">your stack.</span></h1>
        <p className="section-desc">Lekha lives inside LINE and bridges to Google Workspace for calendar, mail and Drive. OAuth captures your identity once — no manual entry.</p>
      </div>

      <div className="card">
        <div className="card-hdr">
          <div className="card-hdr-icon" style={{background: 'rgba(6,199,85,0.12)', color: '#06C755', borderColor: 'rgba(6,199,85,0.3)'}}><I.chat/></div>
          <div>
            <h3>Primary channel</h3>
            <p className="sub">Where you talk to Lekha. Identity captured automatically — no manual entry.</p>
          </div>
        </div>
        <div className="conn-list">
          {CONNECTIONS.filter(c => c.id === 'line').map(c => {
            const on = state.connections[c.id];
            return (
              <div key={c.id} className={`conn ${on ? 'connected' : ''}`}>
                <div className="conn-logo" style={{background: c.brand, color: 'white', fontFamily:'Sora,sans-serif', fontWeight:800, fontSize: 18}}>{c.glyph}</div>
                <div className="conn-body">
                  <div className="conn-name">{c.name}</div>
                  <div className={`conn-meta ${on ? 'ok' : ''}`}>{on ? '● ' + c.handle : c.handle}</div>
                </div>
                <button className="btn-mini disconnect" onClick={() => set({ connections: { ...state.connections, [c.id]: !on } })}>
                  {on ? 'Disconnect' : 'Connect'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-hdr">
          <div className="card-hdr-icon"><I.drive/></div>
          <div>
            <h3>Google Workspace</h3>
            <p className="sub">Calendar, Gmail, Drive — connected in a single OAuth flow.</p>
          </div>
          <div className="card-hdr-trail">
            <span className="kbd">SECURE · OAUTH 2.0</span>
          </div>
        </div>
        <div className="conn-list">
          {CONNECTIONS.filter(c => c.id !== 'line' && c.id !== 'gpeople').map(c => {
            const on = state.connections[c.id];
            return (
              <div key={c.id} className={`conn ${on ? 'connected' : ''}`}>
                <div className="conn-logo" style={{background: c.brand, color: 'white', fontFamily:'Sora,sans-serif', fontWeight:800, fontSize: 18}}>{c.glyph}</div>
                <div className="conn-body">
                  <div className="conn-name">{c.name}</div>
                  <div className={`conn-meta ${on ? 'ok' : ''}`}>{on ? '● ' + c.handle : c.handle}</div>
                </div>
                {on ? (
                  <button className="btn-mini disconnect" onClick={() => set({ connections: { ...state.connections, [c.id]: false } })}>Disconnect</button>
                ) : (
                  <button className="btn-mini connect" onClick={() => set({ connections: { ...state.connections, [c.id]: true } })}>Connect</button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-hdr">
          <div className="card-hdr-icon"><I.link/></div>
          <div>
            <h3>Optional integrations</h3>
            <p className="sub">Extend Lekha to your other tools. We add new ones every month.</p>
          </div>
        </div>
        <div className="conn-list">
          {CONNECTIONS.filter(c => c.id === 'gpeople').map(c => {
            const on = state.connections[c.id];
            return (
              <div key={c.id} className={`conn ${on ? 'connected' : ''}`}>
                <div className="conn-logo" style={{background: c.brand, color: 'white', fontFamily:'Sora,sans-serif', fontWeight:800, fontSize: 18}}>{c.glyph}</div>
                <div className="conn-body">
                  <div className="conn-name">{c.name}</div>
                  <div className={`conn-meta ${on ? 'ok' : ''}`}>{on ? '● ' + c.handle : c.handle}</div>
                </div>
                {on ? (
                  <button className="btn-mini disconnect" onClick={() => set({ connections: { ...state.connections, [c.id]: false } })}>Disconnect</button>
                ) : (
                  <button className="btn-mini connect" onClick={() => set({ connections: { ...state.connections, [c.id]: true } })}>Connect</button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ============== MEMORY & PERSONA VIEW ============== */
const MemoryView = ({ state, set }) => {
  const [draft, setDraft] = useState('');
  const addMemory = () => {
    if (!draft.trim()) return;
    set({ memories: [...state.memories, { tag: 'Note', text: draft.trim() }] });
    setDraft('');
  };

  return (
    <div className="row-gap">
      <div className="section-hdr">
        <div className="section-eyebrow">Customize Lekha · Memory & Persona</div>
        <h1 className="section-title">How she <span className="gold-text">remembers</span> you.</h1>
        <p className="section-desc">Lekha auto-compacts conversation context every few messages and keeps a small set of long-term facts about you. Edit, add, or delete any time.</p>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-hdr">
            <div className="card-hdr-icon"><I.brain/></div>
            <div>
              <h3>Memory box</h3>
              <p className="sub">Auto-compact rolls up older messages into a summary. Lower = lighter context, higher = more recall.</p>
            </div>
          </div>
          <div className="field">
            <div className="field-label">Memory enabled</div>
            <div className="field-control"><Toggle on={state.memoryEnabled} onChange={v => set({ memoryEnabled: v })}/></div>
          </div>
          <div className="field" style={{marginTop: 12}}>
            <div className="field-label">Auto-compact at</div>
            <div className="field-control"><Slider value={state.compactAt} min={5} max={30} step={1} fmt={(v) => v + ' messages'} onChange={(v) => set({ compactAt: v })}/></div>
          </div>
          <div className="divider"/>
          <div style={{fontSize: 12.5, color: 'var(--ink-mute)', fontFamily:'JetBrains Mono, monospace', letterSpacing:'0.04em'}}>
            Last compaction: 14 min ago · 27 messages summarised into 184 tokens
          </div>
        </div>

        <div className="card">
          <div className="card-hdr">
            <div className="card-hdr-icon"><I.user/></div>
            <div>
              <h3>Persona</h3>
              <p className="sub">How Lekha sounds when she speaks to you.</p>
            </div>
          </div>
          <div className="row-gap" style={{gap: 14}}>
            <div className="field">
              <div className="field-label">Tone</div>
              <div className="field-control">
                <Seg value={state.persona.tone} options={['Warm', 'Professional', 'Playful']}
                  onChange={(v) => set({ persona: { ...state.persona, tone: v } })}/>
              </div>
            </div>
            <div className="field">
              <div className="field-label">Address you as</div>
              <div className="field-control">
                <Chips value={state.persona.addressing} options={['First name', 'Khun Alex', 'Sir / Madam', 'No address']}
                  onChange={(v) => set({ persona: { ...state.persona, addressing: v } })}/>
              </div>
            </div>
            <div className="field">
              <div className="field-label">Primary language</div>
              <div className="field-control">
                <Seg value={state.persona.primaryLang} options={['English', 'ภาษาไทย']}
                  onChange={(v) => set({ persona: { ...state.persona, primaryLang: v } })}/>
              </div>
            </div>
            <div className="field">
              <div className="field-label">Match your writing voice</div>
              <div className="field-control"><Toggle on={state.persona.voiceMatch} onChange={(v) => set({ persona: { ...state.persona, voiceMatch: v } })}/></div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-hdr">
          <div className="card-hdr-icon"><I.doc/></div>
          <div>
            <h3>What Lekha knows about you</h3>
            <p className="sub">Long-term facts pinned to your profile. She brings these up when relevant.</p>
          </div>
          <div className="card-hdr-trail">
            <span className="kbd">{state.memories.length} entries</span>
          </div>
        </div>
        <div className="mem-list">
          {state.memories.map((m, i) => (
            <div key={i} className="mem-row">
              <span className="mem-tag">{m.tag}</span>
              <span className="mem-text">{m.text}</span>
              <button className="mem-del" onClick={() => set({ memories: state.memories.filter((_, j) => j !== i) })}>
                <I.trash/>
              </button>
            </div>
          ))}
          <div className="mem-add">
            <I.plus/>
            <input value={draft} placeholder="Tell Lekha something she should remember about you…"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addMemory()}/>
            <button className="btn-mini" onClick={addMemory}>Add</button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============== PLAN VIEW ============== */
const PlanView = ({ state, set }) => (
  <div className="row-gap">
    <div className="section-hdr">
      <div className="section-eyebrow">Account · Plan &amp; Billing</div>
      <h1 className="section-title">Your <span className="gold-text">subscription.</span></h1>
      <p className="section-desc">Monthly subscription, billed in Thai Baht. Cancel anytime.</p>
    </div>

    <div className="plan-card">
      <div className="plan-eyebrow">CURRENT PLAN</div>
      <div className="plan-name">Yearly · เลขา</div>
      <div className="plan-price">฿ 5,990 / year · ฿499 effective per month · 2 months free</div>
      <div className="plan-row"><span className="k">Renews on</span> <span className="v">23 May 2027</span></div>
      <div className="plan-row"><span className="k">Payment method</span> <span className="v">•••• 4242 · expires 09/28</span></div>
      <div className="plan-row"><span className="k">Billing email</span> <span className="v">alex@saraburi.co</span></div>
      <div className="plan-row"><span className="k">Next charge</span> <span className="v gold">฿ 5,990</span></div>
      <div style={{display:'flex', gap: 10, marginTop: 22}}>
        <button className="btn-mini">Update payment</button>
        <button className="btn-mini">Switch to monthly</button>
        <button className="btn-mini disconnect">Cancel subscription</button>
      </div>
    </div>

    <div className="card">
      <div className="card-hdr">
        <div className="card-hdr-icon"><I.doc/></div>
        <div>
          <h3>Recent invoices</h3>
          <p className="sub">All receipts stored in Drive › Receipts / Lekha.</p>
        </div>
      </div>
      <div className="mem-list">
        {[
          { d: '23 May 2026', a: '฿ 5,990', s: 'Paid · Yearly plan' },
          { d: '23 May 2025', a: '฿ 5,990', s: 'Paid · Yearly plan' },
          { d: '18 Apr 2025', a: '฿ 599',   s: 'Paid · Final monthly bill before upgrade' },
        ].map((r, i) => (
          <div key={i} className="mem-row">
            <span className="mem-tag" style={{background:'rgba(16,185,129,0.14)', color:'#6ee7b7'}}>{r.d.split(' ')[2]}</span>
            <span className="mem-text"><span style={{color:'var(--ink)'}}>{r.d}</span> · {r.s}</span>
            <span style={{fontFamily:'JetBrains Mono, monospace', fontSize: 13, color: 'var(--gold)', marginRight: 8}}>{r.a}</span>
            <button className="btn-mini">Download</button>
          </div>
        ))}
      </div>
    </div>
  </div>
);

Object.assign(window, { OverviewView, BriefingView, ToolsView, ConnectionsView, MemoryView, PlanView });
