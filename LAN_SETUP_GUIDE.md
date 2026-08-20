# LAN Access Setup Guide

This guide explains how to configure the RHU II Patient Queuing System to work over a local area network (LAN/Wi-Fi), allowing multiple computers to connect to the same PostgreSQL database.

## Architecture Overview

```
Admin PC ─────┐
Reception PC ─┼──► PHP Backend (api_postgres.php) ───► PostgreSQL Database
Doctor PC ────┘         (Host Computer)                   (Host Computer)
```

- **Host Computer**: Runs PHP web server (Laragon) and PostgreSQL database
- **Client Computers**: Access the application via web browser using the host's LAN IP address
- **PostgreSQL**: Remains centralized on the host computer (not exposed directly to clients)
- **Security**: Clients communicate only with the PHP backend, not directly with PostgreSQL

## Prerequisites

- Host computer with Laragon (or other PHP web server) installed
- PostgreSQL installed and configured on the host computer
- All computers connected to the same local network (LAN/Wi-Fi)
- Administrative access to the host computer

## Step 1: Configure PostgreSQL for LAN Access

By default, PostgreSQL only accepts connections from localhost. You need to configure it to accept connections from other computers on your LAN.

### 1.1 Find PostgreSQL Configuration Files

On Windows, PostgreSQL configuration files are typically located at:
```
C:\Program Files\PostgreSQL\[version]\data\
```

Look for these files:
- `postgresql.conf` - Main PostgreSQL configuration
- `pg_hba.conf` - Client authentication configuration

### 1.2 Modify postgresql.conf

1. Open `postgresql.conf` in a text editor (run as administrator)
2. Find the `listen_addresses` line (usually commented out):
   ```ini
   #listen_addresses = 'localhost'
   ```
3. Change it to listen on all network interfaces:
   ```ini
   listen_addresses = '*'
   ```
4. Save the file

### 1.3 Modify pg_hba.conf

1. Open `pg_hba.conf` in a text editor (run as administrator)
2. Add the following lines at the end of the file to allow LAN connections:
   ```ini
   # Allow LAN connections (replace 192.168.1.0/24 with your network range)
   host    all             all             192.168.1.0/24          md5
   host    all             all             127.0.0.1/32            md5
   ```
3. To find your network range:
   - Open Command Prompt on the host computer
   - Run: `ipconfig`
   - Look for "IPv4 Address" (e.g., `192.168.1.100`)
   - Your network range is typically the first three numbers plus `.0/24` (e.g., `192.168.1.0/24`)

4. Save the file

### 1.4 Restart PostgreSQL Service

1. Open Services Manager (`services.msc`)
2. Find `postgresql-x64-[version]` service
3. Right-click and select "Restart"
4. Or restart via Command Prompt (run as administrator):
   ```cmd
   net stop postgresql-x64-[version]
   net start postgresql-x64-[version]
   ```

## Step 2: Configure PHP/Laragon for LAN Access

### 2.1 Find Host Computer's LAN IP Address

1. Open Command Prompt on the host computer
2. Run: `ipconfig`
3. Look for "IPv4 Address" under your active network adapter
4. Note the IP address (e.g., `192.168.1.100`)

### 2.2 Configure Laragon to Listen on All Interfaces

**Option A: Using Laragon GUI (Recommended)**

1. Open Laragon
2. Go to `Menu > Apache > httpd.conf`
3. Find the `Listen` directive (usually around line 60):
   ```apache
   Listen 80
   ```
4. Change it to listen on all interfaces:
   ```apache
   Listen 0.0.0.0:80
   ```
5. Find `ServerName` directive (usually around line 220):
   ```apache
   ServerName localhost
   ```
6. Change it to:
   ```apache
   ServerName 0.0.0.0
   ```
7. Save the file
8. Restart Apache: `Menu > Apache > Restart`

**Option B: Manual Configuration**

If you can't find the settings in Laragon GUI:

1. Locate Laragon's Apache configuration file:
   ```
   C:\laragon\bin\apache\[version]\conf\httpd.conf
   ```
2. Follow the same steps as Option A above
3. Restart Apache

### 2.3 Alternative: Use PHP Built-in Server

If Laragon configuration is problematic, you can use PHP's built-in server:

1. Open Command Prompt in the project directory
2. Run:
   ```cmd
   php -S 0.0.0.0:8080
   ```
