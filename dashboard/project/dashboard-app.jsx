/* LEKHA Dashboard — Right-side LINE preview + main App */

/* ============== LIVE LINE PREVIEW ============== */
const SAMPLE_BRIEFS = {
  stocks:    [['SET',     'opens +0.6% · banking leads, energy lags on oil pullback'], ['NVDA', 'up 2.1% pre-market on Computex keynote leaks']],
  wellness:  [['Sleep',   'New Stanford study: 7-min morning light beats caffeine for focus'], ['You',  'Sleep score dipped 12% this week — try winding down 30 min earlier']],
  politics:  [['ASEAN',   'Summit concludes with new digital trade pact — Thailand among signatories'], ['Policy', 'BoT signals possible 25bps cut at June meeting']],
  crime:     [['Bangkok', 'Sukhumvit Rd cordoned 14:30–16:00 — plan around it'], ['Travel','Holiday warning issued for southern provinces']],
  sports:    [['Premier',  'Manchester derby preview — tactical breakdown attached'], ['F1', 'Monaco GP — Verstappen 0.04s off Leclerc in FP2']],
  business:  [['M&A',     'Saraburi cement consolidates — peer multiples up 8%'], ['Macro',  'US PCE data tonight 9pm ICT — watch dollar pairs']],
  entertain: [['Film',    'Cannes wraps — Thai short film wins jury prize'], ['Music',  'Solo album from your saved artist drops Friday']],
};

const Phone = ({ state, scene }) => {
  const activeTopics = TOPICS.filter(t => state.topics[t.id]);

  // Build a sample briefing message based on currently-active topics
  const briefRows = activeTopics.slice(0, 4).map(t => {
    const sample = SAMPLE_BRIEFS[t.id]?.[0] || ['', ''];
    return { tag: sample[0] || t.name, text: sample[1] || t.desc };
  });

  const today = 'Tuesday · May 20';
  const greeting = ({
    Warm:         'Good morning',
    Professional: 'Morning',
    Playful:      'Rise and shine',
  })[state.persona.tone] || 'Good morning';

  const address = ({
    'First name':  ', Alex',
    'Khun Alex':   ', Khun Alex',
    'Sir / Madam': ', Sir',
    'No address':  '',
  })[state.persona.addressing] || ', Alex';

  const sceneEl = scene === 'briefing' ? (
    <React.Fragment>
      <div className="bubble user">Brief me on today.</div>
      <div className="bubble bot rich">
        <h4>{today} · {activeTopics.length} verticals</h4>
        {briefRows.length === 0 && (
          <div style={{fontSize: 12, color: '#888', padding: '8px 0'}}>
            No topics enabled — turn some on in the dashboard.
          </div>
        )}
        {briefRows.map((r, i) => (
          <div key={i} className="brief-row">
            <span className="brief-pill">{r.tag}</span>
            <span className="txt">{r.text}</span>
          </div>
        ))}
      </div>
      <div className="bubble bot">{greeting + address}. Want me to expand on any of these, or shall I check what's on your calendar?</div>
    </React.Fragment>
  ) : scene === 'tasks' ? (
    <React.Fragment>
      <div className="bubble user">What's on for today?</div>
      <div className="bubble bot rich">
        <h4>3 tasks · 2 meetings</h4>
        <div className="brief-row"><span className="brief-pill">9:00</span><span className="txt">Review Q3 deck before 10am board</span></div>
        <div className="brief-row"><span className="brief-pill">10:00</span><span className="txt">Board meeting — pre-read sent</span></div>
        <div className="brief-row"><span className="brief-pill">14:00</span><span className="txt">Call Khun Anan back</span></div>
        <div className="brief-row"><span className="brief-pill">16:30</span><span className="txt">Sign term sheet — Atlas</span></div>
      </div>
      <div className="bubble bot">I'll nudge you {state.toolSettings.reminders.preempt} min before each meeting.</div>
    </React.Fragment>
  ) : (
    <React.Fragment>
      <div className="bubble user">Set me a reminder for vitamins, 8am every weekday.</div>
      <div className="bubble bot">Set. Recurring weekdays · 8:00 AM. {state.toolSettings.reminders.skipHolidays ? "I'll skip public holidays." : ''} Sound right?</div>
      <div className="bubble user">Also — draft a reply to David about Friday.</div>
      <div className="bubble bot">Drafting now in a <strong>{state.toolSettings.email.tone.toLowerCase()}</strong> tone. Want to review before I send?</div>
    </React.Fragment>
  );

  return (
    <div className="phone">
      <div className="phone-header">
        <div className="phone-back"/>
        <div className="phone-avatar">L</div>
        <div>
          <div className="phone-name">LEKHA · เลขา</div>
          <div className="phone-status">Online</div>
        </div>
        <div className="phone-icons">☎ ⋮</div>
      </div>
      <div className="phone-body">
        {sceneEl}
      </div>
      <div className="phone-input">
        <I.spark style={{color: '#06C755'}}/>
        <span>Type a message…</span>
        <div className="send-btn"><I.send/></div>
      </div>
    </div>
  );
};

