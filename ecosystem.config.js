module.exports = {
  apps: [
    {
      name: 'learnandearn-node',
      script: 'app.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        DB_HOST: 'localhost',
        DB_PORT: 3143,
        DB_DATABASE: 'jetzt',
        DB_USER: 'odoo',
        DB_PASSWORD: 'odoo'
      },
      error_file: './logs/node-error.log',
      out_file: './logs/node.log',
      log_file: './logs/node-combined.log',
      time: true
    },
    {
      name: 'learnandearn-spacy',
      script: 'spacy_venv/bin/python',
      args: 'spacy_api_server_youtube.py',
      interpreter: 'none',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        DB_HOST: 'localhost',
        DB_PORT: 3143,
        DB_NAME: 'jetzt',
        DB_USER: 'odoo',
        DB_PASSWORD: 'odoo'
      },
      error_file: './logs/spacy-error.log',
      out_file: './logs/spacy.log',
      log_file: './logs/spacy-combined.log',
      time: true
    }
  ]
};