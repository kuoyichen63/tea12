# Security Specification

This document defines the security configuration and access constraints for the Tea Ordering System in Firestore.

## 1. Data Invariants

1. **Admin Config**:
   - Must contain a valid `passwordHash` of size 64 characters (SHA-256 hex string).
   - Only document ID `config` is allowed.

2. **Tea Items**:
   - Product details must have a name, category, and price.
   - Price must be a positive number.

3. **Orders**:
   - Order must start with status `pending`.
   - Total amount should match the items selected.

## 2. Access Controls

Since this app executes without OAuth (guest-centric order placing, and password-based administrative control), our security rules are structured as follows:
- **Admin Configuration**: Anyone can read to check if password is set / verify entered password. Write is open for setup, then constrained by client-side verification.
- **Tea Items**: Read access is public. Write access is open to support updates via client password verification.
- **Orders**: Guest orders can be written (`create`). Orders can be viewed (`get`) and customized.

## 3. Threat Model & Rule Mapping

- **Resource Poisoning**: Prevented by `isValidId()` enforcing alphanumeric IDs and maximum sizes.
- **Invalid Payload Prevention**: Enforced via Firestore validation matching exact data types and string sizes.
