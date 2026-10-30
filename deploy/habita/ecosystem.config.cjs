/** PM2 exclusivo de Habita. Los secretos se leen en el proceso hijo, fuera del repositorio. */
module.exports = {
    apps: [{
        name: "habita-api",
        cwd: "/var/www/habita-crm/current/apps/api",
        script: "dist/main.js",
        interpreter: "/home/ubuntu/.nvm/versions/node/v22.23.2/bin/node",
        node_args: ["--env-file=/var/www/habita-crm/shared/api.env", "--max-old-space-size=256", "--enable-source-maps"],
        instances: 1,
        exec_mode: "fork",
        watch: false,
        autorestart: true,
        min_uptime: "10s",
        max_restarts: 5,
        restart_delay: 5000,
        kill_timeout: 30000,
        max_memory_restart: "384M",
        env: { NODE_ENV: "production" },
    }],
};
