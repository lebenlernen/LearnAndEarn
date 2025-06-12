const { Pool } = require('pg');

// Use the same configuration as app.js
const pool = new Pool({
    user: process.env.DB_USER || 'odoo',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_DATABASE || 'jetzt',
    password: process.env.DB_PASSWORD || 'odoo',
    port: process.env.DB_PORT || 3143,
});

module.exports = pool;