// Vercel Serverless Function: Cloud Database API for Sweeper Attendance

const initialSeedRecords = {
  "2026-07-13": { status: "present", tasks: { sweeping: true, mopping: true, dusting: true, fullCleaning: true }, employeeName: "Priyanka", editCount: 1, locked: false, updatedAt: "2026-07-13T09:15:00.000Z" },
  "2026-07-14": { status: "present", tasks: { sweeping: true, mopping: true, dusting: true, fullCleaning: true }, employeeName: "Priyanka", editCount: 1, locked: false, updatedAt: "2026-07-14T09:20:00.000Z" },
  "2026-07-15": { status: "present", tasks: { sweeping: true, mopping: true, dusting: true, fullCleaning: true }, employeeName: "Ashutosh", editCount: 1, locked: false, updatedAt: "2026-07-15T09:10:00.000Z" },
  "2026-07-16": { status: "present", tasks: { sweeping: true, mopping: true, dusting: true, fullCleaning: true }, employeeName: "Priyanka", editCount: 1, locked: false, updatedAt: "2026-07-16T09:30:00.000Z" },
  "2026-07-17": { status: "present", tasks: { sweeping: true, mopping: true, dusting: true, fullCleaning: true }, employeeName: "Shreyansh", editCount: 1, locked: false, updatedAt: "2026-07-17T09:05:00.000Z" },
  "2026-07-18": { status: "absent", tasks: { sweeping: false, mopping: false, dusting: false, fullCleaning: false }, employeeName: "Priyanka", editCount: 1, locked: false, updatedAt: "2026-07-18T10:00:00.000Z" },
  "2026-07-20": { status: "present", tasks: { sweeping: true, mopping: true, dusting: true, fullCleaning: true }, employeeName: "Priyanka", editCount: 1, locked: false, updatedAt: "2026-07-20T09:12:00.000Z" },
  "2026-07-21": { status: "present", tasks: { sweeping: true, mopping: true, dusting: true, fullCleaning: true }, employeeName: "Prerna", editCount: 1, locked: false, updatedAt: "2026-07-21T09:25:00.000Z" },
  "2026-07-22": { status: "present", tasks: { sweeping: true, mopping: true, dusting: true, fullCleaning: true }, employeeName: "Priyanka", editCount: 1, locked: false, updatedAt: "2026-07-22T09:18:00.000Z" },
  "2026-07-23": { status: "present", tasks: { sweeping: true, mopping: true, dusting: true, fullCleaning: true }, employeeName: "Priyanka", editCount: 1, locked: false, updatedAt: "2026-07-23T09:08:00.000Z" },
  "2026-07-24": { status: "present", tasks: { sweeping: true, mopping: true, dusting: true, fullCleaning: true }, employeeName: "Ashutosh", editCount: 1, locked: false, updatedAt: "2026-07-24T09:15:00.000Z" },
  "2026-07-25": { status: "absent", tasks: { sweeping: false, mopping: false, dusting: false, fullCleaning: false }, employeeName: "Priyanka", editCount: 1, locked: false, updatedAt: "2026-07-25T10:15:00.000Z" },
  "2026-07-27": { status: "present", tasks: { sweeping: true, mopping: true, dusting: true, fullCleaning: true }, employeeName: "Priyanka", editCount: 1, locked: false, updatedAt: "2026-07-27T09:00:00.000Z" }
};

let memoryCacheRecords = { ...initialSeedRecords };

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
        const response = await fetch(`${KV_URL}/get/sweeper_records_seed_v2`, {
          headers: { Authorization: `Bearer ${KV_TOKEN}` }
        });
        const data = await response.json();
        const records = data.result ? (typeof data.result === 'string' ? JSON.parse(data.result) : data.result) : null;
        if (records && Object.keys(records).length > 0) {
          return res.status(200).json({ success: true, records, source: 'Vercel KV' });
        }
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
        await fetch(`${KV_URL}/set/sweeper_records_seed_v2`, {
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
        await fetch(`${KV_URL}/set/sweeper_records_seed_v2`, {
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
