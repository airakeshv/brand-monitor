import { useState, useEffect, useRef } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// read JWT from localStorage and return auth header for every fetch
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('bm_token') || ''}` });
const TABS = ['Company', 'Sources', 'LLM', 'Delivery', 'Schedule'];

const LLM_MODELS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', note: 'Default · Free tier · 1500 req/day' },
  { value: 'gpt-4o-mini',      label: 'GPT-4o Mini',      note: 'OpenAI · fast + cheap' },
  { value: 'claude-sonnet-4-6',label: 'Claude Sonnet 4.6',note: 'Anthropic · ~$0.003/digest' },
  { value: 'perplexity-api',   label: 'Perplexity',       note: 'Web-grounded answers' },
  { value: 'deepseek-v4',      label: 'DeepSeek v4',      note: 'Low-cost alternative' },
  { value: 'groq-llama-70b',   label: 'Groq Llama 70B',   note: 'Ultra-fast inference' },
  { value: 'mistral-large',    label: 'Mistral Large',     note: 'EU-hosted, GDPR-friendly' },
];

const TIMEZONES = [
  'Asia/Kolkata','Asia/Dubai','Asia/Singapore','Asia/Tokyo',
  'Europe/London','Europe/Paris','America/New_York','America/Chicago',
  'America/Los_Angeles','America/Sao_Paulo','Australia/Sydney','UTC',
];

const HOURS   = [12,1,2,3,4,5,6,7,8,9,10,11];
const MINUTES = ['00','15','30','45'];

// parse "HH:MM" 24h string → { hour, minute, period }
function parse24h(t = '08:00') {
  const [h, m] = t.split(':').map(Number);
  return {
    hour:   h === 0 ? 12 : h > 12 ? h - 12 : h,
    minute: String(m).padStart(2, '0'),
    period: h >= 12 ? 'PM' : 'AM',
  };
}

// { hour, minute, period } → "HH:MM" 24h
function to24h(hour, minute, period) {
  let h = Number(hour);
  if (period === 'AM' && h === 12) h = 0;
  if (period === 'PM' && h !== 12) h += 12;
  return `${String(h).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
}

/* ── shared UI atoms ── */

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ color:'#B4B4B4', fontSize:12, fontWeight:600, display:'block',
        marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>
        {label}
      </label>
      {hint && <p style={{ color:'#6B7A99', fontSize:12, margin:'0 0 6px' }}>{hint}</p>}
      {children}
    </div>
  );
}

const inputStyle = {
  background:'#0A0E27', border:'1px solid #2A3858', borderRadius:8,
  padding:'10px 14px', color:'#FFFFFF', fontSize:14, width:'100%',
  outline:'none', fontFamily:'inherit',
};

const selectStyle = { ...inputStyle, cursor:'pointer' };

function TInput({ value, onChange, placeholder, type='text' }) {
  return (
    <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} style={inputStyle} />
  );
}

function TSelect({ value, onChange, children }) {
  return (
    <select value={value ?? ''} onChange={e => onChange(e.target.value)} style={selectStyle}>
      {children}
    </select>
  );
}

// tag editor — syncs with parent; updates parent on every keystroke
function TagInput({ value = [], onChange, placeholder }) {
  const extStr = (value || []).join(', ');
  const lastRef = useRef(extStr);
  const [text, setText] = useState(extStr);

  // sync when parent value changes externally (settings load, company reset)
  if (extStr !== lastRef.current) {
    lastRef.current = extStr;
    if (text !== extStr) setText(extStr);
  }

  const handleChange = e => {
    setText(e.target.value);
    onChange(e.target.value.split(',').map(s => s.trim()).filter(Boolean));
  };

  return (
    <textarea value={text} onChange={handleChange} placeholder={placeholder} rows={2}
      style={{ ...inputStyle, resize:'vertical' }} />
  );
}

// toggle switch
function Toggle({ checked, onChange, label }) {
  return (
    <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', marginBottom:14 }}>
      <div onClick={() => onChange(!checked)} style={{
        width:40, height:22, borderRadius:11, flexShrink:0,
        background: checked ? '#5B63EB' : '#2A3858', position:'relative', transition:'background 0.2s',
      }}>
        <div style={{
          position:'absolute', top:3, left: checked ? 21 : 3,
          width:16, height:16, borderRadius:'50%', background:'#fff', transition:'left 0.2s',
        }} />
      </div>
      <span style={{ color:'#FFFFFF', fontSize:14 }}>{label}</span>
    </label>
  );
}

