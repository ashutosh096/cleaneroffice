// Vercel Serverless Function: Cloud Database API for Sweeper Attendance

let memoryCacheRecords = {};

export default async function handler(req, res) {
  // Enable CORS for QR Code mobile access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  // GET: Retrieve all attendance records
  if (req.method === 'GET') {
    if (KV_URL && KV_TOKEN) {
      try {
        const response = await fetch(`${KV_URL}/get/sweeper_records_clean`, {
          headers: { Authorization: `Bearer ${KV_TOKEN}` }
        });
        const data = await response.json();
        const records = data.result ? (typeof data.result === 'string' ? JSON.parse(data.result) : data.result) : {};
        return res.status(200).json({ success: true, records, source: 'Vercel KV' });
      } catch (err) {
        console.error('KV Read Error:', err);
      }
    }

    return res.status(200).json({ 
      success: true, 
      records: memoryCacheRecords, 
      source: 'Memory Cache' 
    });
  }

  // POST: Save updated attendance records
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const records = body ? body.records : {};

      memoryCacheRecords = records;

      if (KV_URL && KV_TOKEN) {
        await fetch(`${KV_URL}/set/sweeper_records_clean`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${KV_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(JSON.stringify(records))
        });
        return res.status(200).json({ success: true, message: 'Saved to Vercel KV Database', records });
      }

      return res.status(200).json({ success: true, message: 'Saved to Server Cache', records });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // DELETE: Clear all records completely
  if (req.method === 'DELETE') {
    memoryCacheRecords = {};
    if (KV_URL && KV_TOKEN) {
      try {
        await fetch(`${KV_URL}/set/sweeper_records_clean`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${KV_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(JSON.stringify({}))
        });
      } catch (err) {}
    }
    return res.status(200).json({ success: true, message: 'All records cleared successfully.' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
