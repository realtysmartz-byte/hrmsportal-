# Realty Smartz HRMS Portal - Complete Architecture & Flow Graph

Yeh document Realty Smartz HRMS Portal ka complete technical aur functional workflow explain karta hai. Isme frontend, backend APIs, database models, background crons aur external integrations ke sare flows step-by-step Mermaid diagrams aur tables ke sath diye gaye hain.

---

## 1. System High-Level Architecture Flow

```mermaid
graph TD
    subgraph Clients["Client Layer"]
        Browser["Desktop & Mobile Web Browsers"]
        PWA["PWA (Progressive Web App)"]
        Android["Android Native Wrapper App"]
    end

    subgraph WebApp["apps/web (Next.js 14 App Router)"]
        Middleware["Next.js Middleware (HTTPS Enforcement, Auth Token & Role Check)"]
        NextAuth["NextAuth.js (Credentials & Google OAuth, JWT Session)"]
        UI_Employee["/employee-portal (Dashboard, Punch, Leaves, Performance, Profile)"]
        UI_Admin["/admin-portal (Dashboard, Staff, Leaves, Attendance, Settings, Holidays)"]
        TRPC_Client["tRPC React Query Client"]
        RouteHandlers["API Route Handlers (/api/geocode, /api/health, /api/cron/*)"]
    end

    subgraph API["packages/api (tRPC Routers & Business Services)"]
        TRPC_Server["tRPC API Router (trpc/index.ts)"]
        subgraph Routers["Domain Routers"]
            R_Employee["employeeRouter"]
            R_Attendance["attendanceRouter"]
            R_Leave["leaveRouter"]
            R_Holiday["holidayRouter"]
            R_Performance["performanceRouter"]
            R_Recruitment["recruitmentRouter"]
            R_Settings["companySettingsRouter"]
            R_Telegram["telegramRouter"]
            R_Sheets["googleSheetsRouter"]
        end
        subgraph Services["Core Backend Services"]
            GeofenceEngine["Geofence & Haversine Distance Engine"]
            EmailService["Nodemailer SMTP Service"]
            TelegramService["Telegram Bot Automation Service"]
            GoogleSheetsSync["Google Sheets API V4 Exporter"]
            WebPushService["Web Push Notification Engine"]
        end
    end

    subgraph DataLayer["packages/db & Storage"]
        PrismaClient["Prisma ORM Client"]
        PostgresDB[("PostgreSQL Database (Neon / Supabase)")]
        HolidaysStore[("data/holidays.json (Multi-Date Holiday Store)")]
    end

    subgraph External["External Integrations"]
        GoogleMaps["Google Maps Geocoding API"]
        TelegramAPI["Telegram Bot API (Notifications)"]
        GoogleDrive["Google Sheets (Attendance Backup)"]
        SMTPServer["SMTP Server (Email Alerts)"]
    end

    Clients --> Middleware
    Middleware --> UI_Employee
    Middleware --> UI_Admin
    UI_Employee --> TRPC_Client
    UI_Admin --> TRPC_Client
    TRPC_Client --> TRPC_Server

    TRPC_Server --> Routers
    Routers --> Services
    Routers --> PrismaClient
    R_Holiday --> HolidaysStore
    PrismaClient --> PostgresDB

    Services --> GoogleMaps
    Services --> TelegramAPI
    Services --> GoogleDrive
    Services --> SMTPServer
```

---

## 2. Authentication & Role-Based Routing Flow

System me 4 user roles hain: `ADMIN`, `HR`, `MANAGER`, aur `EMPLOYEE`.

```mermaid
sequenceDiagram
    autonumber
    actor User as User (Employee / Admin)
    participant Browser as Web Browser / Mobile
    participant MW as Middleware (middleware.ts)
    participant Auth as NextAuth (/api/auth/[...nextauth])
    participant DB as PostgreSQL (Employee Table)

    User->>Browser: Enters email & password (or Google Login)
    Browser->>Auth: POST /api/auth/callback/credentials
    Auth->>DB: Query Employee by email
    DB-->>Auth: Employee record (with role, status, passwordHash)
    
    alt Status != ACTIVE
        Auth-->>Browser: Login Rejected (Account suspended/inactive)
    else Password Match
        Auth->>Auth: Generate JWT with user id, role, employeeCode
        Auth-->>Browser: Set secure HttpOnly session cookie
        Browser->>MW: Navigation request to /admin-portal or /employee-portal
        MW->>MW: Verify JWT token & check requested path

        alt Role is EMPLOYEE and requests /admin-portal
            MW-->>Browser: Redirect to /employee-portal/dashboard
        else Role is ADMIN or HR and requests /admin-portal
            MW-->>Browser: Grant access to /admin-portal
        else Requests /employee-portal
            MW-->>Browser: Grant access to /employee-portal
        end
    end
```

