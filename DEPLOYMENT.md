# Docker Deployment Instructions

## Quick Start

1. **Install Docker Desktop** on the target computer
   - Download from: https://www.docker.com/products/docker-desktop/

2. **Clone the repository**
   ```bash
   git clone <your-repository-url>
   cd QUEUING-SYSTEM
   ```

3. **Configure environment variables**
   ```bash
   copy .env.example .env
   ```
   Then edit `.env` and set your database password:
   ```
   DB_PASSWORD=your_secure_password_here
   ```

4. **Start the application**
   ```bash
   docker compose up -d
   ```

5. **Access the application**
   - Open browser to: `http://localhost:8081`
   - **Super Admin**: username `superadmin`, password `superadmin123` (access at `/superadmin.html`)
   - **Admin**: username `admin`, password `admin123` (access at `/admin.html`)
   - **Doctor**: username `renz`, password `renzsale` (access at `/doctor.html`)

## Important Notes

- The `.env` file is excluded from Git (contains sensitive data)
- Always use `.env.example` as a template for new deployments
- Docker will automatically create the PostgreSQL database and run migrations
- The application uses port 8081 to avoid conflicts with other web servers
- A **Super Admin** account is created automatically for user management
- User credentials are now stored in the database with secure password hashing

## Troubleshooting

If you encounter issues:
1. Make sure Docker Desktop is running
2. Check that port 8081 is not already in use (or change the port in docker-compose.yml)
3. Verify the DB_PASSWORD in `.env` matches what you set
4. View logs: `docker compose logs`
5. Restart containers: `docker compose restart`

## Stopping the Application

```bash
docker compose down
```

## LAN Access

To access from other computers on the same network:
1. Find your computer's local IP address (e.g., 192.168.1.100)
2. Access via: `http://YOUR_IP:8081`
3. Make sure port 8081 is allowed through your firewall
