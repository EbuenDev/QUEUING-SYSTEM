<div align="center">

# 🏥 RHU II Patient Queuing System

<p>
  <strong>A digital patient queuing and consultation management system designed for Rural Health Unit II.</strong>
</p>

<p>
  <a href="https://github.com/EbuenDev/QUEUING-SYSTEM">
    <img src="https://img.shields.io/badge/Project-RHU%20II%20Queuing%20System-blue" alt="Project">
  </a>
  <img src="https://img.shields.io/badge/Frontend-HTML%20%7C%20CSS%20%7C%20JavaScript-orange" alt="Frontend">
  <img src="https://img.shields.io/badge/Backend-PHP-purple" alt="Backend">
  <img src="https://img.shields.io/badge/Storage-JSON-lightgrey" alt="Storage">
</p>

</div>

---

## 📌 About

The **RHU II Patient Queuing System** is a web-based queue management application designed to organize patient flow in a Rural Health Unit.

The system provides separate interfaces for **patients, administrators, doctors, and Barangay Health Workers (BHWs)**. It allows healthcare staff to register patients, manage the queue, serve patients, record consultation information, and maintain consultation history.

The goal of the system is to reduce manual queue management, improve patient flow, and provide healthcare personnel with a centralized way to manage patient information and consultations.

---

## ✨ Features

### 👥 Patient Management

Administrators can register patients with relevant information, including:

* Full name
* PhilHealth ID
* Patient classification

  * Regular
  * Senior Citizen
  * PWD
  * Emergency
* PhilHealth status

  * Registered
  * Not Registered
  * Other Facility
  * No PhilHealth

Patient information can also be edited when necessary.

---

### 🎫 Queue Management

The system automatically assigns queue numbers to registered patients.

Queue operators can:

* Add patients to the queue
* Serve the next patient
* Serve a specific patient
* Skip a patient
* Recall a skipped patient
* Finish a consultation
* Reset the queue
* Display the currently serving patient
* Display the next patient
* Display the waiting list

The patient display provides a simplified view of the current queue so patients can monitor their position without accessing the administrative interface.

---

### 👨‍⚕️ Doctor Panel

The Doctor Panel is designed specifically for handling consultations.

Doctors can:

* View the currently serving patient
* View the next patient
* Call the next patient
* Serve a specific patient
* Recall a patient
* Skip a patient
* Finish a consultation
* Enter an ICD code
* Enter consultation details
* View consultation history
* Edit recent consultation records

This allows the queue process and consultation process to be managed from the same system.

---

### 🧑‍⚕️ BHW Panel

The **Barangay Health Worker Panel** provides a simplified interface for registering patients.

BHWs can:

* Add new patients
* Select patient classification

  * Regular
  * PWD
  * Senior Citizen
* View currently registered patients

The BHW interface intentionally provides fewer administrative controls than the Admin Panel.

---

### 🔐 Admin Authentication

The system includes an administrator login.

Authenticated administrators can access patient-management functions such as:

* Adding patients
* Editing patient information
* Deleting patients
* Managing the queue
* Viewing consultation history
* Editing consultation records

Session-based authentication is handled by the PHP backend.

---

### 📋 Consultation History

Completed consultations are recorded in the system.

The history contains information such as:

* Patient name
* Queue number
* PhilHealth information
* Patient classification
* PhilHealth status
* ICD code
* Consultation details
* Completion date and time

Administrators and doctors can review previous consultation records.

---

### 🖨️ Consultation Printing

The Admin Panel includes a **Print Consultation** function for preparing consultation information for printing.

---

### 🖥️ Patient Display

The main patient-facing display provides a real-time-style queue board showing:

* Currently serving patient
* Next patient
* Waiting patients
* Number of patients in the queue
* Live clock

The interface is designed to be suitable for displaying on a monitor or television inside the health facility.

---

## 🏗️ System Architecture

The current application uses a lightweight web architecture:

```text
┌───────────────────────────────────────────┐
│              Frontend                     │
│                                           │
│  HTML + CSS + JavaScript                  │
│                                           │
│  ┌─────────────┐  ┌──────────────────┐   │
│  │ Patient     │  │ Admin Panel      │   │
│  │ Display     │  │                  │   │
│  └─────────────┘  └──────────────────┘   │
│                                           │
│  ┌─────────────┐  ┌──────────────────┐   │
│  │ Doctor      │  │ BHW Panel        │   │
│  │ Panel       │  │                  │   │
│  └─────────────┘  └──────────────────┘   │
└───────────────────────┬───────────────────┘
                        │
                        │ HTTP / JSON
                        ▼
┌───────────────────────────────────────────┐
│              PHP Backend                  │
│                                           │
│       api.php (JSON) / api_postgres.php   │
│                                           │
│  Authentication                           │
│  Patient Management                       │
│  Queue Management                         │
│  Consultation Management                  │
└───────────────────────┬───────────────────┘
                        │
            ┌───────────┴───────────┐
            │                       │
            ▼                       ▼
┌─────────────────────┐   ┌─────────────────────┐
│   JSON Storage      │   │   PostgreSQL DB     │
│   (Legacy)          │   │   (Recommended)     │
│                     │   │                     │
│   queue.json        │   │   patients          │
│                     │   │   consultation_     │
│                     │   │   history          │
│                     │   │   queue_           │
│                     │   │   management       │
└─────────────────────┘   └─────────────────────┘
```

---

## 📂 Project Structure