---

## 3. Attendance Punch Flow (GPS & Geofencing)

Har punch par browser ya mobile device se GPS coordinates capture kiye jate hain. Server in coordinates ko office HQ aur employee ke assigned sites se match karta hai.

```mermaid
flowchart TD
    StartPunch([Employee Clicks Punch In / Out]) --> GetGPS[Browser asks for navigator.geolocation]
    GetGPS --> GotCoords{GPS Available & Allowed?}
    
    GotCoords -- No --> ErrorGPS[Show Error: GPS Permission Required]
    GotCoords -- Yes --> SendPayload[Submit lat, lng, accuracy, photo to attendance.punch]

    SendPayload --> ServerContext[tRPC attendanceRouter: punch mutation]
    ServerContext --> FetchSettings[Fetch CompanySettings: officeLat, officeLng, geofenceRadiusM]
    FetchSettings --> FetchSites[Fetch Employee: assignedLocations up to 3 sites]
    
    FetchSites --> CalcDistance[Calculate Haversine Distance to HQ and all assigned sites]
    CalcDistance --> CheckRadius{Distance <= geofenceRadiusM (e.g. 200m)?}

    CheckRadius -- Yes --> WithinFence[Set withinGeofence = true]
    CheckRadius -- No --> OutsideFence[Set withinGeofence = false & Flag Alert]

    WithinFence --> GeocodeAddress[Call Reverse Geocoding to get human-readable street address]
    OutsideFence --> GeocodeAddress

    GeocodeAddress --> SavePunch[Create AttendancePunch & Update AttendanceLog for today]
    
    SavePunch --> TriggerAlerts[Async Notifications]
    
    subgraph Alerts["Notification Dispatch"]
        TriggerAlerts --> TG[Telegram Bot: Send Punch Summary to Group]
        TriggerAlerts --> Mail[SMTP Mail: Send notification if late or outside geofence]
        TriggerAlerts --> Sheets[Queue Google Sheets daily attendance sync]
    end

    SavePunch --> ResponseClient([Return Success & Update UI Card to Active Punch State])
```

---

## 4. Leave Management Workflow

Employee leave apply karta hai, manager ya HR review karte hain, aur decision email/telegram par notify hota hai.

```mermaid
sequenceDiagram
    autonumber
    actor Emp as Employee
    participant Portal as Employee Portal UI
    participant LeaveRouter as tRPC leaveRouter
    participant DB as PostgreSQL
    actor Mgr as Manager / HR
    participant Mailer as Email & Telegram Service

    Emp->>Portal: Fills Leave Form (LeaveType, Dates, HalfDay Slot, Reason)
    Portal->>LeaveRouter: mutation leave.apply(...)
    LeaveRouter->>DB: Check LeaveBalance for current year
    
    alt Balance Insufficient
        LeaveRouter-->>Portal: Error: Not enough leave balance
    else Balance Available
        LeaveRouter->>DB: Create LeaveRequest with status = PENDING
        LeaveRouter->>Mailer: Send notification email to Manager and Admin
        LeaveRouter-->>Portal: Success: Leave applied
    end

    Mgr->>LeaveRouter: Reviews in Admin Portal (mutation leave.decide)
    alt Approved
        LeaveRouter->>DB: Update LeaveRequest status = APPROVED
        LeaveRouter->>DB: Deduct days from LeaveBalance (used += days, remaining -= days)
        LeaveRouter->>Mailer: Send Approval email & Telegram alert to Employee
    else Rejected
        LeaveRouter->>DB: Update LeaveRequest status = REJECTED
        LeaveRouter->>Mailer: Send Rejection reason to Employee
    end
```

---

## 5. Upcoming Holidays Management Workflow

Holidays ka system multi-date selection allow karta hai. Admin calendar se multiple dates select karke announce karta hai, jo dashboard aur marquee banner par dynamically appear hoti hain.

