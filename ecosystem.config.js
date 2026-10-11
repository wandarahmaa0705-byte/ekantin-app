module.exports = {
  apps: [
    {
      name: "ekantin-backend",
      script: "server.js",
      env: {
        NODE_ENV: "production",
        HOST: "0.0.0.0",
        PORT: 3000,
        ALLOWED_ORIGINS: "https://your-domain.com,http://localhost:3000",
        EKANTIN_DB_PATH: "./data/ekantin.sqlite",
        EKANTIN_UPLOAD_PATH: "./uploads"
      },
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "512M"
    }
  ]
};
