# Maktab Website & License Server Specification

## Document Purpose

This document provides complete specifications for building the Maktab public website and license management system on Hostinger. It is designed to be used independently by developers (Ahmadullah Ahmadi & Ahmad Zobeen Farahamand) to build the website separately from the main Maktab desktop application.

**Owner:** Ahmadullah Ahmadi, Ahmad Zobeen Farahamand
**Target Platform:** Hostinger Cloud/VPS Hosting
**Estimated Development Time:** 2-3 weeks

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Database Schema](#3-database-schema)
4. [API Endpoints](#4-api-endpoints)
5. [Public Website Pages](#5-public-website-pages)
6. [Admin Panel](#6-admin-panel)
7. [Security Implementation](#7-security-implementation)
8. [Deployment Guide](#8-deployment-guide)
9. [Integration with Maktab App](#9-integration-with-maktab-app)

---

## 1. System Overview

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HOSTINGER SERVER                                     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                     Node.js Backend (Express)                          │ │
│  │                                                                        │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │ │
│  │  │   Public    │  │    API      │  │   Admin     │  │   Static    │   │ │
│  │  │   Routes    │  │  Endpoints  │  │   Routes    │  │   Files     │   │ │
│  │  │             │  │             │  │             │  │             │   │ │
│  │  │ /           │  │ /api/       │  │ /admin/     │  │ /downloads/ │   │ │
│  │  │ /download   │  │ activate    │  │ licenses    │  │ /assets/    │   │ │
│  │  │ /activate   │  │ verify      │  │ customers   │  │             │   │ │
│  │  │ /pricing    │  │ announce    │  │ announce    │  │             │   │ │
│  │  │ /contact    │  │ feedback    │  │ feedback    │  │             │   │ │
│  │  │ /updates    │  │ version     │  │ analytics   │  │             │   │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │ │
│  │                              │                                         │ │
│  │                              ▼                                         │ │
│  │  ┌────────────────────────────────────────────────────────────────┐   │ │
│  │  │                    MySQL Database                               │   │ │
│  │  │  licenses | customers | announcements | feedback | versions    │   │ │
│  │  └────────────────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                     React Admin Dashboard                              │ │
│  │  (Served from /admin/ - Password Protected)                           │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ HTTPS
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐         ┌───────────────┐         ┌───────────────┐
│  Maktab App   │         │  Web Browser  │         │  Admin User   │
│  (API calls)  │         │  (Public)     │         │  (Dashboard)  │
└───────────────┘         └───────────────┘         └───────────────┘
```

### Components

| Component | Purpose | Technology |
|-----------|---------|------------|
| Public Website | Marketing, downloads, activation | HTML/CSS/JS or React |
| API Server | License validation, announcements | Node.js + Express |
| Admin Dashboard | License management, analytics | React |
| Database | Store all data | MySQL |
| File Storage | App downloads, assets | Hostinger file system |

---

## 2. Technology Stack

### Recommended Stack

```
Backend:
├── Node.js 18+ (LTS)
├── Express.js 4.x
├── MySQL 8.0 (included with Hostinger)
├── Sequelize ORM (or TypeORM)
├── JWT for authentication
├── bcrypt for password hashing
└── helmet for security headers

Frontend (Public):
├── Option A: Plain HTML/CSS/JS (simpler, faster)
├── Option B: React with Vite (more dynamic)
└── Tailwind CSS for styling

Admin Dashboard:
├── React 18+
├── Vite
├── React Router
├── Axios for API calls
├── Recharts for analytics
└── Tailwind CSS
```

### Hostinger Requirements

- **Plan:** Business Web Hosting or Cloud Hosting
- **Node.js:** Enabled via hPanel
- **MySQL:** Create database via hPanel
- **SSL:** Free SSL certificate (Let's Encrypt)
- **Domain:** maktab.af or similar

---

## 3. Database Schema

### Complete SQL Schema

```sql
-- =====================================================
-- MAKTAB LICENSE SERVER DATABASE SCHEMA
-- Run this SQL in your Hostinger MySQL database
-- =====================================================

-- Admin users (you and your partner)
CREATE TABLE admin_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role ENUM('super_admin', 'admin') DEFAULT 'admin',
    last_login_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- NOTE: Do NOT insert admin users via SQL!
-- Admin accounts must be created via the setup script on first deployment.
-- See "First-Run Admin Setup" section in Deployment Guide.

-- Licenses table
CREATE TABLE licenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    license_key VARCHAR(24) UNIQUE NOT NULL,      -- Format: MKTB-XXXX-XXXX-XXXX-XXXX
    license_type ENUM('trial', '6-month', 'annual') NOT NULL,
    status ENUM('pending', 'activated', 'expired', 'revoked') DEFAULT 'pending',
    
    -- Activation info (filled when activated)
    machine_id VARCHAR(14),                        -- Format: XXXX-XXXX-XXXX
    activated_at DATETIME,
    expires_at DATETIME,
    
    -- Revocation info
    revoked_at DATETIME,
    revoke_reason TEXT,
    
    -- Payment info
    payment_method VARCHAR(50),                    -- hawala, bank, etc.
    payment_reference VARCHAR(100),                -- Transaction ID
    payment_amount DECIMAL(10,2),
    payment_currency VARCHAR(3) DEFAULT 'AFN',
    payment_verified BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    notes TEXT,                                    -- Admin notes
    created_by INT,                                -- Admin who created
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES admin_users(id),
    INDEX idx_license_key (license_key),
    INDEX idx_machine_id (machine_id),
    INDEX idx_status (status)
);

-- Customers table (schools/users)
CREATE TABLE customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    license_id INT,
    
    -- School info
    school_name VARCHAR(255) NOT NULL,
    school_name_en VARCHAR(255),                   -- English name if available
    province VARCHAR(100) NOT NULL,
    district VARCHAR(100),
    address TEXT,
    
    -- Admin/Contact info
    admin_name VARCHAR(255) NOT NULL,
    admin_phone VARCHAR(20) NOT NULL,
    admin_email VARCHAR(255),
    admin_position VARCHAR(100),                   -- Principal, IT Admin, etc.
    
    -- Technical info
    app_version VARCHAR(20),
    last_seen_at DATETIME,
    last_ip VARCHAR(45),
    total_verifications INT DEFAULT 0,
    
    -- Metadata
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (license_id) REFERENCES licenses(id),
    INDEX idx_province (province),
    INDEX idx_school_name (school_name)
);

-- Announcements table
CREATE TABLE announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Content
    title VARCHAR(255) NOT NULL,                   -- Farsi title
    title_en VARCHAR(255),                         -- English title (optional)
    content TEXT NOT NULL,                         -- Farsi content (supports markdown)
    content_en TEXT,                               -- English content (optional)
    
    -- Display settings
    priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
    type ENUM('news', 'update', 'maintenance', 'promotion', 'warning') DEFAULT 'news',
    
    -- Targeting
    target_province VARCHAR(100),                  -- NULL = all provinces
    target_license_type VARCHAR(20),               -- NULL = all types
    
    -- Action button (optional)
    action_url VARCHAR(500),
    action_label VARCHAR(100),                     -- Farsi button text
    
    -- Scheduling
    publish_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    created_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES admin_users(id),
    INDEX idx_active (is_active, publish_at, expires_at)
);

-- Announcement reads (track who has seen what)
CREATE TABLE announcement_reads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    announcement_id INT NOT NULL,
    machine_id VARCHAR(14) NOT NULL,
    read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
    UNIQUE KEY unique_read (announcement_id, machine_id)
);

-- User feedback/messages
CREATE TABLE feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Sender info
    machine_id VARCHAR(14),
    license_key VARCHAR(24),
    school_name VARCHAR(255),
    contact_name VARCHAR(255),
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    
    -- Message
    subject VARCHAR(255),
    message TEXT NOT NULL,
    type ENUM('feedback', 'bug_report', 'feature_request', 'support', 'other') DEFAULT 'feedback',
    
    -- Status
    status ENUM('new', 'read', 'in_progress', 'resolved', 'closed') DEFAULT 'new',
    admin_response TEXT,
    responded_by INT,
    responded_at DATETIME,
    
    -- Metadata
    app_version VARCHAR(20),
    ip_address VARCHAR(45),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (responded_by) REFERENCES admin_users(id),
    INDEX idx_status (status),
    INDEX idx_type (type)
);

-- App versions
CREATE TABLE app_versions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    version VARCHAR(20) NOT NULL,                  -- e.g., "1.2.0"
    version_code INT NOT NULL,                     -- e.g., 120 (for comparison)
    
    -- Download info
    download_url VARCHAR(500) NOT NULL,
    file_size VARCHAR(20),                         -- e.g., "85 MB"
    checksum_sha256 VARCHAR(64),                   -- For integrity verification
    
    -- Release info
    changelog TEXT,                                -- Farsi changelog
    changelog_en TEXT,                             -- English changelog
    
    -- Flags
    is_required BOOLEAN DEFAULT FALSE,             -- Force update?
    is_latest BOOLEAN DEFAULT FALSE,               -- Current latest version
    is_beta BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    released_by INT,
    released_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (released_by) REFERENCES admin_users(id),
    INDEX idx_latest (is_latest),
    INDEX idx_version_code (version_code)
);

-- Audit logs (track all important actions)
CREATE TABLE audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- What happened
    event_type VARCHAR(50) NOT NULL,               -- activation, verification, revoke, etc.
    event_description TEXT,
    
    -- Who/What
    admin_id INT,                                  -- If admin action
    license_id INT,
    machine_id VARCHAR(14),
    
    -- Context
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_data JSON,                             -- Store request payload
    response_data JSON,                            -- Store response
    
    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (admin_id) REFERENCES admin_users(id),
    FOREIGN KEY (license_id) REFERENCES licenses(id),
    INDEX idx_event_type (event_type),
    INDEX idx_created_at (created_at),
    INDEX idx_license (license_id)
);