```text
QUEUING-SYSTEM/
│
├── backend/
│   ├── api.php
│   ├── api_postgres.php
│   ├── queue.json
│   ├── config.php
│   └── database/
│       ├── schema.sql
│       ├── config.php
│       ├── Database.php
│       └── SETUP.md
│
├── src/
│   └── images/
│       └── logo.png
│
├── admin.html
├── bhw.html
├── doctor.html
├── index.html
├── app.js
├── styles.css
├── start-queue.bat
│
└── README.md
```

---

## 🔄 Queue Workflow

```text
Patient Registration
        │
        ▼
  Queue Number
   Assigned
        │
        ▼
     Waiting
        │
        ▼
     Serving
        │
   ┌────┼─────┐
   │    │     │
   ▼    ▼     ▼
Finish Skip  Recall
   │    │     │
   │    │     └──────► Waiting
   │    │
   │    └─────────────► Skipped
   │
   ▼
Consultation History
```

---

## 🛠️ Technology Stack

### Frontend

* HTML5
* CSS3
* Vanilla JavaScript

### Backend

* PHP
* PHP Sessions
* JSON API
* PostgreSQL integration (new)

### Data Storage

* JSON file storage using `queue.json` (legacy)
* PostgreSQL database (recommended for production)

### Development Environment

The application can be run using a local PHP development environment such as:

* Laragon
* XAMPP
* PHP built-in development server
* Apache with PHP

### Database Setup (Recommended)

The application now supports PostgreSQL for robust data storage. For production use, follow the database setup guide in `backend/database/SETUP.md`.

**Quick Setup Steps:**
1. Install PostgreSQL
2. Enable PHP PostgreSQL extension
3. Create database: `rhu_queue_system`
4. Run schema: `backend/database/schema.sql`
5. Configure connection in `backend/database/config.php`

The application uses `api_postgres.php` for database operations while maintaining backward compatibility with the JSON-based system.

---

## 🚀 Running the Project Locally

### 1. Clone the repository

```bash
git clone https://github.com/EbuenDev/QUEUING-SYSTEM.git
```

### 2. Move the project into your PHP web directory

For example, when using Laragon:

```text
C:\laragon\www\QUEUING-SYSTEM
```

### 3. Start your PHP/Apache server

Make sure PHP and your web server are running.

### 4. Open the application

Open the project through your local server.

For example:

```text
http://localhost/QUEUING-SYSTEM/
```

---

## 👤 System Roles

| Role              | Main Responsibilities                                               |
| ----------------- | ------------------------------------------------------------------- |
| 🛡️ Administrator | Manage patients, queue, consultation records, and system operations |
| 👨‍⚕️ Doctor      | Manage patient consultations and consultation history               |
| 🧑‍⚕️ BHW         | Register and view patients                                          |
| 👥 Patient        | Monitor the current queue and waiting list                          |

---

## 📊 Patient Information

Each patient can contain information including:

```text
Patient
├── ID
├── Full Name
├── Queue Number
├── Patient Status
│   ├── Regular
│   ├── Senior
│   ├── PWD
│   └── Emergency
├── PhilHealth ID
├── PhilHealth Status
│   ├── Registered
│   ├── Not Registered
│   ├── Other Facility
│   └── No PhilHealth
└── Queue Status
    ├── Waiting
    ├── Serving
    └── Skipped
```

Completed consultations are stored separately in the consultation history.

---

## 🎯 Project Objectives

The system was developed to:

* Digitize the traditional manual queuing process.
* Reduce confusion when managing patients.
* Provide clear queue visibility for patients.
* Improve patient registration.
* Give healthcare workers role-specific interfaces.
* Allow doctors to record consultation information.
* Maintain a history of completed consultations.
* Provide a simple and lightweight system suitable for a local health facility.

---

## 🔒 Security Note

This project is currently intended for **local/internal deployment and development purposes**.

Before using the system in a real healthcare environment, additional security improvements should be implemented, including:

* Secure password hashing
* Environment-based credentials
* Role-based authorization
* HTTPS
* Input validation and sanitization
* CSRF protection
* Audit logging
* Database-backed storage
* Proper protection of patient information
* Secure session configuration

**Do not expose real patient information, credentials, or sensitive healthcare data in a public repository.**

---

## 🚧 Future Improvements

Possible future improvements include:

* [x] Migrate JSON storage to MySQL/PostgreSQL
* [ ] Migrate backend to Spring Boot
* [ ] Implement stronger authentication
* [ ] Add dedicated user roles and permissions
* [ ] Add queue priority rules
* [ ] Add multiple service counters
* [ ] Add dashboard statistics
* [ ] Add patient search and filtering
* [ ] Add automated queue announcements
* [ ] Add SMS notifications
* [ ] Add appointment scheduling
* [ ] Add database backups
* [ ] Add audit logs
* [ ] Deploy the system to a production server

---

## 📸 System Interfaces

### Patient Display

The patient display shows the currently serving patient, next patient, and waiting list.

### Admin Panel

The administrator can register and manage patients, control the queue, and manage consultation history.

### Doctor Panel

Doctors can control patient flow and record consultation information.

### BHW Panel

BHWs can register patients and view the current patient list.

---

## 👨‍💻 Developer

**Mark Ian C. Ebuen**

Software Developer

GitHub: [@EbuenDev](https://github.com/EbuenDev)

---

## 📄 License

This project is currently intended as a personal/project implementation for learning, development, and health-facility workflow prototyping.

---

<div align="center">

### 🏥 RHU II Patient Queuing System

<p>Digitalizing patient queue management for a more organized healthcare workflow.</p>

</div>
```
