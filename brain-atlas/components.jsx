/* Brain Atlas - UI atoms + icons (Lucide-style geometric glyphs) */

const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  layers: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13 13 0 0 1-2.16 2.9"/><path d="M6.6 6.6A13 13 0 0 0 2 11s3.5 7 10 7a9 9 0 0 0 4.4-1.14"/><path d="m2 2 20 20"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  chevDown: '<path d="m6 9 6 6 6-6"/>',
  chevRight: '<path d="m9 6 6 6-6 6"/>',
  chevUp: '<path d="m6 15 6-6 6 6"/>',
  minus: '<path d="M5 12h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  grip: '<circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/>',
  sparkles: '<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z"/>',
  isolate: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  arrowDown: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  brain: '<path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 1 5 3 3 0 0 0 4 3 2.5 2.5 0 0 0 3 0V4.5A2.5 2.5 0 0 0 9 3Z"/><path d="M15 3a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-1 5 3 3 0 0 1-4 3 2.5 2.5 0 0 1-3 0"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z"/>',
  crosshair: '<circle cx="12" cy="12" r="9"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="m21 15-5-5L5 21"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>',
  github: '<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>',
  palette: '<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/>',
  /* --- Systems & Lessons expansion --- */
  chevLeft: '<path d="m15 6-6 6 6 6"/>',
  play: '<path d="M6 4l14 8-14 8V4Z"/>',
  pause: '<path d="M7 4h3v16H7zM14 4h3v16h-3z"/>',
  skipBack: '<path d="M19 5v14L9 12l10-7ZM6 5v14"/>',
  route: '<circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h5a4 4 0 0 0 4-4V9"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6 6-2Z"/>',
  graduation: '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c0 1 2.5 3 6 3s6-2 6-3v-5"/>',
  check: '<path d="M5 12l5 5L20 6"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  helpCircle: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 3M12 17h.01"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/>',
  rotate: '<path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5 8.6 10.5"/>',
};

function Icon({ name, size = 18, sw = 1.8, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style} dangerouslySetInnerHTML={{ __html: ICONS[name] || '' }} />
  );
}

/* round icon button (dark = sits on the cinematic dark-glass card) */
function IconBtn({ name, onClick, title, active, size = 16, dim = 30, sw = 1.8, style, dark }) {
  const [h, setH] = React.useState(false);
  const hoverBg = dark ? 'rgba(255,255,255,0.10)' : 'rgba(16,20,32,0.05)';
  return (
    <button title={title} onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        width: dim, height: dim, display: 'grid', placeItems: 'center', borderRadius: 9,
        border: '1px solid ' + (active ? 'transparent' : (dark ? 'rgba(255,255,255,0.14)' : 'var(--hair)')),
        background: active ? 'var(--accent)' : (h ? hoverBg : 'transparent'),
        color: active ? '#fff' : (dark ? 'var(--on-stage)' : 'var(--ink-soft)'), transition: 'background .14s, color .14s, border-color .14s',
        flex: '0 0 auto', ...style,
      }}>
      <Icon name={name} size={size} sw={sw} />
    </button>
  );
}

/* tiny color dot */
function Dot({ color, size = 10, ring }) {
  return <span style={{
    width: size, height: size, borderRadius: 99, background: color, display: 'inline-block',
    flex: '0 0 auto', boxShadow: ring ? '0 0 0 2px rgba(255,255,255,0.7), 0 0 0 3px ' + color : 'inset 0 0 0 1px rgba(0,0,0,0.12)',
  }} />;
}

/* segmented control */
function Segmented({ options, value, onChange, style }) {
  return (
    <div style={{ display: 'flex', gap: 2, padding: 3, background: 'rgba(16,20,32,0.05)', borderRadius: 11, ...style }}>
      {options.map(o => {
        const v = o.value != null ? o.value : o;
        const lbl = o.label != null ? o.label : o;
        const on = v === value;
        return (
          <button key={v} onClick={() => onChange(v)} style={{
            flex: 1, padding: '6px 8px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font)', fontSize: 12.5, fontWeight: 600, letterSpacing: '0.01em',
            background: on ? '#fff' : 'transparent', color: on ? 'var(--ink)' : 'var(--ink-faint)',
            boxShadow: on ? '0 1px 2px rgba(10,14,28,0.12), 0 0 0 1px rgba(10,14,28,0.04)' : 'none',
            transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>{o.icon ? <Icon name={o.icon} size={13} /> : null}{lbl}</button>
        );
      })}
    </div>
  );
}

/* slim toggle switch */
function Switch({ on, onChange, color }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on} style={{
      width: 34, height: 20, borderRadius: 99, border: 'none', padding: 2, cursor: 'pointer', flex: '0 0 auto',
      background: on ? (color || 'var(--accent)') : 'rgba(16,20,32,0.16)', transition: 'background .18s',
    }}>
      <span style={{
        display: 'block', width: 16, height: 16, borderRadius: 99, background: '#fff',
        transform: on ? 'translateX(14px)' : 'translateX(0)', transition: 'transform .18s cubic-bezier(.3,1.4,.5,1)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
      }} />
    </button>
  );
}

/* tristate checkbox (for layer headers: on / partial / off) */
function Check({ state, onChange, color }) {
  // state: true | false | 'partial'
  const on = state === true, partial = state === 'partial';
  return (
    <button onClick={() => onChange(!(on || partial))} style={{
      width: 18, height: 18, borderRadius: 6, flex: '0 0 auto', cursor: 'pointer', display: 'grid', placeItems: 'center',
      border: '1.5px solid ' + ((on || partial) ? (color || 'var(--accent)') : 'var(--hair)'),
      background: (on || partial) ? (color || 'var(--accent)') : 'transparent', transition: 'all .14s',
    }}>
      {on && <Icon name="x" size={11} sw={3} style={{ color: '#fff', transform: 'rotate(45deg) scale(0.0)', opacity: 0 }} />}
      {on && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 6"/></svg>}
      {partial && <span style={{ width: 8, height: 2.5, borderRadius: 2, background: '#fff' }} />}
    </button>
  );
}

Object.assign(window, { Icon, IconBtn, Dot, Segmented, Switch, Check, ICONS });
