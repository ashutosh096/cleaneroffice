// Vercel Serverless Function: Cloud Database API for Sweeper Attendance

const initialSeedRecords = {};

let memoryCacheRecords = {};

export default async function handler(req, res) {
  // Enable CORS for QR Code mobile access across devices
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
        const response = await fetch(`${KV_URL}/get/sweeper_records_live_v7`, {
          headers: { Authorization: `Bearer ${KV_TOKEN}` }
        });
        const data = await response.json();
        let records = {};
        if (data.result) {
          records = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
          if (typeof records === 'string') {
            try { records = JSON.parse(records); } catch (e) { }
          }
        }
        if (records && typeof records === 'object') {
          memoryCacheRecords = { ...records };
        }
        
        return res.status(200).json({ success: true, records: memoryCacheRecords, source: 'Vercel KV' });
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

  // POST: Save updated attendance records (with smart concurrency merging)
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const newIncomingRecords = body ? (body.records || {}) : {};

      let currentRecords = { ...memoryCacheRecords };

      if (KV_URL && KV_TOKEN) {
        try {
          const response = await fetch(`${KV_URL}/get/sweeper_records_live_v7`, {
            headers: { Authorization: `Bearer ${KV_TOKEN}` }
          });
          const data = await response.json();
          let existingKV = null;
          if (data.result) {
            existingKV = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
            if (typeof existingKV === 'string') {
              try { existingKV = JSON.parse(existingKV); } catch (e) { }
            }
          }
          if (existingKV && typeof existingKV === 'object') {
            currentRecords = { ...existingKV };
          }
        } catch (e) {}
      }

      // Delete requested dates if specified
      if (Array.isArray(body.deleteDates) && body.deleteDates.length > 0) {
        body.deleteDates.forEach(d => {
          delete currentRecords[d];
        });
      }

      // Smart merge: keep existing dates and update/add incoming dates
      const mergedRecords = { ...currentRecords, ...newIncomingRecords };
      if (Array.isArray(body.deleteDates) && body.deleteDates.length > 0) {
        body.deleteDates.forEach(d => {
          delete mergedRecords[d];
        });
      }

      memoryCacheRecords = mergedRecords;

      if (KV_URL && KV_TOKEN) {
        await fetch(`${KV_URL}/set/sweeper_records_live_v7`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${KV_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(mergedRecords)
        });
        return res.status(200).json({ success: true, message: 'Saved & Merged to Vercel KV Database', records: mergedRecords });
      }

      return res.status(200).json({ success: true, message: 'Saved & Merged to Server Cache', records: mergedRecords });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // DELETE: Clear all records or specific dates
  if (req.method === 'DELETE') {
    let body = {};
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    } catch (e) {}

    const deleteDates = body.deleteDates || [];

    if (Array.isArray(deleteDates) && deleteDates.length > 0) {
      deleteDates.forEach(d => {
        delete memoryCacheRecords[d];
      });

      if (KV_URL && KV_TOKEN) {
        try {
          const response = await fetch(`${KV_URL}/get/sweeper_records_live_v7`, {
            headers: { Authorization: `Bearer ${KV_TOKEN}` }
          });
          const data = await response.json();
          let existingKV = null;
          if (data.result) {
            existingKV = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
            if (typeof existingKV === 'string') {
              try { existingKV = JSON.parse(existingKV); } catch (e) { }
            }
          }
          if (existingKV && typeof existingKV === 'object') {
            deleteDates.forEach(d => { delete existingKV[d]; });
            await fetch(`${KV_URL}/set/sweeper_records_live_v7`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(existingKV)
            });
          }
        } catch (err) {}
      }
      return res.status(200).json({ success: true, message: `Cleared dates: ${deleteDates.join(', ')}`, records: memoryCacheRecords });
    } else {
      memoryCacheRecords = {};
      if (KV_URL && KV_TOKEN) {
        try {
          await fetch(`${KV_URL}/set/sweeper_records_live_v7`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${KV_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
          });
        } catch (err) {}
      }
      return res.status(200).json({ success: true, message: 'All records cleared successfully.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