/* ── Company tab ── */
function CompanyTab({ s, set }) {
  // changing company name clears all context fields for a fresh start
  const onCompany = v => set({
    ...s,
    company_name:     v,
    competitor_names: [],
    executive_names:  [],
    include_keywords: [],
    exclude_keywords: [],
    exclude_domains:  [],
  });

  return (
    <div>
      <Field label="Company Name" hint="Changing the name clears competitor and keyword fields so you can start fresh.">
        <TInput value={s.company_name} onChange={onCompany} placeholder="e.g. Tata Motors" />
      </Field>
      <Field label="Competitor Names (comma-separated)">
        <TagInput value={s.competitor_names||[]} onChange={v=>set({...s,competitor_names:v})} placeholder="Mahindra, Maruti Suzuki, Hyundai" />
      </Field>
      <Field label="Executive Names (track mentions)">
        <TagInput value={s.executive_names||[]} onChange={v=>set({...s,executive_names:v})} placeholder="Ratan Tata, N. Chandrasekaran" />
      </Field>
      <Field label="Include Keywords">
        <TagInput value={s.include_keywords||[]} onChange={v=>set({...s,include_keywords:v})} placeholder="EV, electric vehicle, launch" />
      </Field>
      <Field label="Exclude Keywords">
        <TagInput value={s.exclude_keywords||[]} onChange={v=>set({...s,exclude_keywords:v})} placeholder="cricket, IPL, politics" />
      </Field>
      <Field label="Exclude Domains">
        <TagInput value={s.exclude_domains||[]} onChange={v=>set({...s,exclude_domains:v})} placeholder="spam-site.com, irrelevant.in" />
      </Field>
    </div>
  );
}

/* ── Sources tab ── */
function SourcesTab({ s, set }) {
  const enabled = s.sources_enabled || {};
  const toggle  = key => set({ ...s, sources_enabled: { ...enabled, [key]: !enabled[key] } });

  const SOURCES = [
    { key:'india_news',  label:'Indian News (TOI, ET, NDTV, HT, Moneycontrol)' },
    { key:'global_news', label:'Global News (Reuters, Bloomberg, BBC)' },
    { key:'reddit',      label:'Reddit (r/IndiaInvestments, r/india…)' },
    { key:'reviews',     label:'Reviews (G2, Trustpilot, Google Reviews)' },
    { key:'twitter',     label:'Twitter / X (trending mentions)' },
    { key:'linkedin',    label:'LinkedIn (posts & articles via Google — official API in v1.1)' },
  ];

  return (
    <div>
      <p style={{ color:'#B4B4B4', fontSize:13, marginBottom:20 }}>Enable or disable data sources.</p>
      {SOURCES.map(({ key, label }) => (
        <Toggle key={key} checked={enabled[key] !== false} onChange={() => toggle(key)} label={label} />
      ))}
      <Field label="Crisis Sensitivity">
        <TSelect value={s.crisis_sensitivity||'medium'} onChange={v=>set({...s,crisis_sensitivity:v})}>
          <option value="low">Low — only flag genuine crises</option>
          <option value="medium">Medium — balanced (recommended)</option>
          <option value="high">High — flag any negative spike</option>
        </TSelect>
      </Field>
      <Field label="Review Alert Threshold (flag stars at or below)">
        <TSelect value={String(s.review_threshold??3)} onChange={v=>set({...s,review_threshold:Number(v)})}>
          {[1,2,3,4].map(n=><option key={n} value={n}>{n}★ and below</option>)}
        </TSelect>
      </Field>
    </div>
  );
}

