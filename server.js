const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'ahmedsultan5678',
  database: 'siren_db'
});

// Connect to MySQL
db.connect(err => {
  if (err) {
    console.error('❌ MySQL connection failed:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to MySQL!');
});

// Insert new incident
app.post('/api/incidents', (req, res) => {
  const { address, latitude, longitude, injured, fire, crime, severity } = req.body;
  const sql = `INSERT INTO incidents (address, latitude, longitude, injured, fire, crime, severity)
               VALUES (?, ?, ?, ?, ?, ?, ?)`;
  db.query(sql, [address, latitude, longitude, injured, fire, crime, severity], (err, result) => {
    if (err) return res.status(500).send(err);
    res.send({ id: result.insertId });
  });
});

// Get all incidents
app.get('/api/incidents', (req, res) => {
  db.query('SELECT * FROM incidents ORDER BY timestamp DESC', (err, results) => {
    if (err) return res.status(500).send(err);
    res.send(results);
  });
});

// Get all services
app.get('/api/services', (req, res) => {
  db.query('SELECT * FROM services', (err, results) => {
    if (err) return res.status(500).send(err);
    res.send(results);
  });
});

// Get nearest services by type and count
app.post('/api/nearest-services', (req, res) => {
  const { latitude, longitude, ambulanceCount, fireBrigadeCount, policeCount } = req.body;

  const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const toRad = deg => deg * Math.PI / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  db.query('SELECT * FROM services', (err, services) => {
    if (err) return res.status(500).send(err);

    const withDistance = services.map(service => ({
      ...service,
      distance: haversineDistance(latitude, longitude, service.latitude, service.longitude)
    }));

    const getNearest = (type, count) =>
        withDistance.filter(s => s.type.toLowerCase() === type.toLowerCase())
                    .sort((a, b) => a.distance - b.distance)
                    .slice(0, count);
      
      const selected = [
        ...getNearest('ambulance', ambulanceCount),
        ...getNearest('fire', fireBrigadeCount),
        ...getNearest('police', policeCount)
      ];
      
    res.send(selected);
  });
});

// Insert dispatch logs with ETA and distance
app.post('/api/dispatch-logs', (req, res) => {
  const { incidentId, logs } = req.body;

  if (!incidentId || !Array.isArray(logs) || logs.length === 0) {
    return res.status(400).send({ message: "Invalid payload" });
  }

  const values = logs.map(log => [
    incidentId,
    log.serviceId,
    log.eta,
    log.distance
  ]);

  const sql = `
    INSERT INTO dispatch_logs (incident_id, service_id, eta_minutes, distance_km)
    VALUES ?
  `;

  db.query(sql, [values], (err, result) => {
    if (err) return res.status(500).send(err);
    res.send({ inserted: result.affectedRows });
  });
});

// Start server
app.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});