3. Access via: `http://[HOST_IP]:8080`

## Step 3: Configure Application Environment

### 3.1 Update .env File

The `.env` file has already been updated with CORS configuration. Ensure it contains:

```env
# PostgreSQL Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rhu_queue_system
DB_USER=postgres
DB_PASSWORD=your_postgres_password_here

# CORS Configuration for LAN Access
ALLOWED_ORIGINS=*
```

**Important**: 
- `DB_HOST` should remain `localhost` since PostgreSQL is on the same host computer
- Update `DB_PASSWORD` with your actual PostgreSQL password
- `ALLOWED_ORIGINS=*` allows all origins for LAN access (you can restrict to specific IPs later)

### 3.2 Verify CORS Configuration

The `backend/api_postgres.php` file has been updated with CORS headers. The changes include:

- CORS headers that allow cross-origin requests from LAN clients
- Preflight OPTIONS request handling
- Configurable allowed origins via environment variable

## Step 4: Configure Windows Firewall

You need to allow incoming connections to the PHP web server through Windows Firewall.

### 4.1 Allow Apache/PHP Through Firewall

**Option A: Windows Firewall GUI**

1. Open Windows Defender Firewall
2. Click "Allow an app or feature through Windows Defender Firewall"
3. Click "Change settings" (requires admin rights)
4. Find "Apache HTTP Server" or "World Wide Web Services"
5. Check both "Private" and "Public" network boxes
6. If not listed, click "Allow another app" and add:
   - `C:\laragon\bin\apache\[version]\bin\httpd.exe`

**Option B: Command Line (Run as Administrator)**

```cmd
netsh advfirewall firewall add rule name="Apache HTTP Server" dir=in action=allow program="C:\laragon\bin\apache\[version]\bin\httpd.exe" enable=yes
```

### 4.2 Allow PostgreSQL Through Firewall (If Needed)

If client computers need direct PostgreSQL access (not recommended, but sometimes needed):

```cmd
netsh advfirewall firewall add rule name="PostgreSQL Server" dir=in action=allow protocol=TCP localport=5432
```

**Note**: For security, it's better to keep PostgreSQL behind the PHP backend as configured in this setup.

## Step 5: Test LAN Access

### 5.1 Test from Host Computer

1. Open browser on host computer
2. Access: `http://localhost/QUEUING-SYSTEM/`
3. Verify the application works normally

### 5.2 Test from Client Computer

1. Find the host computer's LAN IP address (e.g., `192.168.1.100`)
2. On a different computer on the same network, open browser
3. Access: `http://192.168.1.100/QUEUING-SYSTEM/`
4. If using PHP built-in server: `http://192.168.1.100:8080/`
5. Verify the application loads and functions correctly

### 5.3 Troubleshooting Connection Issues

**If client can't connect:**

1. **Check network connectivity**:
   ```cmd
   ping [HOST_IP]
   ```

2. **Check if Apache is listening**:
   ```cmd
   netstat -an | findstr :80
   ```
   Should show `0.0.0.0:80` or `0.0.0.0:8080`

3. **Check Windows Firewall**:
   - Temporarily disable firewall to test
   - If it works with firewall disabled, add proper firewall rules

4. **Check Laragon/Apache logs**:
   - `C:\laragon\logs\apache.error.log`
   - `C:\laragon\logs\access.log`

5. **Test with specific port**:
   ```cmd
   telnet [HOST_IP] 80
   ```

## Step 6: Client Computer Setup

### 6.1 Access Points for Different Roles

Once configured, different computers can access different interfaces:

- **Admin Computer**: `http://[HOST_IP]/QUEUING-SYSTEM/admin.html`
- **Reception Computer**: `http://[HOST_IP]/QUEUING-SYSTEM/index.html` (or admin.html for registration)
- **Doctor Computer**: `http://[HOST_IP]/QUEUING-SYSTEM/doctor.html`
- **BHW Computer**: `http://[HOST_IP]/QUEUING-SYSTEM/bhw.html`
- **Patient Display**: `http://[HOST_IP]/QUEUING-SYSTEM/index.html`

### 6.2 Bookmark the URLs

For convenience, each computer should bookmark its respective URL for quick access.

## Security Considerations

### Current Security Level

The current configuration uses `ALLOWED_ORIGINS=*` which allows any origin. This is acceptable for a trusted local network but not for public internet access.