const PreviewCol = ({ state }) => {
  const [scene, setScene] = useState('briefing');
  const activeTopics = Object.values(state.topics).filter(Boolean).length;
  const activeTools  = Object.values(state.tools).filter(Boolean).length;
  return (
    <aside className="preview-col">
      <div className="pv-head">
        <div className="pv-eyebrow">Live preview <span className="live">LIVE</span></div>
        <div className="pv-tabs">
          <button className={`pv-tab ${scene==='briefing'?'on':''}`} onClick={() => setScene('briefing')}>Brief</button>
          <button className={`pv-tab ${scene==='tasks'?'on':''}`} onClick={() => setScene('tasks')}>Today</button>
          <button className={`pv-tab ${scene==='inbox'?'on':''}`} onClick={() => setScene('inbox')}>Reply</button>
        </div>
      </div>

      <div className="pv-summary">
        <div className="pv-summary-row">
          <span className="k">Briefing</span>
          <span className="v">{state.morningOn ? state.morningTime : '—'} · {state.eveningOn ? state.eveningTime : '—'}</span>
        </div>
        <div className="pv-summary-row">
          <span className="k">Verticals</span>
          <span className="v gold">{activeTopics} of 7</span>
        </div>
        <div className="pv-summary-row">
          <span className="k">Tools</span>
          <span className="v">{activeTools} active</span>
        </div>
        <div className="pv-summary-row">
          <span className="k">Tone · Lang</span>
          <span className="v">{state.persona.tone} · {state.briefLang}</span>
        </div>
      </div>

      <Phone state={state} scene={scene}/>
    </aside>
  );
};

/* ============== APP ============== */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "blue",
  "panelDensity": "comfortable",
  "showLivePreview": true
}/*EDITMODE-END*/;

const VIEWS = {
  overview:    OverviewView,
  briefing:    BriefingView,
  tools:       ToolsView,
  connections: ConnectionsView,
  memory:      MemoryView,
  plan:        PlanView,
};

const App = () => {
  const [active, setActive] = useState('briefing');
  const [state, setState] = useState(loadState);
  const [tweaks, setTweak] = (typeof useTweaks === 'function') ? useTweaks(TWEAK_DEFAULTS) : [TWEAK_DEFAULTS, () => {}];

  // persist
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }, [state]);

  // apply accent tweak
  useEffect(() => {
    const root = document.documentElement;
    const accents = {
      blue:  { blue:'#3b82f6', bright:'#60a5fa', gold:'#f5b942' },
      gold:  { blue:'#d97706', bright:'#f5b942', gold:'#fcd34d' },
      sage:  { blue:'#10b981', bright:'#34d399', gold:'#fcd34d' },
      rose:  { blue:'#e11d48', bright:'#fb7185', gold:'#fcd34d' },
    };
    const a = accents[tweaks.accent] || accents.blue;
    root.style.setProperty('--blue', a.blue);
    root.style.setProperty('--blue-bright', a.bright);
    root.style.setProperty('--gold', a.gold);
    root.style.setProperty('--grad-blue', `linear-gradient(135deg, ${a.blue} 0%, ${a.bright} 100%)`);
  }, [tweaks.accent]);

  const set = (patch) => setState(prev => ({ ...prev, ...patch }));

  const counts = {
    topicsOn: Object.values(state.topics).filter(Boolean).length,
    toolsOn:  Object.values(state.tools).filter(Boolean).length,
    connsOn:  Object.values(state.connections).filter(Boolean).length,
  };

  const ViewComp = VIEWS[active] || VIEWS.briefing;

  return (
    <React.Fragment>
      <div className="aurora"/>
      <div className="grid-bg"/>
      <div className="noise"/>

      <div className="app" style={tweaks.showLivePreview === false ? { gridTemplateColumns: '264px minmax(0, 1fr)' } : null}>
        <Sidebar active={active} setActive={setActive} counts={counts}/>

        <main className="main">
          <Topbar active={active}/>
          <ViewComp state={state} set={set} setActive={setActive}/>

          <div className="savebar">
            <I.shield style={{color:'var(--ok)'}}/>
            <div>
              <div style={{color:'var(--ink)', fontWeight:600, fontSize:13.5}}>Auto-save on</div>
              <div style={{fontSize:12, color:'var(--ink-mute)', fontFamily:'JetBrains Mono, monospace'}}>
                Every change syncs to Lekha within 2 seconds · stored locally
              </div>
            </div>
            <button className="btn btn-ghost" onClick={() => {
              if (confirm('Reset all customizations to default?')) {
                setState(DEFAULT_STATE);
              }
            }}>Reset to defaults</button>
            <button className="btn btn-primary">Test in LINE →</button>
          </div>
        </main>

        {tweaks.showLivePreview !== false && <PreviewCol state={state}/>}
      </div>

      {typeof TweaksPanel !== 'undefined' && (
        <TweaksPanel title="Tweaks">
          <TweakSection label="Accent"/>
          <TweakRadio label="Accent palette"
            value={tweaks.accent}
            options={['blue', 'gold', 'sage', 'rose']}
            onChange={(v) => setTweak('accent', v)}/>

          <TweakSection label="Layout"/>
          <TweakToggle label="Show live LINE preview"
            value={tweaks.showLivePreview}
            onChange={(v) => setTweak('showLivePreview', v)}/>
          <TweakRadio label="Density"
            value={tweaks.panelDensity}
            options={['comfortable', 'compact']}
            onChange={(v) => setTweak('panelDensity', v)}/>

          <TweakSection label="Quick jump"/>
          <TweakButton label="Go to Overview"  onClick={() => setActive('overview')}/>
          <TweakButton label="Go to Daily Brief" onClick={() => setActive('briefing')}/>
          <TweakButton label="Go to Tools"     onClick={() => setActive('tools')}/>
          <TweakButton label="Go to Memory"    onClick={() => setActive('memory')}/>
        </TweaksPanel>
      )}
    </React.Fragment>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
