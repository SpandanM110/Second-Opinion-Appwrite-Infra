import { ImageResponse } from 'next/og';
import { rupees } from '../../lib/format';
import { getCard, getRefData } from '../../lib/server';

// Link-preview image for a shared card (WhatsApp, X, Slack): the answer is in the preview.
// GET /og?item=<slug>&c=<city>&l=<locality>

const CONF = { high: ['#dcfce7', '#166534', 'High'], medium: ['#fef3c7', '#92400e', 'Medium'], low: ['#f3f4f6', '#374151', 'Low'] } as const;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ref = await getRefData();
  const result = await getCard(ref, url.searchParams.get('item') ?? '', url.searchParams.get('c') ?? 'bhopal', url.searchParams.get('l'));
  const card = result?.card;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#f5f6f8', padding: 56, fontFamily: 'sans-serif', color: '#111827' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 30, fontWeight: 700 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#3730a3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 30, height: 8, borderRadius: 4, background: '#c7d2fe' }} />
          </div>
          Second Opinion
        </div>
        {card && card.status === 'ok' ? (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 36, background: '#fff', borderRadius: 28, padding: 44, border: '2px solid #e5e7eb', flex: 1 }}>
            <div style={{ display: 'flex', fontSize: 40, fontWeight: 600 }}>
              {card.item.name}, <span style={{ color: '#6b7280', fontWeight: 400, marginLeft: 10 }}>{card.item.unitLabel}</span>
            </div>
            <div style={{ display: 'flex', marginTop: 14, fontSize: 26, color: '#3730a3' }}>{card.scope.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 18 }}>
              <span style={{ fontSize: 64, fontWeight: 700 }}>₹</span>
              <span style={{ fontSize: 120, fontWeight: 800, letterSpacing: -4 }}>{rupees(card.range.median)}</span>
            </div>
            <div style={{ display: 'flex', fontSize: 34, color: '#4b5563' }}>
              most people paid <b style={{ color: '#111827', marginLeft: 12 }}>₹{rupees(card.range.p25)}–{rupees(card.range.p75)}</b>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 'auto', fontSize: 26, color: '#4b5563' }}>
              <span style={{ background: CONF[card.confidence.level][0], color: CONF[card.confidence.level][1], padding: '6px 18px', borderRadius: 999, fontWeight: 700 }}>
                {CONF[card.confidence.level][2]}
              </span>
              {card.sample.line}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', marginTop: 60, fontSize: 56, fontWeight: 700, lineHeight: 1.2 }}>Know the fair price before you pay. What locals really paid, near you.</div>
        )}
      </div>
    ),
    { width: 1200, height: 630, headers: { 'Cache-Control': 'public, max-age=600' } },
  );
}
