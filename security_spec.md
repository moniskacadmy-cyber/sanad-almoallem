# Security Specification for "سند المعلم" (Sanad Al-Moallem)

## 1. Data Invariants
- **Identity Isolation**: All teacher subcollections (`students`, `lessons`, `schedules`, `library`) strictly belong to `teacherId == request.auth.uid`. No teacher can access or modify another teacher's data.
- **Admin Privilege**: An authenticated user whose UID exists in `/admins/{uid}` has system-wide permissions to inspect teacher profiles, activate subscriptions, reset trials, and delete accounts.
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
11. **Client Clock Spoofing on Create**:
    `POST /teachers/{uid}` with `trialStartDate: 1970-01-01` or future dates not equal to `request.time`. -> REJECTED.
12. **Malformed Class Type Enum Injection**:
    `POST /teachers/{uid}/students/` with `{ classType: "hacked_unlimited" }`. -> REJECTED.
