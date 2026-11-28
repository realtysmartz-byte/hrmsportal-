# Strict Workspace Rule: Database Mutations Policy

**CRITICAL RULE - NEVER MODIFY DATABASE DATA MANUALLY OR DIRECTLY**
- **Do NOT** execute direct Prisma scripts, SQL mutations, or updates on the database records (e.g. employee status, resignation, personal info, attendance records, leaves, etc.) unless the user explicitly commands it in words.
- All database modifications (resigning employees, updating roles, changing statuses, etc.) are performed **MANUALLY by the user / admin**.
- The AI assistant must only implement changes via **code logic, business rules, queries, and UI components** (e.g. filtering out roles/designations in queries, conditional rendering, validation schemas).
- **Never mutate, delete, or alter database rows automatically** without an explicit, direct instruction from the user.