### Recommended Security Enhancements

For better security, restrict CORS to specific IP addresses:

1. Edit `.env` file:
   ```env
   ALLOWED_ORIGINS=http://192.168.1.100,http://192.168.1.101,http://192.168.1.102
   ```
   Replace with the actual IP addresses of your client computers.

2. If you have a DNS server on your network, you can use hostnames instead:
   ```env
   ALLOWED_ORIGINS=http://admin-pc.rhu.local,http://reception-pc.rhu.local
   ```

### Database Security

- Keep PostgreSQL listening on `*` but restrict access via `pg_hba.conf`
- Use strong PostgreSQL passwords
- Consider creating a dedicated database user with limited permissions
- Regular database backups

### Network Security

- Ensure your LAN is secure (WPA2/WPA3 Wi-Fi)
- Consider a separate VLAN for healthcare systems
- Regular security updates for all computers

## Maintenance

### Finding IP Address Changes

If the host computer's IP address changes (common with DHCP):

1. Update any hardcoded bookmarks on client computers
2. Consider setting a static IP for the host computer:
   - Windows: Network Adapter Settings > Properties > IPv4 > Use static IP
   - Or configure DHCP reservation on your router

### Monitoring

- Monitor Apache error logs for connection issues
- Monitor PostgreSQL logs for database issues
- Regular backups of PostgreSQL database

## Summary of Changes Made

### Code Changes

1. **backend/api_postgres.php**: Added CORS headers and preflight request handling
2. **.env**: Added CORS configuration with ALLOWED_ORIGINS setting
3. **HTML forms**: Added `method="post" action=""` to all forms to prevent credential exposure in URLs (admin.html, doctor.html, bhw.html)

### Configuration Changes Required

1. **PostgreSQL**: Configure `postgresql.conf` and `pg_hba.conf` for LAN access
2. **Laragon/Apache**: Configure to listen on `0.0.0.0` instead of `localhost`
3. **Windows Firewall**: Allow Apache/PHP through firewall
4. **Network**: Ensure all computers are on the same LAN

### No Changes Required

- ✅ All HTML files (index.html, admin.html, doctor.html, bhw.html)
- ✅ Frontend JavaScript (app.js) - already uses relative paths
- ✅ Database schema (schema.sql)
- ✅ All business logic in api_postgres.php
- ✅ Authentication logic
- ✅ Queue management logic
- ✅ Patient registration logic

## Troubleshooting Guide

### Issue: "Connection Refused"

**Cause**: Apache not listening on network interface
**Solution**: Configure Apache to listen on `0.0.0.0` instead of `localhost`

### Issue: "CORS Error"

**Cause**: Browser blocking cross-origin request
**Solution**: 
- Verify `ALLOWED_ORIGINS=*` in `.env`
- Check CORS headers in `api_postgres.php`
- Try accessing with HTTP instead of HTTPS (or vice versa)

### Issue: "Database Connection Failed"

**Cause**: PostgreSQL not accepting LAN connections
**Solution**:
- Verify `listen_addresses='*'` in `postgresql.conf`
- Check `pg_hba.conf` allows LAN network range
- Restart PostgreSQL service

### Issue: "403 Forbidden" or "404 Not Found"

**Cause**: Web server configuration or file permissions
**Solution**:
- Check Apache configuration
- Verify project directory permissions
- Check Apache error logs

### Issue: Some computers work, others don't

**Cause**: Network segmentation or firewall rules
**Solution**:
- Verify all computers are on same network subnet
- Check specific computer firewall settings
- Test with ping command

## Additional Resources

- [Laragon Documentation](https://laragon.org/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [PHP Built-in Server](https://www.php.net/manual/en/features.commandline.webserver.php)

## Support

If you encounter issues not covered in this guide:

1. Check application logs in `C:\laragon\logs\`
2. Check PostgreSQL logs in `C:\Program Files\PostgreSQL\[version]\data\log\`
3. Verify all configuration changes were applied correctly
4. Test each component individually (PostgreSQL, Apache, Application)

## Next Steps

After successful LAN setup:

1. Test all user roles (Admin, Doctor, BHW) from different computers
2. Verify queue synchronization across computers
3. Test consultation history recording
4. Set up regular database backups
5. Document your specific network configuration for future reference
6. Train staff on accessing the system from their designated computers