-- Pricing configuration
CREATE TABLE pricing (
    id INT AUTO_INCREMENT PRIMARY KEY,
    license_type ENUM('trial', '6-month', 'annual') NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'AFN',
    duration_days INT NOT NULL,
    description TEXT,                              -- Farsi description
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_type (license_type)
);

-- Insert default pricing
INSERT INTO pricing (license_type, price, currency, duration_days, description) VALUES
('trial', 0, 'AFN', 14, 'دوره آزمایشی ۱۴ روزه - رایگان'),
('6-month', 5000, 'AFN', 180, 'لایسنس شش ماهه'),
('annual', 8000, 'AFN', 365, 'لایسنس سالانه - صرفه‌جویی ۲۰۰۰ افغانی');

-- Site settings (key-value store for configuration)
CREATE TABLE settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    description VARCHAR(255),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO settings (setting_key, setting_value, setting_type, description) VALUES
('site_name', 'مکتب - نرم‌افزار جدول زمانی', 'string', 'Site name in Farsi'),
('site_name_en', 'Maktab - Timetable Software', 'string', 'Site name in English'),
('contact_whatsapp', '+93XXXXXXXXX', 'string', 'WhatsApp contact number'),
('contact_telegram', '@maktab_support', 'string', 'Telegram handle'),
('contact_phone', '+93XXXXXXXXX', 'string', 'Phone number'),
('contact_email', 'support@maktab.af', 'string', 'Support email'),
('grace_period_days', '14', 'number', 'Days app works without verification'),
('verification_interval_days', '30', 'number', 'Days between required verifications'),
('maintenance_mode', 'false', 'boolean', 'Enable maintenance mode'),
('hawala_cities', '["کابل", "هرات", "مزار شریف", "قندهار", "جلال‌آباد"]', 'json', 'Cities for Hawala payment');
```

---

## 4. API Endpoints

### 4.1 Public API (Used by Maktab App)

#### POST /api/activate
Activate a license key with machine binding.

```javascript
// Request
POST /api/activate
Content-Type: application/json

