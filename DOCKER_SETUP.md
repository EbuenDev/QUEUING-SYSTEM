# Docker Setup Guide for RHU II Patient Queuing System

## 🚨 CRITICAL SECURITY WARNING

**Your repository contains committed credentials that need immediate attention:**

1. **Change your PostgreSQL password immediately** - Your database password was exposed in `.env.example`
2. **Remove credentials from Git history** - The password is in your repository history
3. **Rotate application credentials** - Change admin/doctor passwords after deployment

## Overview

This guide explains how to containerize the RHU II Patient Queuing System using Docker for easy deployment and reproducibility.

## Requirements

- **Docker Desktop** (for Windows) or Docker Engine (for Linux)
- **Git** (for cloning the repository)
- **Windows Firewall access** (for LAN deployment)

## Architecture

```
Docker Compose
   |
   |-- PHP/Apache application container (port 8080)
   |-- PostgreSQL database container (port 5432 internal)
   |-- PostgreSQL persistent volume (data storage)
```

## Important: DB_HOST Configuration

**Inside Docker**: Use `DB_HOST=postgres` (Docker Compose service name)
**Outside Docker (Laragon)**: Use `DB_HOST=localhost`

This is because Docker containers communicate using service names, not `localhost`.

## First-Time Setup

### 1. Install Docker Desktop

1. Download Docker Desktop for Windows from https://www.docker.com/products/docker-desktop
2. Install and start Docker Desktop
3. Verify installation: `docker --version`

### 2. Clone the Repository

```bash
git clone <your-repository-url>
cd QUEUING-SYSTEM
```

### 3. Configure Environment Variables

The `.env.example` file has been updated with safe placeholder values. Copy it to create your local configuration:

```bash
copy .env.example .env
```

Edit `.env` with your actual credentials:

```env
# For Docker use
DB_HOST=postgres
DB_PORT=5432
DB_NAME=rhu_queue_system
DB_USER=postgres
DB_PASSWORD=your_secure_password_here

# For LAN access
ALLOWED_ORIGINS=*
```

