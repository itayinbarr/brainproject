/* Brain Atlas - layers tree (subsystem accordion + structure browser) */

function hl(text, q) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (<>{text.slice(0, i)}<mark style={{ background: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: 3, padding: '0 1px' }}>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>);
}

function SideChip({ side }) {
  const txt = side === 'median' ? 'M' : (side === 'left' ? 'L' : 'R');
  return (
    <span className="mono" style={{
      fontSize: 9.5, fontWeight: 700, lineHeight: 1, letterSpacing: '0.02em',
      color: 'var(--ink-faint)', background: 'rgba(16,20,32,0.06)',
      border: '1px solid var(--hair)', borderRadius: 5, padding: '2px 5px', flex: '0 0 auto',
    }}>{txt}</span>
  );
}

function StructureRow({ node, onSelect, onFocus, selected, q }) {
  const [h, setH] = React.useState(false);
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      onClick={() => onSelect(node.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px 5px 30px', borderRadius: 8, cursor: 'pointer',
        background: selected ? 'var(--accent-soft)' : (h ? 'rgba(16,20,32,0.04)' : 'transparent'),
        transition: 'background .12s',
      }}>
      <span style={{ flex: 1, fontSize: 12.5, color: selected ? 'var(--accent)' : 'var(--ink-soft)', fontWeight: selected ? 600 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {hl(node.label, q)}
      </span>
      <SideChip side={node.side} />
      {(h || selected) && (
        <button title="Focus camera" onClick={(e) => { e.stopPropagation(); onFocus(node.id); }}
          style={{ border: 'none', background: 'transparent', color: 'var(--ink-faint)', display: 'grid', placeItems: 'center', padding: 0, cursor: 'pointer' }}>
          <Icon name="target" size={13} />
        </button>
      )}
    </div>
  );
}

function CategoryBlock({ g, on, expanded, onToggle, onExpand, onSelect, onFocus, onFocusCat, selectedId, q, matchedIds }) {
  const items = React.useMemo(() => {
    const all = [];
    g.regions.forEach(r => r.items.forEach(it => all.push(Object.assign({ region: r.region }, it))));
    return all;
  }, [g]);
  const filtered = q ? items.filter(it => matchedIds.has(it.id)) : items;
  const dim = q && filtered.length === 0;
  const showItems = expanded || (q && filtered.length > 0);

  return (
    <div style={{ opacity: dim ? 0.4 : 1, transition: 'opacity .2s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 6px', borderRadius: 9 }}>
        <Check state={on} onChange={() => onToggle(g.cat)} color={g.color} />
        <button onClick={() => onExpand(g.cat)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 9, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
          <Dot color={g.color} size={11} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.label}</span>
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-ghost)' }}>{q ? filtered.length + '/' + g.count : g.count}</span>
          <Icon name="chevRight" size={14} style={{ color: 'var(--ink-ghost)', transform: showItems ? 'rotate(90deg)' : 'none', transition: 'transform .18s' }} />
        </button>
      </div>
      {showItems && (
        <div style={{ paddingBottom: 4 }}>
          {filtered.length > 60 && !q && (
            <div style={{ padding: '2px 8px 6px 30px', fontSize: 10.5, color: 'var(--ink-ghost)' }} className="mono">{filtered.length} structures - scroll</div>
          )}
          {filtered.slice(0, q ? 999 : 120).map(it => (
            <StructureRow key={it.id} node={it} onSelect={onSelect} onFocus={onFocus} selected={selectedId === it.id} q={q} />
          ))}
        </div>
      )}
    </div>
  );
}

function LayersTree(props) {
  const { groups, layerOn, expanded, q, matchedIds } = props;
  return (
    <div>
      {groups.map(g => (
        <CategoryBlock key={g.cat} g={g}
          on={layerOn[g.cat]}
          expanded={expanded.has(g.cat)}
          onToggle={props.onToggleLayer}
          onExpand={props.onExpand}
          onSelect={props.onSelect}
          onFocus={props.onFocus}
          onFocusCat={props.onFocusCat}
          selectedId={props.selectedId}
          q={q}
          matchedIds={matchedIds}
        />
      ))}
    </div>
  );
}

Object.assign(window, { LayersTree, hl });