{
  "licenseKey": "MKTB-A1B2-C3D4-E5F6-G7H8",
  "machineId": "ABC1-XY2Z-9K4M",
  "schoolName": "لیسه استقلال",
  "province": "کابل",
  "adminName": "احمد محمدی",
  "adminPhone": "0799123456",
  "adminEmail": "admin@school.af",  // optional
  "appVersion": "1.0.0",
  "signature": "hmac_signature_here",
  "timestamp": 1702400000000
}

// Success Response (200)
{
  "success": true,
  "license": {
    "licenseKey": "MKTB-A1B2-C3D4-E5F6-G7H8",
    "licenseType": "annual",
    "activatedAt": "2024-12-12T10:00:00Z",
    "expiresAt": "2025-12-12T10:00:00Z",
    "daysRemaining": 365,
    "schoolName": "لیسه استقلال"
  },
  "announcements": [...],
  "latestVersion": {
    "version": "1.0.0",
    "isUpdateAvailable": false
  },
  "signature": "response_signature"
}

// Error Responses
// 400 - Invalid request format
{
  "success": false,
  "error": "INVALID_FORMAT",
  "message": "فرمت درخواست نامعتبر است"
}

// 404 - License key not found
{
  "success": false,
  "error": "KEY_NOT_FOUND",
  "message": "کلید لایسنس یافت نشد"
}