**IMPORTANT**: 
- Choose a strong, unique password for production
- Never commit `.env` to Git (it's in `.gitignore`)
- The `DB_HOST=postgres` is required for Docker container communication

### 4. Start the System

```bash
docker compose up -d --build
```

This will:
- Build the PHP/Apache container
- Pull and start PostgreSQL container
- Initialize the database with schema.sql
- Start the web application on port 8080

### 5. Access the Application

- **Local access**: http://localhost:8080
- **LAN access**: http://YOUR_SERVER_IP:8080

## Normal Operations

### Start the System

```bash
docker compose up -d
```

### Stop the System

```bash
docker compose stop
```

### View Logs

```bash
docker compose logs
docker compose logs -f  # Follow logs in real-time
docker compose logs web     # View web container logs
docker compose logs postgres # View database logs
```

### Rebuild After Changes

```bash
docker compose up -d --build
```

### Check Running Containers

```bash
docker compose ps
```

### Restart Containers

```bash
docker compose restart
```

## Database Management

### How Persistence Works

- PostgreSQL data is stored in a Docker named volume called `postgres_data`
- Database survives container restarts, stops, and normal recreation
- Schema is initialized automatically on first run using `schema.sql` and `migration_add_followup.sql`

### ⚠️ IMPORTANT: Database Deletion Warning

**DO NOT run this command unless you want to DELETE all data:**

```bash
docker compose down -v
```

The `-v` flag removes volumes, which **deletes your PostgreSQL database permanently**.

### Safe Commands

- `docker compose down` - Stops containers but preserves data
- `docker compose stop` - Stops containers (safer than down)
- `docker compose restart` - Restarts containers (data preserved)

### Database Backup

To backup your PostgreSQL database from Docker:

```bash
docker exec rhu-queue-postgres pg_dump -U postgres rhu_queue_system > backup_$(date +%Y%m%d_%H%M%S).sql
```

To restore a backup:

```bash
docker exec -i rhu-queue-postgres psql -U postgres rhu_queue_system < backup_20240823_150000.sql
```

### Database Access (Optional)

If you need direct database access (not recommended for production):

1. Add this to `docker-compose.yml` under postgres service:
   ```yaml
   ports:
     - "5432:5432"
   ```
2. Restart: `docker compose up -d`
3. Connect with: `localhost:5432`

**WARNING**: This exposes PostgreSQL to your local network. Use only for development.

## LAN Deployment

### 1. Find Your Server IP

On Windows:
```bash
ipconfig
```

Look for "IPv4 Address" (e.g., 192.168.1.100)

### 2. Configure Windows Firewall

You may need to allow Docker Desktop through Windows Firewall:

1. Open Windows Defender Firewall
2. Allow Docker Desktop through both Private and Public networks
3. Allow port 8080 through the firewall

### 3. Access from Another Computer

From another computer on the same LAN:

```
http://SERVER_IP:8080
```

Example: `http://192.168.1.100:8080`

### 4. Troubleshooting LAN Access

- **Can't access from other computer?**
  - Check Windows Firewall settings
  - Verify Docker Desktop network settings
  - Ensure both computers are on the same network
  - Try pinging the server IP from the client computer

- **Port already in use?**
  - Laragon might be using port 80. Docker uses port 8080 to avoid conflicts.
  - If port 8080 is used, change the port mapping in `docker-compose.yml`

## Laragon Compatibility

### Port Conflicts

- **Laragon**: Uses port 80 (HTTP), 443 (HTTPS), 5432 (PostgreSQL)
- **Docker**: Uses port 8080 (HTTP), internal 5432 (PostgreSQL)

The configurations are designed to avoid conflicts:
- Docker web service uses port 8080 (host) → 80 (container)
- Docker PostgreSQL uses no port mapping (internal only)

### Running Both Systems

You can run both Laragon and Docker simultaneously:
- Laragon: http://localhost
- Docker: http://localhost:8080

However, only one PostgreSQL instance should run at a time to avoid conflicts.

### Switching Between Laragon and Docker

**To use Laragon:**
1. Stop Docker: `docker compose stop`
2. Change `.env`: `DB_HOST=localhost`
3. Start Laragon normally

**To use Docker:**
1. Stop Laragon
2. Change `.env`: `DB_HOST=postgres`
3. Start Docker: `docker compose up -d`

## Troubleshooting

### Container Won't Start

```bash
docker compose logs
```

Check for:
- Port conflicts
- Environment variable issues
- Permission problems

### PostgreSQL Connection Refused

- Ensure PostgreSQL container is running: `docker compose ps`
- Check logs: `docker compose logs postgres`
- Verify `DB_HOST=postgres` in `.env`
- Wait for PostgreSQL health check (may take 10-30 seconds)

### PHP Cannot Connect to Database

- Verify environment variables are set correctly
- Check Docker network: `docker network ls`
- Ensure containers are on same network
- Test database connection from inside container:
  ```bash
  docker exec rhu-queue-web php -r "try { new PDO('pgsql:host=postgres;dbname=rhu_queue_system', 'postgres', 'your_password'); echo 'Connected'; } catch (Exception $e) { echo 'Failed: ' . $e->getMessage(); }"
  ```

### Database Initialization Problems

- If database schema doesn't load:
  1. Stop containers: `docker compose down`
  2. Remove volume: `docker volume rm rhu-queue-system_postgres_data`
  3. Start again: `docker compose up -d --build`
  **⚠️ This deletes all data**

### Permission Problems

- Windows: Ensure Docker Desktop has proper file system access
- Check file permissions in Docker Desktop settings

### Application Not Loading

- Check if web container is running: `docker compose ps`
- Verify port 8080 is accessible
- Check Apache logs: `docker compose logs web`
- Ensure all files were copied correctly during build

## Application Testing

After Docker setup, verify:

1. ✅ Application loads at http://localhost:8080
2. ✅ Patient display works
3. ✅ Admin login works (admin/admin123)
4. ✅ Doctor login works (renz/renzsale)
5. ✅ Patient registration works
6. ✅ Queue functionality works
7. ✅ API endpoints respond correctly
8. ✅ Database data persists after restart

## Security Considerations

### Credentials Management

- **Application credentials** (admin/doctor) are in `backend/config.php`
- **Database credentials** are in `.env` (never commit this)
- **Docker credentials** are managed by Docker Desktop

### Network Security

- PostgreSQL is NOT exposed publicly (internal Docker network only)
- Web application is accessible on LAN via port 8080
- Consider using a reverse proxy (nginx) for production

### Data Protection

- Database is in Docker volume (back up regularly)
- No patient data is in the repository
- Environment variables contain sensitive information

## Git Repository Structure

### Files Created for Docker

- `Dockerfile` - Container image definition
- `docker-compose.yml` - Service orchestration
- `.dockerignore` - Files to exclude from Docker build
- Updated `.env.example` - Safe template for environment variables
- Updated `.gitignore` - Additional exclusions for Docker

### Files Modified

- `.env` - Changed `DB_HOST` to `postgres` for Docker
- `.env.example` - Added CORS configuration and safe placeholder password
- `backend/schema.sql` - Removed manual database creation commands (Docker handles this)

### Files in .gitignore

The following are now excluded from Git:
- `.env` and `.env.*` (environment variables)
- `postgres_data/` and `data/` (database directories)
- Docker files (Dockerfile, docker-compose.yml, .dockerignore)
- Backup files (*.bak, *.backup, *.tmp)
- IDE files (.vscode/, .idea/)

## Migration from Laragon to Docker

### 1. Backup Existing Data

If you have existing patient data in Laragon's PostgreSQL:

```bash
# From Laragon's PostgreSQL
pg_dump -U postgres rhu_queue_system > laragon_backup.sql
```

### 2. Move to Docker

1. Stop Laragon
2. Update `.env` for Docker: `DB_HOST=postgres`
3. Start Docker: `docker compose up -d --build`
4. Restore data:
   ```bash
   docker exec -i rhu-queue-postgres psql -U postgres rhu_queue_system < laragon_backup.sql
   ```

### 3. Switch DNS/LAN Configuration

Update your LAN DNS or network configuration to point to the new Docker server IP and port 8080.

## Production Deployment

For production deployment:

1. **Change all default passwords** (database, admin, doctor)
2. **Use strong passwords** in `.env`
3. **Configure specific ALLOWED_ORIGINS** instead of `*`
4. **Set up regular database backups**
5. **Consider SSL/HTTPS** (use reverse proxy like nginx)
6. **Monitor container health**
7. **Set up log rotation**
8. **Implement proper firewall rules**

## Support

For issues specific to:
- **Docker**: Check Docker Desktop logs and documentation
- **Application**: Check application logs: `docker compose logs web`
- **Database**: Check database logs: `docker compose logs postgres`

## Summary

The Docker setup provides:
- ✅ Reproducible deployment across computers
- ✅ Isolated database environment
- ✅ Persistent data storage
- ✅ Easy backup/restore procedures
- ✅ Compatibility with existing Laragon setup
- ✅ LAN access capability
- ✅ No changes to application logic

The application runs exactly the same in Docker as it does in Laragon, just with improved portability and reproducibility.