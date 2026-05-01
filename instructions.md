# EduPulse — System Architecture & Development Instructions

## Table of Contents
1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Database Schema Context](#database-schema-context)
5. [Project Structure](#project-structure)
6. [Coding Standards & Conventions](#coding-standards--conventions)
7. [Security Architecture](#security-architecture)
8. [Performance Optimization](#performance-optimization)
9. [Error Handling Strategy](#error-handling-strategy)
10. [API Design Patterns](#api-design-patterns)

---

## Project Overview

**EduPulse** is a high-performance EdTech CRM with integrated predictive analytics. The system serves as a unified platform for:
- **Teachers**: Ultra-fast attendance tracking via Telegram
- **Staff**: Daily expense logging and financial management
- **Administrators**: Real-time analytics, unit economics, and churn prediction
- **Data Scientists**: Access to aggregated historical data for ML models

### Core Value Propositions
- Sub-second attendance recording with toggle-based UX
- Automated unit economics calculation per group
- Predictive churn analysis using logistic regression
- Real-time financial dashboards with revenue forecasting

---

## System Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                            │
├─────────────────────────┬───────────────────────────────────┤
│   Telegram Bot UI       │      Next.js Dashboard            │
│   (Telegraf.js)         │      (Web Interface)              │
└──────────┬──────────────┴─────────────┬─────────────────────┘
           │                            │
           │ Bot Commands               │ HTTP/REST
           │ Inline Callbacks           │ (CORS Protected)
           ▼                            ▼
┌──────────────────────────────────────────────────────────────┐
│              NODE.JS EXPRESS BACKEND (Port 3000)             │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  API Layer                                             │  │
│  │  ├─ Auth Middleware (API Key, Telegram ID)            │  │
│  │  ├─ Validation Layer (Zod Schemas)                    │  │
│  │  ├─ Rate Limiting (express-rate-limit)                │  │
│  │  └─ CORS (Restricted Origins)                         │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Business Logic Layer                                  │  │
│  │  ├─ Controllers (Request Handlers)                    │  │
│  │  ├─ Services (Business Logic)                         │  │
│  │  └─ Utilities (Helpers, Formatters)                   │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Telegram Bot (Telegraf.js)                           │  │
│  │  ├─ Scenes (Wizards for Attendance, Expenses)         │  │
│  │  ├─ Composers (Reusable Command Groups)               │  │
│  │  └─ Session Management (Redis)                        │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────┬──────────────────────┬─────────────────────┘
                  │                      │
                  │ Supabase Client      │ HTTP (API Key Auth)
                  ▼                      ▼
        ┌──────────────────┐   ┌─────────────────────┐
        │  Supabase/       │   │  Python ML Service  │
        │  PostgreSQL      │   │  (Data Science)     │
        │  (Primary DB)    │   │  ├─ Pandas          │
        └──────────────────┘   │  ├─ Scikit-learn    │
                               │  └─ Prophet/ARIMA   │
                               └─────────────────────┘
        ┌──────────────────┐
        │  Redis           │
        │  (Session Cache) │
        └──────────────────┘
```

### Data Flow Examples

#### 1. Attendance Recording Flow
```
Teacher (Telegram) → Bot Command `/attendance`
  → Fetch Students for Group (Supabase)
  → Generate Toggle Keyboard (all ✅)
  → User Toggles (cached in Redis session)
  → "Save" Callback → Bulk Upsert `attendance` table
  → Confirmation Message + Summary
```

#### 2. Unit Economics Calculation Flow
```
Next.js Dashboard → GET /api/analytics/group-roi?group_id=X
  → Auth Middleware (CORS + API Key)
  → Service Layer: Aggregate payments, teacher shares, costs
  → Calculate: Revenue - (Teacher Share + Fixed Costs)
  → Return JSON with ROI metrics
```

#### 3. ML Data Feed Flow
```
Python Service → GET /api/ml/student-features?student_id=X
  → API Key Validation
  → Service Layer: Join attendance, payments, assessments
  → Aggregate: attendance_rate_30d, avg_score, payment_delay
  → Return DataFrame-ready JSON
```

---

## Technology Stack

### Backend (Node.js)
- **Runtime**: Node.js v20+ (LTS)
- **Framework**: Express.js v4.18+
- **TypeScript**: v5+ (Strict mode)
- **Database Client**: `@supabase/supabase-js` v2+
- **Bot Framework**: `telegraf` v4.16+
- **Session Store**: `ioredis` v5+ (Redis client)
- **Validation**: `zod` v3.22+
- **Security**: 
  - `helmet` v7+ (Security headers)
  - `cors` v2.8+ (Cross-origin control)
  - `express-rate-limit` v7+
- **Environment**: `dotenv` v16+

### Frontend (Next.js)
- **Framework**: Next.js 14+ (App Router)
- **UI Components**: shadcn/ui + Tailwind CSS
- **Charts**: Recharts or Chart.js
- **State Management**: Zustand or React Query

### Data Science (Python)
- **Framework**: FastAPI or Flask
- **ML Libraries**: scikit-learn, pandas, numpy
- **Forecasting**: Prophet, statsmodels (ARIMA)

### Infrastructure
- **Database**: Supabase (PostgreSQL 15+)
- **Cache**: Redis 7+
- **Hosting**: Vercel (Next.js), Railway/Render (Node.js)

---

## Database Schema Context

-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  date date DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now(),
  recorded_by uuid,
  student_id uuid,
  status USER-DEFINED NOT NULL,
  group_id uuid,
  CONSTRAINT attendance_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id),
  CONSTRAINT attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT attendance_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id)
);
CREATE TABLE public.branches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  address text,
  name character varying NOT NULL,
  CONSTRAINT branches_pkey PRIMARY KEY (id)
);
CREATE TABLE public.expense_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  expense_type USER-DEFINED DEFAULT 'variable'::expense_type,
  is_active boolean DEFAULT true,
  branch_id uuid,
  budget_limit numeric,
  name character varying NOT NULL,
  CONSTRAINT expense_categories_pkey PRIMARY KEY (id),
  CONSTRAINT expense_categories_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id)
);
CREATE TABLE public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  is_payroll boolean DEFAULT false,
  date date DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now(),
  category_id uuid,
  recorded_by uuid,
  external_payee character varying,
  amount numeric NOT NULL,
  employee_id uuid,
  branch_id uuid,
  description text,
  CONSTRAINT expenses_pkey PRIMARY KEY (id),
  CONSTRAINT expenses_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT expenses_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.expense_categories(id),
  CONSTRAINT expenses_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id),
  CONSTRAINT expenses_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.users(id)
);
CREATE TABLE public.group_students (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  joined_at timestamp with time zone DEFAULT now(),
  left_at timestamp with time zone,
  agreed_fee numeric NOT NULL,
  student_id uuid,
  group_id uuid,
  CONSTRAINT group_students_pkey PRIMARY KEY (id),
  CONSTRAINT group_students_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id),
  CONSTRAINT group_students_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
);
CREATE TABLE public.groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  teacher_share_percentage integer DEFAULT 0,
  status USER-DEFINED DEFAULT 'active'::group_status,
  created_at timestamp with time zone DEFAULT now(),
  monthly_fee numeric NOT NULL,
  teacher_id uuid,
  subject character varying NOT NULL,
  branch_id uuid,
  schedule_info character varying,
  CONSTRAINT groups_pkey PRIMARY KEY (id),
  CONSTRAINT groups_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT groups_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.users(id)
);
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type USER-DEFINED DEFAULT 'payment'::payment_type,
  payment_method USER-DEFINED DEFAULT 'cash'::pay_method,
  paid_at timestamp with time zone DEFAULT now(),
  student_id uuid,
  recorded_by uuid,
  group_id uuid,
  amount numeric NOT NULL,
  for_month date NOT NULL,
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT payments_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id),
  CONSTRAINT payments_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id)
);
CREATE TABLE public.student_assessments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  recorded_by uuid,
  group_id uuid,
  notes text,
  max_score numeric NOT NULL,
  date date NOT NULL,
  score numeric NOT NULL,
  assessment_type character varying,
  student_id uuid,
  CONSTRAINT student_assessments_pkey PRIMARY KEY (id),
  CONSTRAINT student_assessments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT student_assessments_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id),
  CONSTRAINT student_assessments_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id)
);
CREATE TABLE public.students (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  status USER-DEFINED DEFAULT 'lead'::student_status,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  branch_id uuid,
  lead_source character varying,
  full_name character varying NOT NULL,
  phone_number character varying,
  CONSTRAINT students_pkey PRIMARY KEY (id),
  CONSTRAINT students_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  role USER-DEFINED DEFAULT 'teacher'::user_role,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  branch_id uuid,
  telegram_id bigint UNIQUE,
  full_name character varying NOT NULL,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id)
);
---

## Project Structure

```
edupulse-backend/
├── src/
│   ├── index.ts                    # Application entry point
│   ├── config/
│   │   ├── database.ts             # Supabase client initialization
│   │   ├── redis.ts                # Redis client configuration
│   │   ├── environment.ts          # Environment variable validation (Zod)
│   │   └── constants.ts            # App-wide constants
│   ├── middlewares/
│   │   ├── auth.middleware.ts      # API key + Telegram ID auth
│   │   ├── validation.middleware.ts # Zod schema validation
│   │   ├── rateLimiter.middleware.ts
│   │   ├── errorHandler.middleware.ts # Global error handler
│   │   └── logger.middleware.ts    # Request/response logging
│   ├── routes/
│   │   ├── index.ts                # Route aggregator
│   │   ├── analytics.routes.ts     # /api/analytics/*
│   │   ├── students.routes.ts      # /api/students/*
│   │   ├── groups.routes.ts        # /api/groups/*
│   │   ├── payments.routes.ts      # /api/payments/*
│   │   ├── expenses.routes.ts      # /api/expenses/*
│   │   └── ml.routes.ts            # /api/ml/* (Data Science feed)
│   ├── controllers/
│   │   ├── analytics.controller.ts
│   │   ├── students.controller.ts
│   │   ├── groups.controller.ts
│   │   ├── payments.controller.ts
│   │   ├── expenses.controller.ts
│   │   └── ml.controller.ts
│   ├── services/
│   │   ├── analytics.service.ts    # Business logic for calculations
│   │   ├── students.service.ts
│   │   ├── groups.service.ts
│   │   ├── payments.service.ts
│   │   ├── expenses.service.ts
│   │   └── ml.service.ts           # Data aggregation for ML
│   ├── bot/
│   │   ├── index.ts                # Telegraf bot initialization
│   │   ├── middlewares/
│   │   │   ├── auth.bot.ts         # Telegram ID → User lookup
│   │   │   └── session.bot.ts      # Redis session management
│   │   ├── scenes/
│   │   │   ├── attendance.scene.ts # Attendance wizard
│   │   │   └── expense.scene.ts    # Expense logging wizard
│   │   ├── composers/
│   │   │   ├── teacher.composer.ts # Teacher-specific commands
│   │   │   └── staff.composer.ts   # Staff-specific commands
│   │   └── utils/
│   │       ├── keyboards.ts        # Inline keyboard builders
│   │       └── formatters.ts       # Message formatters
│   ├── types/
│   │   ├── express.d.ts            # Extend Express Request type
│   │   ├── database.types.ts       # Supabase generated types
│   │   └── bot.types.ts            # Telegraf session types
│   ├── schemas/
│   │   ├── analytics.schemas.ts    # Zod validation schemas
│   │   ├── students.schemas.ts
│   │   ├── payments.schemas.ts
│   │   └── expenses.schemas.ts
│   └── utils/
│       ├── errors.ts               # Custom error classes
│       ├── logger.ts               # Winston/Pino logger
│       ├── cache.ts                # Redis cache helpers
│       └── validators.ts           # Reusable validation utilities
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## Coding Standards & Conventions

### TypeScript Strict Mode
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### Naming Conventions

1. **Files**: `kebab-case.ts` (e.g., `analytics.service.ts`)
2. **Classes**: `PascalCase` (e.g., `AnalyticsService`)
3. **Functions/Variables**: `camelCase` (e.g., `calculateGroupROI`)
4. **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRY_ATTEMPTS`)
5. **Interfaces/Types**: `PascalCase` with descriptive names (e.g., `GroupROIResponse`)
6. **Enums**: `PascalCase` for enum, `UPPER_SNAKE_CASE` for values

### Code Organization Principles

1. **Single Responsibility**: Each module does ONE thing well
2. **Dependency Injection**: Pass dependencies explicitly (e.g., Supabase client to services)
3. **Async/Await**: Always use `async/await`, never callbacks or raw Promises
4. **Error Handling**: Use try-catch in controllers, throw custom errors in services

### Example Service Pattern
```typescript
// services/analytics.service.ts
import { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../utils/errors';

export class AnalyticsService {
  constructor(private supabase: SupabaseClient) {}

  async calculateGroupROI(groupId: string): Promise<GroupROIData> {
    try {
      // 1. Fetch group details with teacher info
      const { data: group, error: groupError } = await this.supabase
        .from('groups')
        .select('*, teacher:users!teacher_id(full_name), branch:branches!branch_id(monthly_fixed_cost)')
        .eq('id', groupId)
        .single();

      if (groupError) throw new AppError(groupError.message, 404);

      // 2. Aggregate payments for this group
      const { data: payments, error: payError } = await this.supabase
        .from('payments')
        .select('amount')
        .eq('group_id', groupId);

      if (payError) throw new AppError(payError.message, 500);

      const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
      const teacherShare = totalRevenue * (group.teacher_share_percentage / 100);
      const fixedCostShare = group.branch.monthly_fixed_cost / 10; // Example allocation

      return {
        groupId,
        groupName: group.name,
        totalRevenue,
        teacherShare,
        fixedCosts: fixedCostShare,
        netProfit: totalRevenue - teacherShare - fixedCostShare
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to calculate ROI', 500);
    }
  }
}
```

---

## Security Architecture

### 1. Authentication Layers

#### Telegram Bot Authentication
```typescript
// bot/middlewares/auth.bot.ts
export const authenticateTelegramUser = async (ctx: Context, next: () => Promise<void>) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return ctx.reply('Authentication failed');

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId)
    .single();

  if (!user || !user.is_active) {
    return ctx.reply('You are not authorized to use this bot');
  }

  ctx.state.user = user; // Attach to context
  await next();
};
```

#### API Key Authentication (for Python ML Service)
```typescript
// middlewares/auth.middleware.ts
export const authenticateAPIKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== process.env.ML_SERVICE_API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
};
```

### 2. CORS Configuration
```typescript
// index.ts
import cors from 'cors';

const corsOptions = {
  origin: [
    process.env.NEXTJS_FRONTEND_URL, // https://dashboard.edupulse.com
    'http://localhost:3001' // Development
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
```

### 3. Rate Limiting
```typescript
// middlewares/rateLimiter.middleware.ts
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

export const mlApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // ML endpoints are resource-intensive
  message: 'Rate limit exceeded for ML API'
});
```

### 4. Security Headers (Helmet)
```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### 5. Input Validation (Zod)
```typescript
// schemas/analytics.schemas.ts
import { z } from 'zod';

export const groupROIQuerySchema = z.object({
  group_id: z.string().uuid('Invalid group ID format'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

// Usage in route
app.get('/api/analytics/group-roi', 
  validate(groupROIQuerySchema, 'query'),
  analyticsController.getGroupROI
);
```

---

## Performance Optimization

### 1. Database Query Optimization

#### ❌ Anti-Pattern: N+1 Queries
```typescript
// BAD: Makes N queries for N students
const students = await supabase.from('students').select('*');
for (const student of students.data) {
  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('student_id', student.id);
}
```

#### ✅ Best Practice: Single Query with Joins
```typescript
// GOOD: Single query with nested select
const { data: students } = await supabase
  .from('students')
  .select(`
    *,
    payments(*),
    user:users!user_id(full_name, telegram_id),
    groups:group_students(
      group:groups(name, teacher:users!teacher_id(full_name))
    )
  `)
  .eq('status', 'active');
```

### 2. Redis Caching Strategy

```typescript
// utils/cache.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export const cacheWrapper = async <T>(
  key: string,
  ttl: number,
  fetchFn: () => Promise<T>
): Promise<T> => {
  // Try cache first
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as T;

  // Fetch from source
  const data = await fetchFn();
  await redis.setex(key, ttl, JSON.stringify(data));
  return data;
};

// Usage
const groupData = await cacheWrapper(
  `group:${groupId}`,
  300, // 5 minutes
  () => supabase.from('groups').select('*').eq('id', groupId).single()
);
```

### 3. Bulk Operations for Attendance

```typescript
// services/attendance.service.ts
async bulkUpsertAttendance(records: AttendanceRecord[]): Promise<void> {
  const { error } = await this.supabase
    .from('attendance')
    .upsert(records, {
      onConflict: 'group_id,student_id,date',
      ignoreDuplicates: false
    });

  if (error) throw new AppError('Bulk upsert failed', 500);
}
```

### 4. Connection Pooling
```typescript
// config/database.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!, // Server-side key
  {
    auth: { persistSession: false },
    db: { schema: 'public' },
    global: {
      headers: {
        'x-application-name': 'edupulse-backend'
      }
    }
  }
);
```

---

## Error Handling Strategy

### 1. Custom Error Classes
```typescript
// utils/errors.ts
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}
```

### 2. Global Error Handler Middleware
```typescript
// middlewares/errorHandler.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    logger.error({
      message: err.message,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method
    });

    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message
    });
  }

  // Unknown errors - don't leak details
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path
  });

  res.status(500).json({
    status: 'error',
    message: 'Internal server error'
  });
};
```

### 3. Async Error Wrapper
```typescript
// utils/asyncHandler.ts
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Usage in controllers
export const getGroupROI = asyncHandler(async (req: Request, res: Response) => {
  const { group_id } = req.query;
  const data = await analyticsService.calculateGroupROI(group_id as string);
  res.json({ status: 'success', data });
});
```

---

## API Design Patterns

### 1. Response Structure
```typescript
// All successful responses follow this structure
{
  "status": "success",
  "data": { /* actual payload */ },
  "meta": { // Optional
    "page": 1,
    "total": 100,
    "per_page": 20
  }
}

// Error responses
{
  "status": "error",
  "message": "Descriptive error message",
  "errors": [ // Optional, for validation errors
    { "field": "email", "message": "Invalid email format" }
  ]
}
```

### 2. RESTful Endpoint Naming
```
GET    /api/students              # List all students
GET    /api/students/:id          # Get student by ID
POST   /api/students              # Create new student
PUT    /api/students/:id          # Update student
DELETE /api/students/:id          # Delete student

GET    /api/analytics/group-roi?group_id=X  # Analytics (query params)
GET    /api/ml/student-features/:student_id # ML data feed
POST   /api/attendance/bulk       # Bulk operations
```

### 3. Pagination Pattern
```typescript
// controllers/students.controller.ts
export const listStudents = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const perPage = parseInt(req.query.per_page as string) || 20;
  const offset = (page - 1) * perPage;

  const { data: students, count } = await supabase
    .from('students')
    .select('*, user:users!user_id(full_name)', { count: 'exact' })
    .range(offset, offset + perPage - 1);

  res.json({
    status: 'success',
    data: students,
    meta: {
      page,
      per_page: perPage,
      total: count,
      total_pages: Math.ceil(count / perPage)
    }
  });
});
```

---

## Environment Variables Template

```bash
# .env.example

# Application
NODE_ENV=development
PORT=3000
API_VERSION=v1

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password

# Telegram Bot
TELEGRAM_BOT_TOKEN=your-bot-token-from-botfather

# Security
ML_SERVICE_API_KEY=generate-a-strong-random-key
JWT_SECRET=another-strong-secret

# Frontend
NEXTJS_FRONTEND_URL=https://dashboard.edupulse.com

# Logging
LOG_LEVEL=info
```

---

## Development Workflow

1. **Branch Strategy**: 
   - `main` → Production
   - `develop` → Integration branch
   - `feature/*` → New features
   - `fix/*` → Bug fixes

2. **Commit Messages**: Follow Conventional Commits
   - `feat: add bulk attendance upsert`
   - `fix: resolve N+1 query in student list`
   - `refactor: extract ROI calculation to service layer`

3. **Testing**:
   - Unit tests for services (Jest)
   - Integration tests for API endpoints (Supertest)
   - E2E tests for bot flows (Telegraf Test)

4. **Code Review Checklist**:
   - [ ] All inputs validated with Zod
   - [ ] Errors handled with custom error classes
   - [ ] No N+1 queries
   - [ ] Sensitive data not logged
   - [ ] TypeScript strict mode passes
   - [ ] Tests cover new functionality

---

## Performance Benchmarks

- **Attendance Save**: < 500ms for 30 students (bulk upsert)
- **Group ROI Calculation**: < 200ms (with caching)
- **Student List API**: < 300ms for 100 records
- **ML Data Feed**: < 1s for 90-day aggregation

---

## Security Audit Checklist

- [ ] All routes protected by authentication
- [ ] CORS restricted to known origins
- [ ] Rate limiting on all public endpoints
- [ ] No SQL injection vulnerabilities (Supabase client handles escaping)
- [ ] No sensitive data in logs
- [ ] Environment variables never committed
- [ ] API keys rotated regularly
- [ ] HTTPS enforced in production

---

**Document Version**: 1.0  
**Last Updated**: 2024-01-15  
**Maintained By**: EduPulse Development Team