// 409 - Already activated
{
  "success": false,
  "error": "ALREADY_ACTIVATED",
  "message": "این لایسنس قبلاً فعال شده است"
}

// 401 - Invalid signature
{
  "success": false,
  "error": "INVALID_SIGNATURE",
  "message": "امضای درخواست نامعتبر است"
}
```

#### POST /api/verify
Periodic license verification (every 30 days).

```javascript
// Request
POST /api/verify
Content-Type: application/json

{
  "machineId": "ABC1-XY2Z-9K4M",
  "licenseKey": "MKTB-A1B2-C3D4-E5F6-G7H8",
  "appVersion": "1.0.0",
  "signature": "hmac_signature_here",
  "timestamp": 1702400000000
}

// Success Response (200)
{
  "success": true,
  "status": "valid",  // valid, expired, revoked
  "license": {
    "expiresAt": "2025-12-12T10:00:00Z",
    "daysRemaining": 365,
    "graceDaysRemaining": null
  },
  "announcements": [
    {
      "id": "ann_123",
      "title": "نسخه جدید منتشر شد",
      "content": "نسخه ۱.۱.۰ با قابلیت‌های جدید...",
      "priority": "normal",
      "type": "update",
      "actionUrl": "https://maktab.af/download",
      "actionLabel": "دانلود"
    }
  ],
  "latestVersion": {
    "version": "1.1.0",
    "isUpdateAvailable": true,
    "isRequired": false,
    "downloadUrl": "https://maktab.af/downloads/maktab-1.1.0.exe",
    "changelog": "- رفع مشکلات\n- قابلیت جدید..."
  },
  "signature": "response_signature"
}

// Expired license (403)
{
  "success": false,
  "status": "expired",
  "error": "LICENSE_EXPIRED",
  "message": "لایسنس شما منقضی شده است",
  "license": {
    "expiresAt": "2024-06-12T10:00:00Z",
    "daysRemaining": -180
  }
}

// Revoked license (403)
{
  "success": false,
  "status": "revoked",
  "error": "LICENSE_REVOKED",
  "message": "لایسنس شما لغو شده است",
  "revokeReason": "درخواست مشتری"
}
```

#### GET /api/announcements
Get announcements for a specific machine.

```javascript
// Request
GET /api/announcements?machineId=ABC1-XY2Z-9K4M&since=2024-01-01T00:00:00Z

// Response (200)
{
  "success": true,
  "announcements": [
    {
      "id": "ann_123",
      "title": "اطلاعیه مهم",
      "content": "متن اطلاعیه...",
      "priority": "high",
      "type": "news",
      "createdAt": "2024-12-10T10:00:00Z",
      "expiresAt": "2024-12-20T10:00:00Z"
    }
  ],
  "count": 1
}
```

#### GET /api/version
Get latest app version info.

```javascript
// Request
GET /api/version?current=1.0.0

// Response (200)
{
  "success": true,
  "currentVersion": "1.0.0",
  "latestVersion": "1.1.0",
  "isUpdateAvailable": true,
  "isRequired": false,
  "downloadUrl": "https://maktab.af/downloads/maktab-1.1.0.exe",
  "fileSize": "85 MB",
  "changelog": "## نسخه ۱.۱.۰\n- رفع مشکلات\n- قابلیت جدید",
  "releasedAt": "2024-12-10T10:00:00Z"
}
```

#### POST /api/feedback
Submit user feedback/message.

```javascript
// Request
POST /api/feedback
Content-Type: application/json

{
  "machineId": "ABC1-XY2Z-9K4M",
  "licenseKey": "MKTB-A1B2-C3D4-E5F6-G7H8",
  "schoolName": "لیسه استقلال",
  "contactName": "احمد محمدی",
  "contactPhone": "0799123456",
  "subject": "پیشنهاد قابلیت جدید",
  "message": "سلام، لطفاً قابلیت... را اضافه کنید",
  "type": "feature_request",
  "appVersion": "1.0.0"
}

// Response (201)
{
  "success": true,
  "message": "پیام شما با موفقیت ارسال شد",
  "ticketId": "FB-2024-001"
}
```

### 4.2 Admin API (Protected)

All admin endpoints require JWT authentication.

```javascript
// Authentication header
Authorization: Bearer <jwt_token>
```

#### POST /api/admin/login
```javascript
// Request
{
  "username": "ahmadullah",
  "password": "your_password"
}

// Response
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "username": "ahmadullah",
    "fullName": "Ahmadullah Ahmadi",
    "role": "super_admin"
  }
}
```

#### GET /api/admin/licenses
```javascript
// Query params: ?status=activated&type=annual&page=1&limit=20

