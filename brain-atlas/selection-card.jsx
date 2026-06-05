/* Brain Atlas — selection info card */

function Breadcrumb({ crumb, leaf, color }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '3px 5px', marginBottom: 12 }}>
      {crumb.map((c, i) => (
        <React.Fragment key={i}>
          <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontWeight: 500 }}>{c}</span>
          <Icon name="chevRight" size={11} style={{ color: 'var(--ink-ghost)' }} />
        </React.Fragment>
      ))}
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>{leaf}</span>
    </div>
  );
}

function SelectionCard({ node, color, catLabel, description, related, onSelect, onRelated, onFocus, onIsolate, onClose, isolated, focused, onClearIsolate, mobile }) {
  if (!node) return null;
  const sideLabel = node.side === 'median' ? 'Midline' : (node.side === 'left' ? 'Left' : 'Right');
  const cardStyle = mobile
    ? { position: 'absolute', left: 8, right: 8, bottom: 8, maxHeight: '64vh', overflowY: 'auto', padding: '16px 16px 14px', zIndex: 45 }
    : { position: 'absolute', right: 16, top: 16, width: 372, maxWidth: 'min(372px, calc(100vw - 32px))', padding: '16px 16px 14px', zIndex: 30 };
  return (
    <div className="glass glass-top-hi pop scroll" key={node.id} style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <span style={{ width: 12, height: 12, borderRadius: 99, background: color, marginTop: 6, flex: '0 0 auto', boxShadow: '0 0 0 3px ' + color + '22' }} />
        <div style={{ flex: 1 }}>
          <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 3 }}>{catLabel}</div>
          <h2 style={{ margin: 0, fontSize: 21, lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.015em', color: 'var(--ink)', textWrap: 'pretty' }}>{node.label}</h2>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', background: 'rgba(16,20,32,0.05)', padding: '3px 9px', borderRadius: 99, flex: '0 0 auto' }}>{sideLabel}</span>
        <IconBtn name="x" title="Close" onClick={onClose} dim={28} size={15} />
      </div>

      <Breadcrumb crumb={node.crumb && node.crumb.length ? node.crumb : [catLabel]} leaf={node.label} color={color} />

      <p style={{ margin: '0 0 14px', fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink-soft)', textWrap: 'pretty' }}>{description}</p>

      {related && related.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 7 }}>Related structures</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {related.map(r => (
              <button key={r.id} onClick={() => (onRelated || onSelect)(r.id)} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
                border: '1px solid var(--hair)', background: 'rgba(255,255,255,0.5)', color: 'var(--ink-soft)',
                fontFamily: 'var(--font)', fontSize: 12, fontWeight: 600,
              }}>
                <Dot color={color} size={7} />{r.label}
                {r.side !== 'median' && <span className="mono" style={{ fontSize: 9, color: 'var(--ink-ghost)' }}>{r.side === 'left' ? 'L' : 'R'}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onFocus(node.id)} style={actBtn(!focused, focused)}>
          <Icon name={focused ? 'reset' : 'target'} size={15} /> {focused ? 'Reset view' : 'Focus'}
        </button>
        <button onClick={() => isolated ? onClearIsolate() : onIsolate(node.id)} style={actBtn(false, isolated)}>
          <Icon name={isolated ? 'eye' : 'isolate'} size={15} /> {isolated ? 'Exit isolate' : 'Isolate'}
        </button>
      </div>
    </div>
  );
}

function actBtn(primary, active) {
  return {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px',
    borderRadius: 11, cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 700,
    border: '1px solid ' + (primary || active ? 'transparent' : 'var(--hair)'),
    background: primary ? 'var(--accent)' : (active ? 'var(--ink)' : 'rgba(255,255,255,0.5)'),
    color: primary || active ? '#fff' : 'var(--ink-soft)',
  };
}

Object.assign(window, { SelectionCard });
