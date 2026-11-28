# Workspace Guidelines: Realty HRMS Portal

## Database Policy (Strict Instruction from User)
- **NEVER directly mutate or alter database rows (via Prisma scripts, SQL queries, or manual update calls) without explicit user permission.**
- The user/admin manages database records (such as employee status, resignations, role changes) manually.
- All application requirements (e.g., hiding admins or inactive staff from performance views) must be solved strictly through **application code, API filters, and UI logic**, never by mutating database records directly.
