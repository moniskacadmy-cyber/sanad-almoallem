# Security Specification for "سند المعلم" (Sanad Al-Moallem)

## 1. Data Invariants
- **Identity Isolation**: All teacher subcollections (`students`, `lessons`, `schedules`, `library`, `reminders`, `tasks`) strictly belong to `teacherId == request.auth.uid`. No teacher can access or modify another teacher's data.
- **Admin Privilege & RBAC**: Admin access is verified by checking the user's UID in the `/admins/{uid}` collection. Any email-based emergency exception strictly requires `request.auth.token.email_verified == true`.
- **Subscription Write Lock**: Subcollection modifications (`create`, `update`, `delete`) on `students`, `lessons`, `schedules`, `library`, `reminders`, and `tasks` strictly require an active teacher subscription (`subscriptionExpiresAt > request.time`) or admin privilege.
- **Data Export Guarantee**: Read operations (`get`, `list`) remain accessible to the data owner even if the subscription expires, allowing teachers to review and export their data.
- **Immortal Fields**: Once a teacher profile is created, the fields `id`, `email`, `createdAt`, `trialStartDate`, and `trialEndDate` cannot be modified by the teacher.
- **Server Timestamp Enforced**: Creation of teacher account must enforce `request.resource.data.trialStartDate == request.time` and `request.resource.data.trialEndDate == request.time + duration(7, 'd')` or verified server timestamps to prevent trial bypass.
- **Subscription Tampering Protection**: Teachers cannot promote their own `role` or change their `subscriptionStatus`, `plan`, or `subscriptionExpiresAt`. These fields can only be modified by an Admin.
- **Type and Length Boundaries**: All text fields, IDs, phone numbers, and numbers must satisfy strict character limits and regex constraints.

## 2. The Dirty Dozen Malicious Payloads

1. **Self-Admin Escalation**:
   `POST /teachers/{uid}` with `{ role: "admin" }` by an unprivileged teacher. -> REJECTED.
2. **Subscription Bypass / Date Forgery**:
   `PUT /teachers/{uid}` with `{ subscriptionStatus: "active", subscriptionExpiresAt: "2099-01-01" }`. -> REJECTED.
3. **Ghost / Shadow Fields Insertion**:
   `PUT /teachers/{uid}` with `{ unauthorizedBackdoor: true }`. -> REJECTED.
4. **Cross-Teacher Student Snoop**:
   `GET /teachers/{otherUid}/students/{studentId}` by a non-admin teacher. -> REJECTED.
5. **Cross-Teacher Student Insertion**:
   `POST /teachers/{otherUid}/students/` by a non-admin teacher. -> REJECTED.
6. **Denial-of-Wallet Long Payload**:
   `POST /teachers/{uid}/students/` with 500KB text in student name. -> REJECTED (max 100 chars).
7. **Invalid ID Path Variable Injection**:
   `POST /teachers/{uid}/students/malicious..path??` -> REJECTED (regex guard).
8. **Trial Extension Fraud**:
   `PUT /teachers/{uid}` with `{ trialEndDate: "2030-01-01" }`. -> REJECTED.
9. **Unauthenticated Read of Teacher PII**:
   `GET /teachers/{uid}` by anonymous unauthenticated user. -> REJECTED.
10. **Direct Admin Document Write**:
    `POST /admins/{uid}` by non-admin authenticated user trying to make himself admin. -> REJECTED.
11. **Expired Subscription Write Attempt**:
    `POST /teachers/{uid}/students/` when `subscriptionExpiresAt < request.time`. -> REJECTED (subscription expired).
12. **Unverified Email Admin Spoofing**:
    Attempting admin access via email claim without `email_verified == true`. -> REJECTED.
