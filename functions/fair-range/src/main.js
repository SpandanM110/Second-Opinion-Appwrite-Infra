// Day-1 skeleton for GET /fair-range?item=&lat=&lng= (F9).
// Locality resolution, scope fallback and the price_stats read land on Oct 30.
export default async ({ req, res }) => {
  const { item, lat, lng } = req.query;
  if (!item) {
    return res.json({ error: 'pass ?item=<slug>&lat=&lng=' }, 400);
  }
  return res.json({ item, lat, lng, status: 'not_implemented_yet' }, 501);
};