// Response
{
  "success": true,
  "licenses": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

#### POST /api/admin/licenses/generate
```javascript
// Request
{
  "licenseType": "annual",
  "count": 1,
  "notes": "برای مکتب استقلال"
}

// Response
{
  "success": true,
  "licenses": [
    {
      "id": 123,
      "licenseKey": "MKTB-A1B2-C3D4-E5F6-G7H8",
      "licenseType": "annual",
      "status": "pending"
    }
  ]
}
```

#### PUT /api/admin/licenses/:id/revoke
```javascript
// Request
{
  "reason": "درخواست مشتری"
}

// Response
{
  "success": true,
  "message": "لایسنس با موفقیت لغو شد"
}
```

#### PUT /api/admin/licenses/:id/extend
```javascript
// Request
{
  "days": 30,
  "reason": "تمدید رایگان به دلیل مشکل فنی"
}

// Response
{
  "success": true,
  "newExpiresAt": "2025-01-12T10:00:00Z"
}
```

---

## 5. Public Website Pages

### 5.1 Homepage (/)

**Purpose:** Marketing, introduce the product

**Content:**
- Hero section with app screenshot
- Key features (Farsi)
- Pricing overview
- Download CTA button
- Testimonials (if available)
- Contact section

**Design Notes:**
- RTL layout for Farsi
- Clean, professional design
- Mobile responsive
- Fast loading

### 5.2 Download Page (/download)

**Purpose:** Download latest version

**Content:**
- Current version info
- Download button (direct .exe link)
- System requirements
- Installation instructions (Farsi)
- Changelog/What's new
- Previous versions (optional)

### 5.3 Activation Page (/activate)

**Purpose:** License activation flow

**URL Pattern:** `/activate?mid=ABC1-XY2Z-9K4M` (machine ID from app)

**Flow:**
1. Display machine ID (pre-filled from URL)
2. User enters license key
3. User fills school info form
4. Submit → API call → Show result
5. Success: Display activation confirmation
6. Error: Show error message with retry

**Form Fields:**
```
- کود دستگاه (Machine ID) - readonly, pre-filled
- کلید لایسنس (License Key) - input
- نام مکتب (School Name) - input
- ولایت (Province) - dropdown
- نام مسئول (Admin Name) - input
- شماره تماس (Phone) - input
- ایمیل (Email) - optional input
```

### 5.4 Pricing Page (/pricing)

**Purpose:** Show pricing and payment methods

**Content:**
- Pricing table (Trial, 6-month, Annual)
- Payment methods:
  - حواله (Hawala) - with city list
  - بانک غضنفر (Ghazanfar Bank) - account details
  - حساب پی (HesabPay) - if available
  - ام‌پیسه (M-Paisa) - if available
- Payment instructions in Farsi
- Contact for payment confirmation

### 5.5 Contact Page (/contact)

**Purpose:** Contact form and info

**Content:**
- Contact form (name, phone, email, message)
- WhatsApp link
- Telegram link
- Phone number
- Email address
- Office address (if applicable)

### 5.6 Updates Page (/updates)

**Purpose:** Changelog and announcements

**Content:**
- Latest version info
- Full changelog history
- Active announcements
- Upcoming features (roadmap)

---

## 6. Admin Panel

### 6.1 Dashboard (/admin)

**Widgets:**
- Total licenses (by status)
- Active customers count
- Revenue this month
- Recent activations chart
- Licenses by province chart
- Expiring soon alerts

### 6.2 License Management (/admin/licenses)

**Features:**
- List all licenses with filters
- Generate new license keys
- View license details
- Revoke license
- Extend license
- Export to CSV

**Table Columns:**
| License Key | Type | Status | School | Province | Activated | Expires | Actions |

### 6.3 Customer Management (/admin/customers)

**Features:**
- List all customers
- Search by school name
- Filter by province, license type
- View customer details
- View verification history
- Export to CSV

### 6.4 Announcements (/admin/announcements)

**Features:**
- List all announcements
- Create new announcement
- Edit/delete announcement
- Target by province/license type
- Schedule publish date
- Set expiry date

### 6.5 Feedback (/admin/feedback)

**Features:**
- List all feedback/messages
- Filter by status, type
- View message details
- Respond to message
- Mark as resolved

### 6.6 Versions (/admin/versions)

**Features:**
- List all versions
- Upload new version
- Set as latest
- Mark as required update
- Edit changelog

### 6.7 Settings (/admin/settings)

**Features:**
- Contact information
- Payment configuration
- Pricing management
- Grace period settings
- Maintenance mode toggle

---

## 7. Security Implementation

### 7.1 Request Signing (HMAC)

```javascript
// Shared secret (store in environment variables)
const SECRET_KEY = process.env.LICENSE_SECRET_KEY;

// Sign request (client-side - Maktab App)
function signRequest(payload, timestamp) {
  const data = JSON.stringify(payload) + timestamp;
  return crypto
    .createHmac('sha256', SECRET_KEY)
    .update(data)
    .digest('hex');
}

// Verify request (server-side)
function verifyRequest(payload, signature, timestamp) {
  // Check timestamp is within 5 minutes
  const now = Date.now();
  if (Math.abs(now - timestamp) > 5 * 60 * 1000) {
    return false; // Request too old
  }
  
  const expectedSignature = signRequest(payload, timestamp);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Sign response (server-side)
function signResponse(payload) {
  const timestamp = Date.now();
  const data = JSON.stringify(payload) + timestamp;
  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(data)
    .digest('hex');
  return { ...payload, timestamp, signature };
}
```

### 7.2 JWT Authentication (Admin)

```javascript
// Generate JWT on login
const jwt = require('jsonwebtoken');

function generateToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      role: user.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
}

// Verify JWT middleware
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

### 7.3 Password Hashing

```javascript
const bcrypt = require('bcrypt');

// Hash password (on registration/password change)
async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

// Verify password (on login)
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
```

### 7.4 Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

// API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: { error: 'Too many requests, please try again later' }
});

// Activation rate limiter (stricter)
const activationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 activation attempts per hour
  message: { error: 'Too many activation attempts' }
});

app.use('/api/', apiLimiter);
app.use('/api/activate', activationLimiter);
```

### 7.5 Security Headers

```javascript
const helmet = require('helmet');

app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    scriptSrc: ["'self'"],
    imgSrc: ["'self'", "data:", "https:"],
  }
}));
```

### 7.6 Password Policy

Enforce strong passwords for admin accounts:

```javascript
// src/utils/validators.js

function validatePassword(password) {
  const errors = [];
  
  if (password.length < 12) {
    errors.push('رمز عبور باید حداقل ۱۲ کاراکتر باشد');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('رمز عبور باید حداقل یک حرف بزرگ داشته باشد');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('رمز عبور باید حداقل یک حرف کوچک داشته باشد');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('رمز عبور باید حداقل یک عدد داشته باشد');
  }
  if (!/[!@#$%^&*]/.test(password)) {
    errors.push('رمز عبور باید حداقل یک کاراکتر خاص داشته باشد');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

---

## 8. Deployment Guide

### 8.1 Hostinger Setup

#### Step 1: Create Hosting Account
1. Go to Hostinger.com
2. Choose "Business Web Hosting" or "Cloud Hosting"
3. Register domain (maktab.af or similar)
4. Complete purchase

#### Step 2: Set Up Node.js
1. Log in to hPanel
2. Go to "Advanced" → "Node.js"
3. Enable Node.js
4. Set Node.js version to 18.x LTS
5. Set application root to `/public_html`
6. Set startup file to `server.js`

#### Step 3: Create MySQL Database
1. In hPanel, go to "Databases" → "MySQL Databases"
2. Create new database: `maktab_license`
3. Create database user with strong password
4. Grant all privileges to user
5. Note down: host, database, username, password

#### Step 4: Upload Files
1. Use File Manager or FTP
2. Upload all project files to `/public_html`
3. Create `.env` file with configuration

#### Step 5: Configure Environment Variables

Create `.env` file:
```env
# Server
NODE_ENV=production
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=maktab_license
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# Security (generate with: openssl rand -hex 32)
JWT_SECRET=your_very_long_random_jwt_secret_key_here
LICENSE_SECRET_KEY=your_very_long_random_license_secret_key_here
ADMIN_SETUP_TOKEN=your_one_time_setup_token_here

# Contact Info
CONTACT_WHATSAPP=+93XXXXXXXXX
CONTACT_TELEGRAM=@maktab_support
CONTACT_EMAIL=support@maktab.af
```

#### Step 6: Install Dependencies & Run
```bash
# SSH into server or use terminal in hPanel
cd /public_html
npm install --production
npm run migrate  # Run database migrations
npm start
```

#### Step 7: Set Up SSL
1. In hPanel, go to "Security" → "SSL"
2. Enable free SSL (Let's Encrypt)
3. Force HTTPS redirect

#### Step 8: First-Run Admin Setup

On first deployment, create admin accounts using the setup script (never via raw SQL):

```bash
# SSH into server
cd /public_html
npm run setup:admin
```

This will prompt you to create the first admin account with a strong password.

**Password Requirements:**
- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (!@#$%^&*)

Alternatively, create admin via API on first run:
```bash
curl -X POST https://maktab.af/api/admin/setup \
  -H "Content-Type: application/json" \
  -H "X-Setup-Token: $ADMIN_SETUP_TOKEN" \
  -d '{
    "username": "ahmadullah",
    "email": "ahmadullah@maktab.af",
    "password": "YourStrongPassword123!",
    "fullName": "Ahmadullah Ahmadi"
  }'
