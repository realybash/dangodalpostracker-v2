# Security Specification: Dan Godal POS Tracker

## 1. Data Invariants
- A **Transaction** must belong to an `ownerId` (Manager) and have a `cashierId` (Employee).
- An **Expense** must be linked to a valid `ownerId`.
- A **PosTerminal** must be linked to a valid `ownerId`.
- A **User** document ID must match the `request.auth.uid`.
- **Settings** are only modifiable by the Manager (`ownerId`).
- **PricingRules** are only modifiable by Managers.

## 2. The "Dirty Dozen" Payloads
1. **Identity Spoofing**: Attempt to create a transaction with `cashierId` set to another user's UID.
2. **State Shortcutting**: Attempt to update a transaction status from `Pending` to `Success` directly without following the protocol.
3. **Ghost Fields**: Attempt to add an `isVerified: true` field to a User document.
4. **ID Poisoning**: Attempt to use a 1.5KB string as a `transactionId`.
5. **PII Leak**: Attempt to list all users in the `users` collection as a non-manager.
6. **Immutable Field Mutation**: Attempt to change the `createdAt` timestamp of a transaction.
7. **Negative Amount**: Attempt to create a transaction with a negative `amount`.
8. **Unverified Email**: Attempt to write as a user whose email is not verified.
9. **Orphaned Record**: Attempt to create a transaction for an `ownerId` that does not exist.
10. **Admin Escalation**: Attempt to set `role: 'Manager'` on a new user document without being an admin.
11. **Bulk Delete Attack**: Attempt to delete all transactions of another manager.
12. **Settings Hijack**: Attempt to update another manager's charge configurations.

## 3. Test Cases (Summary)
- `users/{userId}`: `list` must be restricted to authenticated users matching their own ID or Managers.
- `transactions/{id}`: `create` must validate all fields against `isValidTransaction()`.
- `pos_terminals/{id}`: `update` must be restricted to owners.
- `pricing_rules/{id}`: `write` must require `isManager()`.
