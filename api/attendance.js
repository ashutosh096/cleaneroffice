// Vercel Serverless Function: Cloud Database API for Sweeper Attendance

const initialSeedRecords = {
  "2026-07-13": { status: "present", tasks: { sweeping: true, mopping: true, dusting: true, fullCleaning: true }, employeeName: "Priyanka", editCount: 1, locked: false, updatedAt: "2026-07-13T09:15:00.000Z" },
  "2026-07-14": { status: "present", tasks: { sweeping: true, mopping: true, dusting: true, fullCleaning: true }, employeeName: "Priyanka", editCount: 1, locked: false, updatedAt: "2026-07-14T09:20:00.000Z" },
  "2026-07-15": { status: "present", tasks: { sweeping: true, mopping: true, dusting: true, fullCleaning: true }, employeeName: "Ashutosh", editCount: 1, locked: false, updatedAt: "2026-07-15T09:10:00.000Z" },
  "2026-07-16": { status: "present", tasks: { sweeping: true, mopping: true, dusting: true, fullCleaning: true }, employeeName: "Priyanka", editCount: 1, locked: false, updatedAt: "2026-07-16T09:30:00.000Z" },
  "2026-07-17": { status: "present", tasks: { sweeping: true, mopping: true, dusting: true, fullCleaning: true }, employeeName: "Shreyansh", editCount: 1, locked: false, updatedAt: "2026-07-17T09:05:00.000Z" },
  "2026-07-18": { status: "absent", tasks: { sweeping: false, mopping: false, dusting: false, fullCleaning: false }, employeeName: "Priyanka", editCount: 1, locked: false, updatedAt: "2026-07-18T10:00:00.000Z" },
  "2026-07-20": { status: "present", tasks: { sweeping: true, mopping: true, dusting: true, fullCleaning: true }, employeeName: "Shreyansh", editCount: 1, locked: false, updatedAt: "2026-07-20T09:12:00.000Z" }
};

let memoryCacheRecords = { ...initialSeedRecords };

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
        let records = data.result ? (typeof data.result === 'string' ? JSON.parse(data.result) : data.result) : null;
        
        // If KV is empty (length === 0), seed it with initial records
        if (!records || typeof records !== 'object' || Object.keys(records).length === 0) {
          records = { ...initialSeedRecords };
          await fetch(`${KV_URL}/set/sweeper_records_live_v7`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${KV_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(JSON.stringify(records))
          });
        }

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
          const existingKV = data.result ? (typeof data.result === 'string' ? JSON.parse(data.result) : data.result) : null;
          if (existingKV && typeof existingKV === 'object') {
            currentRecords = { ...existingKV };
          }
        } catch (e) {}
      }

      // Smart merge: keep existing dates and update/add incoming dates
      const mergedRecords = { ...currentRecords, ...newIncomingRecords };
      memoryCacheRecords = mergedRecords;

      if (KV_URL && KV_TOKEN) {
        await fetch(`${KV_URL}/set/sweeper_records_live_v7`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${KV_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(JSON.stringify(mergedRecords))
        });
        return res.status(200).json({ success: true, message: 'Saved & Merged to Vercel KV Database', records: mergedRecords });
      }

      return res.status(200).json({ success: true, message: 'Saved & Merged to Server Cache', records: mergedRecords });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // DELETE: Clear all records completely
  if (req.method === 'DELETE') {
    memoryCacheRecords = {};
    if (KV_URL && KV_TOKEN) {
      try {
        await fetch(`${KV_URL}/set/sweeper_records_live_v7`, {
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