```

The setup endpoint only works once (when no admins exist) and requires the `ADMIN_SETUP_TOKEN` from `.env`.

### 8.3 Database Backup Strategy

**Critical:** Set up automated daily backups to prevent data loss.

#### Option A: Hostinger Automatic Backups
1. In hPanel, go to "Files" → "Backups"
2. Enable daily automatic backups
3. Hostinger keeps 7 days of backups

#### Option B: Manual Backup Script (Recommended)

Create `scripts/backup.sh`:
```bash
#!/bin/bash
# Daily database backup script

DATE=$(date +%Y-%m-%d)
BACKUP_DIR="/home/user/backups"
DB_NAME="maktab_license"
DB_USER="your_db_user"
DB_PASS="your_db_password"

# Create backup directory if not exists
mkdir -p $BACKUP_DIR

# Dump database
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME > $BACKUP_DIR/maktab_$DATE.sql

# Compress
gzip $BACKUP_DIR/maktab_$DATE.sql

# Delete backups older than 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: maktab_$DATE.sql.gz"
```

Set up cron job (via hPanel → Cron Jobs):
```
0 3 * * * /home/user/public_html/scripts/backup.sh
```

This runs daily at 3 AM.

#### Backup Best Practices
- Keep at least 30 days of backups
- Test restore process monthly
- Consider offsite backup (Google Drive, Dropbox) for critical data

### 8.4 HTTPS Enforcement

Add HTTPS redirect middleware to `server.js`:

```javascript
// Force HTTPS in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
  
  // HSTS header - tell browsers to always use HTTPS
  app.use((req, res, next) => {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
}
```

### 8.5 Project Structure

```
maktab-website/
├── server.js                 # Main entry point
├── package.json
├── .env                      # Environment variables (not in git)
├── .env.example              # Example env file
│
├── src/
│   ├── config/
│   │   ├── database.js       # Database connection
│   │   └── constants.js      # App constants
│   │
│   ├── middleware/
│   │   ├── auth.js           # JWT authentication
│   │   ├── signature.js      # Request signature verification
│   │   ├── rateLimit.js      # Rate limiting
│   │   └── errorHandler.js   # Global error handler
│   │
│   ├── models/               # Sequelize models
│   │   ├── License.js
│   │   ├── Customer.js
│   │   ├── Announcement.js
│   │   ├── Feedback.js
│   │   ├── AppVersion.js
│   │   ├── AdminUser.js
│   │   └── AuditLog.js
│   │
│   ├── routes/
│   │   ├── api/              # Public API routes
│   │   │   ├── activate.js
│   │   │   ├── verify.js
│   │   │   ├── announcements.js
│   │   │   ├── version.js
│   │   │   └── feedback.js
│   │   │
│   │   └── admin/            # Admin API routes
│   │       ├── auth.js
│   │       ├── licenses.js
│   │       ├── customers.js
│   │       ├── announcements.js
│   │       ├── feedback.js
│   │       ├── versions.js
│   │       └── settings.js
│   │
│   ├── services/
│   │   ├── licenseService.js
│   │   ├── customerService.js
│   │   ├── announcementService.js
│   │   ├── signatureService.js
│   │   └── auditService.js
│   │
│   └── utils/
│       ├── logger.js
│       ├── validators.js
│       └── helpers.js
│
├── public/                   # Static files
│   ├── index.html            # Homepage
│   ├── download.html
│   ├── activate.html
│   ├── pricing.html
│   ├── contact.html
│   ├── updates.html
│   │
│   ├── css/
│   │   └── style.css
│   │
│   ├── js/
│   │   └── main.js
│   │
│   ├── images/
│   │   └── ...
│   │
│   └── downloads/            # App installer files
│       └── maktab-1.0.0.exe
│
├── admin/                    # React admin dashboard (built)
│   ├── index.html
│   └── assets/
│
└── migrations/               # Database migrations
    └── ...
```

---

## 9. Integration with Maktab App

### 9.1 What Maktab App Needs to Implement

The following features need to be added to the Maktab desktop app (this repository):

#### 1. Internet Connectivity Check
```typescript
// Check if online
async function isOnline(): Promise<boolean> {
  try {
    const response = await fetch('https://maktab.af/api/health', {
      method: 'HEAD',
      timeout: 5000
    });
    return response.ok;
  } catch {
    return false;
  }
}
```

#### 2. Open Browser for Activation
```typescript
// In Electron main process
import { shell } from 'electron';

function openActivationPage(machineId: string) {
  const url = `https://maktab.af/activate?mid=${machineId}`;
  shell.openExternal(url);
}
```

#### 3. License Activation API Call
```typescript
interface ActivationRequest {
  licenseKey: string;
  machineId: string;
  schoolName: string;
  province: string;
  adminName: string;
  adminPhone: string;
  adminEmail?: string;
  appVersion: string;
  signature: string;
  timestamp: number;
}

async function activateLicense(request: ActivationRequest): Promise<ActivationResponse> {
  const response = await fetch('https://maktab.af/api/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
  return response.json();
}
```

#### 4. Periodic Verification
```typescript
// Check every 30 days
async function verifyLicense(): Promise<VerificationResponse> {
  const request = {
    machineId: getMachineId(),
    licenseKey: getStoredLicenseKey(),
    appVersion: APP_VERSION,
    timestamp: Date.now(),
    signature: signRequest(...)
  };
  
  const response = await fetch('https://maktab.af/api/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
  return response.json();
}
```

#### 5. Announcement Fetcher
```typescript
async function fetchAnnouncements(): Promise<Announcement[]> {
  const machineId = getMachineId();
  const lastFetch = getLastAnnouncementFetch();
  
  const response = await fetch(
    `https://maktab.af/api/announcements?machineId=${machineId}&since=${lastFetch}`
  );
  const data = await response.json();
  return data.announcements;
}
```

#### 6. Update Checker
```typescript
async function checkForUpdates(): Promise<UpdateInfo | null> {
  const response = await fetch(
    `https://maktab.af/api/version?current=${APP_VERSION}`
  );
  const data = await response.json();
  
  if (data.isUpdateAvailable) {
    return {
      version: data.latestVersion,
      downloadUrl: data.downloadUrl,
      isRequired: data.isRequired,
      changelog: data.changelog
    };
  }
  return null;
}
```

#### 7. Feedback Sender
```typescript
async function sendFeedback(feedback: FeedbackRequest): Promise<void> {
  await fetch('https://maktab.af/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...feedback,
      machineId: getMachineId(),
      licenseKey: getStoredLicenseKey(),
      appVersion: APP_VERSION
    })
  });
}
```

### 9.2 Configuration Constants

Add to Maktab app:

```typescript
// packages/api/src/constants.ts

