/**
 * PM2 Ecosystem Config — World Monitor Backend
 *
 * Usage:
 *   npm install -g pm2
 *   pm2 start ecosystem.config.js
 *   pm2 logs world-monitor-backend
 *   pm2 monit
 *   pm2 stop world-monitor-backend
 *
 * PM2 cluster mode handles load balancing at the OS level.
 * Rate limits are stored in Redis so all instances share the same counters.
 */
module.exports = {
	apps: [
		{
			name: "world-monitor-backend",
			script: "src/cluster.js", // Use our cluster.js (pipeline-aware)
			instances: 1,             // cluster.js manages its own workers via Node cluster
			exec_mode: "fork",        // cluster.js is the manager; run as single fork
			watch: false,
			max_memory_restart: "512M",

			// Environment — development
			env: {
				NODE_ENV: "development",
				PORT: 5000,
			},

			// Environment — production (use: pm2 start ecosystem.config.js --env production)
			env_production: {
				NODE_ENV: "production",
				PORT: 5000,
			},

			// Logging
			log_date_format: "YYYY-MM-DD HH:mm:ss Z",
			error_file: "logs/pm2-error.log",
			out_file: "logs/pm2-out.log",
			merge_logs: true,

			// Auto-restart on crash with exponential backoff
			restart_delay: 3000,
			max_restarts: 10,
			min_uptime: "5s",
		},
	],
};