/* ── LLM tab ── */
function LLMTab({ s, set }) {
  return (
    <div>
      <p style={{ color:'#B4B4B4', fontSize:13, marginBottom:20 }}>
        Gemini 2.5 Flash is free — no key needed. Other models require your own API key.
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
        {LLM_MODELS.map(m => {
          const active = (s.llm_model||'gemini-2.5-flash') === m.value;
          return (
            <div key={m.value} onClick={() => set({...s, llm_model:m.value})} style={{
              background: active ? 'rgba(91,99,235,0.15)' : '#0A0E27',
              border: `1px solid ${active ? '#5B63EB' : '#2A3858'}`,
              borderRadius:10, padding:'12px 16px', cursor:'pointer',
              display:'flex', justifyContent:'space-between', alignItems:'center',
            }}>
              <div>
                <div style={{ color:'#FFFFFF', fontWeight:600, fontSize:14 }}>{m.label}</div>
                <div style={{ color:'#6B7A99', fontSize:12, marginTop:2 }}>{m.note}</div>
              </div>
              {active && <span style={{ color:'#5B63EB', fontSize:11, fontWeight:700 }}>ACTIVE</span>}
            </div>
          );
        })}
      </div>
      <Field label="API Key (encrypted at rest)" hint="Leave blank to use the built-in Gemini free tier. Clear the field to remove a stored key.">
        <TInput type="password" value={s.llm_api_key||''} onChange={v=>set({...s,llm_api_key:v})} placeholder="Paste your API key" />
        {s.llm_api_key_set && (s.llm_api_key === '••••••••' || !s.llm_api_key) && (
          <div style={{ marginTop:5, color:'#22c55e', fontSize:12 }}>Key stored securely ✓ — paste a new key to replace it</div>
        )}
      </Field>
      <Field label="Fallback Model">
        <TSelect value={s.fallback_model||'gemini-2.5-flash'} onChange={v=>set({...s,fallback_model:v})}>
          {LLM_MODELS.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
        </TSelect>
      </Field>
      <Field label="Digest Language">
        <TSelect value={s.digest_language||'English'} onChange={v=>set({...s,digest_language:v})}>
          {['English','Hindi','Spanish','French','German','Portuguese'].map(l=>(
            <option key={l} value={l}>{l}</option>
          ))}
        </TSelect>
      </Field>
    </div>
  );
}

function SetupCard({ children }) {
  return (
    <div style={{ background:'rgba(91,99,235,0.07)', border:'1px solid #2A3858', borderRadius:8,
      padding:'12px 16px', marginTop:8, fontSize:12, color:'#B4B4B4', lineHeight:1.7 }}>
      {children}
    </div>
  );
}

/* ── Delivery tab ── */
function DeliveryTab({ s, set }) {
  const [showWA,   setShowWA]   = useState(false);
  const [showSlack, setShowSlack] = useState(false);

  const ok = ch => {
    const v = s[ch];
    return v && v !== '' && v !== 'add_later';
  };

  const Badge = ({ ch }) => ok(ch)
    ? <span style={{ color:'#22c55e', fontSize:11, fontWeight:700, marginLeft:8 }}>Configured ✓</span>
    : <span style={{ color:'#6B7A99', fontSize:11, marginLeft:8 }}>Not set</span>;

  const HelpToggle = ({ show, onToggle }) => (
    <button onClick={onToggle} style={{ background:'none', border:'none', color:'#5B63EB',
      fontSize:11, cursor:'pointer', padding:'0 0 0 8px', fontWeight:600 }}>
      {show ? 'Hide setup guide ▲' : 'How to set up ▼'}
    </button>
  );

  const noChannels = !ok('email') && !ok('whatsapp') && !ok('slack_webhook');

  return (
    <div>
      {/* Email */}
      <Field label={<>Email <Badge ch="email" /></>}
        hint="Daily digest sent via Resend.com (free tier: 100 emails/day). Add RESEND_API_KEY to your .env file.">
        <TInput type="email" value={s.email||''} onChange={v=>set({...s,email:v})} placeholder="you@example.com" />
      </Field>

      {/* WhatsApp */}
      <Field label={<>WhatsApp <Badge ch="whatsapp" /><HelpToggle show={showWA} onToggle={()=>setShowWA(p=>!p)} /></>}>
        <TInput value={s.whatsapp||''} onChange={v=>set({...s,whatsapp:v})} placeholder="+919876543210" />
        {showWA && (
          <SetupCard>
            <strong style={{ color:'#FFFFFF' }}>Twilio WhatsApp Sandbox — one-time setup:</strong>
            <ol style={{ margin:'8px 0 0 16px', padding:0 }}>
              <li>Sign up free at <strong>twilio.com</strong> → grab <em>Account SID</em> and <em>Auth Token</em> from the Console dashboard.</li>
              <li>Go to <strong>Messaging → Try it out → Send a WhatsApp message</strong> in Twilio Console.</li>
              <li>From your phone, send the sandbox join message (e.g. <code style={{color:'#5B63EB'}}>join sandy-frog</code>) to <strong>+1 415 523 8886</strong> on WhatsApp. You'll get a confirmation reply.</li>
              <li>Add these lines to your <code style={{color:'#5B63EB'}}>.env</code> file:<br/>
                <code style={{color:'#22c55e', display:'block', marginTop:4}}>
                  TWILIO_ACCOUNT_SID=ACxxxx<br/>
                  TWILIO_AUTH_TOKEN=your_token<br/>
                  TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
                </code>
              </li>
              <li>Enter your WhatsApp number above (with country code, e.g. <code style={{color:'#5B63EB'}}>+919876543210</code>) and save.</li>
            </ol>
            <p style={{ margin:'8px 0 0', color:'#6B7A99' }}>Note: Sandbox messages expire after 72 h of inactivity — re-send the join code if messages stop arriving.</p>
          </SetupCard>
        )}
      </Field>

      {/* Slack */}
      <Field label={<>Slack Webhook <Badge ch="slack_webhook" /><HelpToggle show={showSlack} onToggle={()=>setShowSlack(p=>!p)} /></>}>
        <TInput value={s.slack_webhook||''} onChange={v=>set({...s,slack_webhook:v})} placeholder="https://hooks.slack.com/services/…" />
        {showSlack && (
          <SetupCard>
            <strong style={{ color:'#FFFFFF' }}>Slack Incoming Webhook — 2-minute setup:</strong>
            <ol style={{ margin:'8px 0 0 16px', padding:0 }}>
              <li>Go to <strong>api.slack.com/apps</strong> → <em>Create New App</em> → <em>From Scratch</em>.</li>
              <li>Pick a name (e.g. <em>BrandMonitor</em>) and your workspace, then click <em>Create App</em>.</li>
              <li>In the left sidebar click <strong>Incoming Webhooks</strong> → toggle <em>Activate Incoming Webhooks</em> ON.</li>
              <li>Click <strong>Add New Webhook to Workspace</strong>, choose the channel, then <em>Allow</em>.</li>
              <li>Copy the Webhook URL that appears (starts with <code style={{color:'#5B63EB'}}>https://hooks.slack.com/services/…</code>) and paste it above.</li>
            </ol>
          </SetupCard>
        )}
      </Field>

      <Field label="Dev / Test Webhook" hint="Use webhook.site to inspect payloads during development.">
        <TInput value={s.dev_webhook||''} onChange={v=>set({...s,dev_webhook:v})} placeholder="https://webhook.site/your-id" />
      </Field>

      {noChannels && (
        <div style={{ background:'rgba(250,204,21,0.08)', border:'1px solid #facc15', borderRadius:10, padding:'12px 16px' }}>
          <strong style={{ color:'#facc15' }}>No delivery channel configured.</strong>
          <p style={{ color:'#B4B4B4', fontSize:13, margin:'4px 0 0' }}>Add an email address above to receive your daily digest.</p>
        </div>
      )}
    </div>
  );
}

/* ── Schedule tab ── */
function ScheduleTab({ s, set, onActivate, onStop, schedMsg }) {
  const { hour, minute, period } = parse24h(s.delivery_time || '08:00');
  const setTime = (h, m, p) => set({ ...s, delivery_time: to24h(h, m, p) });

  const [runState, setRunState] = useState('idle'); // idle | running | done | error
  const [runMsg,   setRunMsg]   = useState('');
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo,   setRangeTo]   = useState('');

  // stream SSE from /api/run-now, optionally with date range
  const fireRun = async (dateFrom = null, dateTo = null) => {
    const company = s.company_name?.trim();
    if (!company) { setRunMsg('Set a company name first.'); return; }
    setRunState('running'); setRunMsg('');
    try {
      const body = { company, ...(dateFrom && { date_from: dateFrom }), ...(dateTo && { date_to: dateTo }) };
      const res = await fetch(`${API}/api/run-now`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      let   buf    = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const p = JSON.parse(line.slice(5).trim());
          if (p.error) { setRunState('error'); setRunMsg(p.error); return; }
          if (p.done) {
            const ch = Object.entries(p.delivery || {}).filter(([,v]) => v?.ok).map(([k]) => k);
            setRunState('done');
            setRunMsg(ch.length ? `Sent via: ${ch.join(', ')} ✓` : 'Digest generated (no delivery channel configured).');
          }
        }
      }
    } catch (e) { setRunState('error'); setRunMsg(e.message); }
  };

  const runColor  = runState === 'done' ? '#22c55e' : runState === 'error' ? '#ef4444' : '#6B7A99';
  const rangeDays = rangeFrom && rangeTo
    ? Math.round((new Date(rangeTo) - new Date(rangeFrom)) / 86400000)
    : 0;
  const rangeOver = rangeDays > 90;
  const today    = new Date().toISOString().slice(0, 10);
  const isPaused = !!(s.pause_from && s.pause_to && today >= s.pause_from && today <= s.pause_to);

  const freq          = s.frequency || 'daily';
  const freqLabel     = { daily:'Every day', weekdays:'Mon–Fri', weekly:'Every Monday', monthly:'1st of each month' }[freq] || 'Every day';
  const lookbackLabel = { '1d':'yesterday only', '7d':'last 7 days', '30d':'last 30 days' }[s.news_lookback || '7d'] || 'last 7 days';
  const channelList   = [s.email && 'Email', s.whatsapp && 'WhatsApp', s.slack_webhook && 'Slack'].filter(Boolean).join(', ');

  return (
    <div>

      {/* active pause warning — shown when today falls within the pause window */}
      {isPaused && (
        <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid #ef4444', borderRadius:10,
          padding:'12px 16px', marginBottom:20, display:'flex', justifyContent:'space-between',
          alignItems:'center', gap:12 }}>
          <div>
            <div style={{ color:'#ef4444', fontWeight:700, fontSize:13 }}>⏸ Delivery is currently paused</div>
            <div style={{ color:'#B4B4B4', fontSize:12, marginTop:2 }}>
              No emails will be sent until {s.pause_to}. Click Resume to start sending again.
            </div>
          </div>
          <button onClick={() => set({...s, pause_from:null, pause_to:null})}
            style={{ background:'#ef4444', color:'#fff', border:'none', borderRadius:6,
              padding:'7px 14px', fontWeight:700, cursor:'pointer', fontSize:12, whiteSpace:'nowrap' }}>
            Resume Now
          </button>
        </div>
      )}

      {/* AM/PM time picker */}
      <Field label="Daily Delivery Time" hint="Digest is generated and emailed at this time every day.">
        <div style={{ display:'flex', gap:8 }}>
          <select value={hour} onChange={e => setTime(e.target.value, minute, period)} style={{ ...selectStyle, flex:1 }}>
            {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
          <select value={minute} onChange={e => setTime(hour, e.target.value, period)} style={{ ...selectStyle, flex:1 }}>
            {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={period} onChange={e => setTime(hour, minute, e.target.value)} style={{ ...selectStyle, flex:1 }}>
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>
      </Field>

      <Field label="Timezone">
        <TSelect value={s.timezone||'Asia/Kolkata'} onChange={v=>set({...s,timezone:v})}>
          {TIMEZONES.map(tz=><option key={tz} value={tz}>{tz}</option>)}
        </TSelect>
      </Field>

      <Field label="Frequency" hint="Controls when the automatic email fires and how much news it covers.">
        <TSelect value={s.frequency||'daily'} onChange={v => set({
          ...s,
          frequency: v,
          news_lookback: { daily:'1d', weekdays:'1d', weekly:'7d', monthly:'30d' }[v] || s.news_lookback,
        })}>
          <option value="daily">Daily — every day</option>
          <option value="weekdays">Weekdays — Mon to Fri</option>
          <option value="weekly">Weekly — every Monday</option>
          <option value="monthly">Monthly — 1st of each month</option>
        </TSelect>
      </Field>

      {/* News lookback — auto-set when frequency changes; can be overridden */}
      <Field label="News Lookback Period" hint="Auto-matched to frequency above. Change here to override.">
        <TSelect value={s.news_lookback||'7d'} onChange={v=>set({...s,news_lookback:v})}>
          <option value="1d">Last 24 hours — for Daily / Weekdays</option>
          <option value="7d">Last 7 days — for Weekly</option>
          <option value="30d">Last 30 days — for Monthly</option>
        </TSelect>
      </Field>

      {/* schedule preview — shows exactly what will happen */}
      <div style={{ background:'rgba(91,99,235,0.08)', border:'1px solid rgba(91,99,235,0.25)',
        borderRadius:10, padding:'14px 18px', marginBottom:4 }}>
        <div style={{ color:'#5B63EB', fontSize:11, fontWeight:700, letterSpacing:'0.06em',
          textTransform:'uppercase', marginBottom:10 }}>Schedule Preview</div>
        <div style={{ fontSize:13, lineHeight:'1.9', color:'#B4B4B4' }}>
          <div>
            <span style={{ color:'#FFFFFF', fontWeight:600 }}>Fires: </span>
            {freqLabel} at {hour}:{minute} {period} ({(s.timezone||'Asia/Kolkata').replace(/_/g,' ')})
          </div>
          <div>
            <span style={{ color:'#FFFFFF', fontWeight:600 }}>Searches: </span>
            {lookbackLabel} of news
          </div>
          <div>
            <span style={{ color:'#FFFFFF', fontWeight:600 }}>Delivers to: </span>
            {channelList
              ? channelList
              : <span style={{ color:'#ef4444' }}>no channels — configure in Delivery tab</span>}
          </div>
        </div>
      </div>

      {/* test email + custom date-range run */}
      <div style={{ marginTop:24, display:'flex', flexDirection:'column', gap:12 }}>

        {/* test delivery */}
        <div style={{ background:'#0A0E27', border:'1px solid #2A3858', borderRadius:10, padding:'16px 18px' }}>
          <div style={{ color:'#B4B4B4', fontSize:11, fontWeight:700, textTransform:'uppercase',
            letterSpacing:'0.06em', marginBottom:10 }}>Test Delivery</div>
          <button
            onClick={() => fireRun()}
            disabled={runState === 'running' || !s.company_name?.trim()}
            style={{
              background: runState === 'running' ? '#2A3858' : 'linear-gradient(135deg,#5B63EB,#E91E8C)',
              color:'#fff', border:'none', borderRadius:8, padding:'10px 20px',
              fontWeight:700, cursor: runState === 'running' ? 'not-allowed' : 'pointer', fontSize:14,
              opacity: !s.company_name?.trim() ? 0.5 : 1,
            }}
          >
            {runState === 'running' ? 'Running…' : 'Send Test Digest Now'}
          </button>
          {runMsg && <div style={{ marginTop:8, color:runColor, fontSize:13 }}>{runMsg}</div>}
          {!s.email && !s.whatsapp && !s.slack_webhook && (
            <div style={{ marginTop:6, color:'#facc15', fontSize:12 }}>
              No delivery channel set — configure Email / WhatsApp / Slack in the Delivery tab first.
            </div>
          )}
        </div>

        {/* custom date-range run */}
        <div style={{ background:'#0A0E27', border:'1px solid #2A3858', borderRadius:10, padding:'16px 18px' }}>
          <div style={{ color:'#B4B4B4', fontSize:11, fontWeight:700, textTransform:'uppercase',
            letterSpacing:'0.06em', marginBottom:6 }}>Search News for a Specific Period & Email</div>
          <p style={{ color:'#6B7A99', fontSize:12, margin:'0 0 12px' }}>
            Select a FROM and TO date — news for that period will be fetched and emailed to you immediately. <strong style={{ color:'#B4B4B4' }}>Max 90 days.</strong>
          </p>
          <div style={{ display:'flex', gap:8, alignItems:'flex-end', flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:120 }}>
              <div style={{ color:'#6B7A99', fontSize:11, marginBottom:4 }}>FROM</div>
              <input type="date" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)}
                style={{ ...inputStyle, colorScheme:'dark', borderColor: rangeOver ? '#ef4444' : '#2A3858' }} />
            </div>
            <div style={{ flex:1, minWidth:120 }}>
              <div style={{ color:'#6B7A99', fontSize:11, marginBottom:4 }}>TO</div>
              <input type="date" value={rangeTo} onChange={e => setRangeTo(e.target.value)}
                style={{ ...inputStyle, colorScheme:'dark', borderColor: rangeOver ? '#ef4444' : '#2A3858' }} />
            </div>
            <button
              onClick={() => fireRun(rangeFrom, rangeTo)}
              disabled={runState === 'running' || !rangeFrom || !rangeTo || !s.company_name?.trim() || rangeOver}
              style={{
                background: rangeOver ? '#2A3858' : '#5B63EB', color:'#fff', border:'none', borderRadius:8,
                padding:'10px 18px', fontWeight:700,
                cursor: (rangeOver || !rangeFrom || !rangeTo) ? 'not-allowed' : 'pointer',
                fontSize:14, opacity: (!rangeFrom || !rangeTo || !s.company_name?.trim() || rangeOver) ? 0.5 : 1,
                whiteSpace:'nowrap',
              }}
            >
              Run & Email
            </button>
          </div>
          {rangeOver && (
            <div style={{ marginTop:10, background:'rgba(239,68,68,0.08)', border:'1px solid #ef4444',
              borderRadius:8, padding:'8px 14px', fontSize:12, color:'#ef4444' }}>
              ✗ Range is <strong>{rangeDays} days</strong> — maximum is 90 days for reliable results.
              Please shorten your date selection.
            </div>
          )}
          {rangeDays > 0 && !rangeOver && (
            <div style={{ marginTop:8, color:'#22c55e', fontSize:12 }}>✓ {rangeDays}-day range — click Run &amp; Email</div>
          )}
        </div>
      </div>

      {/* pause delivery — collapsible to avoid confusion with search range */}
      <details style={{ background:'#0A0E27', border:'1px solid #2A3858', borderRadius:10,
        overflow:'hidden', marginTop:4 }}>
        <summary style={{ padding:'12px 18px', color:'#6B7A99', fontSize:13, fontWeight:600,
          cursor:'pointer', userSelect:'none', listStyle:'none' }}>
          ⏸ Pause Delivery (Advanced) — skip emails during holidays
        </summary>
        <div style={{ padding:'0 18px 16px' }}>
          <p style={{ color:'#6B7A99', fontSize:12, margin:'0 0 12px' }}>
            Set a date range to stop the daily schedule. <strong style={{ color:'#ef4444' }}>This is NOT the same as searching news by date above.</strong> This simply pauses automatic emails.
          </p>
          <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
            <div style={{ flex:1 }}>
              <div style={{ color:'#6B7A99', fontSize:11, marginBottom:4 }}>PAUSE FROM</div>
              <input type="date" value={s.pause_from||''} onChange={e=>set({...s,pause_from:e.target.value})}
                style={{ ...inputStyle, colorScheme:'dark' }} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ color:'#6B7A99', fontSize:11, marginBottom:4 }}>PAUSE UNTIL</div>
              <input type="date" value={s.pause_to||''} onChange={e=>set({...s,pause_to:e.target.value})}
                style={{ ...inputStyle, colorScheme:'dark' }} />
            </div>
            {(s.pause_from || s.pause_to) && (
              <button onClick={() => set({...s, pause_from:null, pause_to:null})}
                style={{ background:'#ef4444', color:'#fff', border:'none', borderRadius:8,
                  padding:'10px 14px', cursor:'pointer', fontSize:12, whiteSpace:'nowrap', fontWeight:700 }}>
                Clear Pause
              </button>
            )}
          </div>
          {(s.pause_from || s.pause_to) && (
            <div style={{ marginTop:10, color:'#facc15', fontSize:12 }}>
              ⚠ Emails paused: {s.pause_from || '?'} to {s.pause_to || '?'}
            </div>
          )}
        </div>
      </details>

      {/* action buttons */}
      <div style={{ display:'flex', gap:10, marginTop:24, flexWrap:'wrap' }}>
        <button onClick={onActivate} style={{
          background:'linear-gradient(135deg,#5B63EB,#E91E8C)', color:'#fff',
          border:'none', borderRadius:8, padding:'11px 22px', fontWeight:700, cursor:'pointer', fontSize:14,
        }}>
          Save & Activate Schedule
        </button>
        <button onClick={onStop} style={{
          background:'#2A3858', color:'#B4B4B4',
          border:'none', borderRadius:8, padding:'11px 22px', fontWeight:700, cursor:'pointer', fontSize:14,
        }}>
          Stop Schedule
        </button>
      </div>

      {schedMsg && (
        <div style={{ marginTop:12, color: schedMsg.ok ? '#22c55e' : '#ef4444', fontSize:13 }}>
          {schedMsg.ok ? '✓ ' : '✗ '}{schedMsg.message}
        </div>
      )}

      {/* summary card */}
      <div style={{ marginTop:20, background:'#0A0E27', border:'1px solid #2A3858', borderRadius:10, padding:'14px 18px' }}>
        <div style={{ color:'#6B7A99', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>
          Schedule Summary
        </div>
        {s.company_name
          ? <div style={{ color:'#FFFFFF', fontSize:14 }}>
              Digest for <strong style={{ color:'#5B63EB' }}>{s.company_name}</strong> at{' '}
              <strong>{hour}:{minute} {period}</strong> ({s.timezone||'Asia/Kolkata'})
            </div>
          : <div style={{ color:'#6B7A99', fontSize:13 }}>Set a company name in the Company tab first.</div>
        }
      </div>
    </div>
  );
}