export const LICENSE_SERVER = {
  BASE_URL: process.env.LICENSE_SERVER_URL || 'https://maktab.af',
  API_VERSION: 'v1',
  ENDPOINTS: {
    ACTIVATE: '/api/activate',
    VERIFY: '/api/verify',
    ANNOUNCEMENTS: '/api/announcements',
    VERSION: '/api/version',
    FEEDBACK: '/api/feedback',
    HEALTH: '/api/health'
  },
  VERIFICATION_INTERVAL_DAYS: 30,
  GRACE_PERIOD_DAYS: 14,
  REQUEST_TIMEOUT_MS: 10000
};

// Store this securely - same key must be on server
export const LICENSE_SECRET_KEY = process.env.LICENSE_SECRET_KEY || '';
```

---

## Summary

This document provides everything needed to build the Maktab website and license server:

1. **Database Schema** - Complete SQL ready to run
2. **API Endpoints** - All request/response formats
3. **Website Pages** - Content and structure for each page
4. **Admin Panel** - Features and UI requirements
5. **Security** - Signing, authentication, rate limiting
6. **Deployment** - Step-by-step Hostinger setup
7. **Integration** - What the Maktab app needs to implement

**Estimated Timeline:**
- Week 1: Backend API + Database
- Week 2: Public website pages
- Week 3: Admin dashboard
- Week 4: Testing + Deployment

**Contact for Questions:**
- Ahmadullah Ahmadi
- Ahmad Zobeen Farahamand
