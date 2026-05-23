// colored pill badge for a content source
const SOURCE_COLORS = {
  toi:            { bg: 'rgba(249,115,22,0.15)', color: '#f97316', border: 'rgba(249,115,22,0.3)' },
  economictimes:  { bg: 'rgba(249,115,22,0.15)', color: '#f97316', border: 'rgba(249,115,22,0.3)' },
  et:             { bg: 'rgba(249,115,22,0.15)', color: '#f97316', border: 'rgba(249,115,22,0.3)' },
  ndtv:           { bg: 'rgba(239,68,68,0.15)',  color: '#ef4444', border: 'rgba(239,68,68,0.3)'  },
  hindustantimes: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: 'rgba(59,130,246,0.3)' },
  ht:             { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: 'rgba(59,130,246,0.3)' },
  moneycontrol:   { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e', border: 'rgba(34,197,94,0.3)'  },
  reddit:         { bg: 'rgba(255,69,0,0.15)',   color: '#ff4500', border: 'rgba(255,69,0,0.3)'   },
  g2:             { bg: 'rgba(139,92,246,0.15)', color: '#8b5cf6', border: 'rgba(139,92,246,0.3)' },
  trustpilot:     { bg: 'rgba(0,182,122,0.15)',  color: '#00b67a', border: 'rgba(0,182,122,0.3)'  },
  twitter:        { bg: 'rgba(29,161,242,0.15)', color: '#1da1f2', border: 'rgba(29,161,242,0.3)' },
  x:              { bg: 'rgba(29,161,242,0.15)', color: '#1da1f2', border: 'rgba(29,161,242,0.3)'  },
  youtube:        { bg: 'rgba(255,0,0,0.15)',    color: '#ff0000', border: 'rgba(255,0,0,0.3)'    },
  linkedin:       { bg: 'rgba(10,102,194,0.15)', color: '#0a66c2', border: 'rgba(10,102,194,0.3)' },
};

const DEFAULT_STYLE = { bg: 'rgba(91,99,235,0.15)', color: '#5B63EB', border: 'rgba(91,99,235,0.3)' };

// derive style from source string
function resolveStyle(source = '') {
  const key = source.toLowerCase().replace(/[\s.]/g, '');
  for (const [pattern, style] of Object.entries(SOURCE_COLORS)) {
    if (key.includes(pattern)) return style;
  }
  return DEFAULT_STYLE;
}

export default function SourceBadge({ source }) {
  const { bg, color, border } = resolveStyle(source);
  return (
    <span style={{
      background: bg,
      color,
      border: `1px solid ${border}`,
      borderRadius: '999px',
      padding: '2px 10px',
      fontSize: '11px',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      display: 'inline-block',
    }}>
      {source}
    </span>
  );
}