/* ── Main Settings page ── */
export default function Settings() {
  const [tab,      setTab]      = useState(0);
  const [settings, setSettings] = useState({});
  const [loaded,   setLoaded]   = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [schedMsg, setSchedMsg] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/settings`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        // auto-detect timezone and default delivery time on first-ever setup
        if (!d.company_name) {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (tz) {
            d.timezone     = tz;
            d.delivery_time =
              tz.startsWith('America/') ? '06:30' :
              tz.startsWith('Europe/')  ? '07:00' : '08:00';
          }
        }
        setSettings(d);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const handleSave = async () => {
    setSaving(true); setSaved(false);
    try {
      const r = await fetch(`${API}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(settings),
      });
      if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } catch (_) {}
    setSaving(false);
  };

  const handleActivate = async () => {
    await handleSave();
    try {
      const r = await fetch(`${API}/api/schedule`, { method: 'POST', headers: authHeaders() });
      const j = await r.json();
      setSchedMsg({ ok: r.ok, message: j.message || j.error });
    } catch (e) { setSchedMsg({ ok:false, message: e.message }); }
  };

  const handleStop = async () => {
    try {
      const r = await fetch(`${API}/api/schedule`, { method: 'DELETE', headers: authHeaders() });
      const j = await r.json();
      setSchedMsg({ ok: r.ok, message: j.message || j.error });
    } catch (e) { setSchedMsg({ ok:false, message: e.message }); }
  };

  if (!loaded) {
    return <div style={{ maxWidth:720, margin:'40px auto', color:'#6B7A99', textAlign:'center' }}>Loading settings…</div>;
  }

  const tabs = [
    <CompanyTab  key="c" s={settings} set={setSettings} />,
    <SourcesTab  key="s" s={settings} set={setSettings} />,
    <LLMTab      key="l" s={settings} set={setSettings} />,
    <DeliveryTab key="d" s={settings} set={setSettings} />,
    <ScheduleTab key="sc" s={settings} set={setSettings}
      onActivate={handleActivate} onStop={handleStop} schedMsg={schedMsg} />,
  ];

  return (
    <div style={{ maxWidth:720, margin:'0 auto' }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ color:'#FFFFFF', fontSize:24, fontWeight:700, margin:0 }}>Settings</h1>
        <p style={{ color:'#B4B4B4', fontSize:14, marginTop:6 }}>Configure your brand monitoring preferences.</p>
      </div>

      {/* tab bar */}
      <div style={{ display:'flex', borderBottom:'1px solid #2A3858', marginBottom:28 }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            background:'none', border:'none', cursor:'pointer',
            padding:'10px 18px', fontSize:14, fontWeight:600,
            color: tab === i ? '#FFFFFF' : '#6B7A99',
            borderBottom: tab === i ? '2px solid #5B63EB' : '2px solid transparent',
            marginBottom:-1, transition:'color 0.15s',
          }}>
            {t}
          </button>
        ))}
      </div>

      {/* tab content */}
      <div style={{ background:'#111830', border:'1px solid #2A3858', borderRadius:14, padding:'24px 28px' }}>
        {tabs[tab]}
      </div>

      {/* save — hidden on Schedule tab which has its own save+activate */}
      {tab !== 4 && (
        <div style={{ marginTop:20, display:'flex', alignItems:'center', gap:14 }}>
          <button onClick={handleSave} disabled={saving} style={{
            background:'linear-gradient(135deg,#5B63EB,#E91E8C)', color:'#fff',
            border:'none', borderRadius:8, padding:'11px 28px',
            fontWeight:700, cursor: saving ? 'not-allowed' : 'pointer', fontSize:14,
          }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {saved && <span style={{ color:'#22c55e', fontSize:13 }}>Saved ✓</span>}
        </div>
      )}
    </div>
  );
}
