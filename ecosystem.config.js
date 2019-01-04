/* eslint-disable */
// Options reference: https://pm2.io/doc/en/runtime/reference/ecosystem-file/

module.exports = {
  apps: [
    {
    name: 'bot',
    script: 'bot.js',
    args: '',
    instances: 1,
    autorestart: true,
    min_uptime: 5000,
    watch: false,
    max_memory_restart: '1G',
    env: { NODE_ENV: 'development' },
    env_production: { NODE_ENV: 'production' }
   },
    {
    name: 'eddn',
    script: 'eddn.js',
    args: '',
    instances: 1,
    autorestart: true,
    min_uptime: 5000,
    watch: false,
    max_memory_restart: '1G',
    env: { NODE_ENV: 'development' },
    env_production: { NODE_ENV: 'production' }
   }
  ],

  deploy: {
    production: {
      user: 'node',
      host: '212.83.163.1',
      ref: 'origin/master',
      repo: 'git@github.com:repo.git',
      path: '/var/www/production',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production'
    }
  }
};
