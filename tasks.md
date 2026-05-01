# Comprehensive Development Roadmap: EduPulse Backend

**CRITICAL NOTE TO CLAUDE:** Read `instructions.md` for general rules, but when executing the tasks below, **PAY STRICT ATTENTION** to the specific database nuances mentioned in the "Implementation Notes" of each task. Do not make assumptions about the schema.

Execute these tasks **ONE BY ONE**. Stop and ask for confirmation after completing each Phase.

---

## Phase 1: Core Setup, Config, and Global Handlers
- [ ] Initialize project with required dependencies: `express`, `telegraf`, `@supabase/supabase-js`, `dotenv`, `cors`, `helmet`, `zod`, `ioredis` (for session).
- [ ] Create `src/config/env.js`. Use Zod to validate `PORT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (must use service role to bypass RLS), and `BOT_TOKEN`.
- [ ] Create `src/config/supabase.js`. Export a reusable Supabase client instance.
- [ ] Implement `src/utils/errors.js` (create `AppError` class with statusCode).
- [ ] Implement `src/middlewares/errorHandler.js` (global Express error handler that prevents server crashes).
- [ ] Setup `src/index.js` with Express, Helmet, CORS, and standard JSON body parsers.

---

## Phase 2: Telegraf Bot Core & Authentication
- [ ] Create `src/bot/bot.js` and initialize the Telegraf instance.
- [ ] Set up Redis session middleware for Telegraf (`telegraf-session-redis` or manual `ioredis` implementation).
- [ ] Create `src/bot/middlewares/auth.bot.js`.
  - **Implementation Note:** When `/start` is pressed, query the `users` table using `ctx.from.id` mapped to `telegram_id`. 
  - **Schema Match Alert:** Check if `is_active === true`. If valid, inject the user object (including `id`, `branch_id`, and `role`) into `ctx.state.user`. If not found, reply "Access Denied".
- [ ] Create a basic composer (`src/bot/composers/teacher.composer.js`) with a simple `/menu` command to test auth.

---

## Phase 3: The "Killer Feature" - Fast Attendance Bot
- [ ] Create `src/bot/scenes/attendance.scene.js` (or handle via action callbacks with Session state).
- [ ] **Step 1:** Command `/attendance`. Query `groups` table where `teacher_id === ctx.state.user.id` AND `status === 'active'`. Send inline keyboard of groups.
- [ ] **Step 2:** Group selected. Query `group_students` joined with `students` to get all active students for this group.
  - **Schema Match Alert:** Filter out students where `students.status != 'active'` or `group_students.left_at` is not null.
- [ ] **Step 3:** Generate the Toggle UI. Store the student list in the Redis session. Default all to `status: 'present'`. Render inline keyboard showing `[Student Name ✅]`.
- [ ] **Step 4:** Handle toggle clicks. Update session state for that student to `absent` (❌). Re-render the inline keyboard.
- [ ] **Step 5:** "Save 💾" button clicked. Perform bulk upsert to the `attendance` table.
  - **Schema Match Alert:** You MUST include `group_id`, `student_id`, `date` (current date localized to GMT+5/Tashkent), `status`, and `recorded_by` (from `ctx.state.user.id`). Handle unique constraint gracefully.

---

## Phase 4: Expense Wizard Bot
- [ ] Create `src/bot/scenes/expense.scene.js` using `Telegraf.Scenes.WizardScene`.
- [ ] **Step 1:** Ask for Amount. Validate input is a valid number.
- [ ] **Step 2:** Fetch active `expense_categories` where `branch_id === ctx.state.user.branch_id`. Render as inline keyboard.
- [ ] **Step 3:** Ask if this is Payroll (Salary) or External. 
  - **Implementation Note:** If Payroll, show list of `users` in that branch to get `employee_id`. If External, ask to type `external_payee` name.
- [ ] **Step 4:** Ask for `description`.
- [ ] **Step 5:** Save to `expenses` table.
  - **Schema Match Alert:** MUST include `branch_id` (from `ctx.state.user.branch_id`), `recorded_by` (from `ctx.state.user.id`), `amount`, `category_id`, and properly set either `employee_id` OR `external_payee` based on Step 3. Set `is_payroll` boolean accordingly.

---

## Phase 5: RESTful APIs (Dashboard Analytics & Finance)
Create routes, controllers, and services for the frontend dashboard. Protect all routes.

- [ ] `GET /api/finance/summary`: 
  - **Logic:** Calculate total revenue (from `payments` where type='payment') minus refunds (from `payments` where type='refund'). Sum all `expenses`. Return Revenue, Expenses, Net Profit for a specific `branch_id` and date range.
- [ ] `GET /api/finance/group-roi/:groupId`: 
  - **Implementation Note (Unit Economics):** Fetch group's `monthly_fee` and `teacher_share_percentage`. Calculate `Total Revenue from Group` - `(Total Revenue * teacher_share_percentage / 100)`. Return the ROI.
- [ ] `POST /api/payments`:
  - **Implementation Note:** Validate body using Zod. MUST include `student_id`, `group_id`, `amount`, `for_month` (YYYY-MM-DD), `payment_method`, and `type` ('payment' or 'refund'). Set `recorded_by` from the auth token.

---

## Phase 6: RESTful APIs (Data Science Feeders)
Endpoints specifically designed for the Python ML microservice to pull aggregated data.

- [ ] `GET /api/ml/churn-features`:
  - **Logic:** For each active student, aggregate: 
    1. Attendance rate (Present / Total classes in last 30 days).
    2. Average assessment score (from `student_assessments`).
    3. Payment delays (if any).
  - Return data in a flat JSON array format suitable for Pandas DataFrames.