```mermaid
flowchart LR
    subgraph AdminSection["Admin Portal (/admin-portal/dashboard)"]
        CalendarPicker["MultiDatePicker Component (Single, Multi-Date, Date-Range)"]
        HolidayForm["Announce Holiday Form (Name, Type: PUBLIC/COMPANY/RESTRICTED)"]
        CalendarPicker --> HolidayForm
        HolidayForm --> TRPC_Announce["tRPC holiday.announceMany mutation"]
    end

    subgraph BackendStore["Data Persistence"]
        TRPC_Announce --> WriteJSON["data/holidays.json Storage Engine"]
        WriteJSON --> CacheSort["Sort by Date & Filter Upcoming from Today (IST)"]
    end

    subgraph EmployeeView["Employee Portal (/employee-portal/dashboard)"]
        CacheSort --> TRPC_Upcoming["tRPC holiday.upcoming query"]
        TRPC_Upcoming --> Marquee["Top Nav Gradient Masked Marquee Banner"]
        TRPC_Upcoming --> HolidayWidget["Upcoming Holidays Card Widget (Full List Display)"]
    end
```

---

## 6. Performance & Appraisal Management Workflow

Performance cycle HR create karta hai. Goals assign hote hain, employees self-review karte hain, aur managers rating dete hain.

```mermaid
sequenceDiagram
    autonumber
    actor HR as Admin / HR
    participant Router as tRPC performanceRouter
    participant DB as PostgreSQL
    actor Emp as Employee
    actor Mgr as Manager

    HR->>Router: performance.createCycle (e.g. H1 2026 Appraisal, Start/End Date)
    Router->>DB: Create PerformanceCycle (status: ACTIVE)
    
    HR->>Router: performance.createGoal (Assign Goal & KeyResults to Employee)
    Router->>DB: Save Goal in PerformanceCycle
    
    Emp->>Router: performance.updateGoalProgress (e.g. 75% complete)
    Router->>DB: Update progressPercent
    
    Emp->>Router: performance.submitReview (Self Review: Strengths, Areas of Improvement)
    Router->>DB: Save Review (reviewType: SELF, status: SUBMITTED)
    
    Mgr->>Router: performance.submitReview (Manager Review: Rating 1-5, Comments)
    Router->>DB: Save Review (reviewType: MANAGER, status: SUBMITTED)
    
    HR->>Router: performance.closeCycle
    Router->>DB: Update PerformanceCycle (status: CLOSED)
```

---

## 7. Background Cron Jobs & Automated Automations

Vercel Cron ya Server Daemon se scheduled tasks execute hote hain:

```mermaid
flowchart TD
    CronTrigger([Scheduled Cron Jobs]) --> Choice{Which Cron is triggered?}

    Choice -- "30 13 * * *" (7:00 PM IST) --> AutoPunch["/api/cron/auto-punch-out"]
    AutoPunch --> FindActive["Find all AttendanceLogs with checkInTime != null and checkOutTime == null"]
    FindActive --> SetOut["Auto set checkOutTime = 18:30 IST, calculate totalHours, append notes"]
    SetOut --> LogDone["Update status and log auto punch-out"]

    Choice -- "30 3 * * 1" (Monday 9:00 AM IST) --> BirthdayCron["/api/cron/birthdays"]
    BirthdayCron --> FindBirthdays["Query Employee records for dateOfBirth in current week"]
    FindBirthdays --> SendTGBirthday["Format & Send Weekly Birthday Wishes to Telegram Channel"]

    Choice -- End of Day / On Punch --> SheetCron["/api/cron/sync-google-sheets"]
    SheetCron --> GenSheetData["Generate Daily Attendance Matrix (Name, Code, Status, In, Out, Hours)"]
    GenSheetData --> UploadSheets["Push rows to Google Spreadsheet via Google Service Account"]
```

---

## 8. Monorepo Package Responsibility Summary

| Package / Folder | Purpose | Key Files / Responsibilities |
| :--- | :--- | :--- |
| **`apps/web`** | Next.js 14 Frontend & API Bridge | Pages, Components, NextAuth, Geocoding route, Cron endpoints, Service Worker |
| **`packages/api`** | Business Logic & Routers | 12 domain routers, Geofence calculations, Nodemailer SMTP, Telegram Bot, Google Sheets V4 |
| **`packages/db`** | Database Schema & Client | Prisma ORM, PostgreSQL connection pooling, schema.prisma, Seed scripts |
| **`packages/shared`** | Shared Contracts & Utilities | Zod validation schemas, Role permissions, Date/IST formatters, Constants |
| **`android-app`** | Native Android Packaging | Gradle project, WebView bridge for geolocation permissions, Release keystore |
| **`scripts`** | Tooling & Build Guards | `fix-turbo-permissions.js` (ensures 0755 execute bits on Turbo platform binaries) |
