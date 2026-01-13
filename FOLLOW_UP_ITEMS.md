# Follow-Up Items for AuxLink E2EE Messenger

This document tracks deferred tasks and technical debt items that need to be addressed in future development phases.

## Phase 1 Deferred Items

### Security & Cryptography (Phase 3)

**Identity Keys & Signal Protocol**
- [ ] Implement Signal Protocol key generation (identity keys, signed pre-keys)
- [ ] Populate `identity_key_public` and `signed_pre_key` fields in device registration
- [ ] Add key rotation mechanism for signed pre-keys
- [ ] Implement one-time pre-keys for forward secrecy
- [ ] Add key verification UI for security codes

**Current State:**
- `identity_key_public` and `signed_pre_key` fields are nullable in the database
- Device registration works without these fields
- Will be populated in Phase 3 when implementing Signal Protocol

### Database & Storage

**Cascade Delete Testing**
- [ ] Comprehensive testing of cascade deletes across all relationships
- [ ] Verify orphaned records are handled correctly
- [ ] Add database migration tests

**Current State:**
- Schema has cascade delete rules defined
- Basic functionality tested manually in Drizzle Studio
- Need automated tests for edge cases

**Device ID Cleanup**
- [ ] Decide on strategy for orphaned device IDs in secure storage
- [ ] Add device ID cleanup on user logout (optional)
- [ ] Consider adding "Sign out of all devices" feature

**Current State:**
- Orphaned device IDs are acceptable for Phase 1
- Device IDs persist even after device deletion from database
- Works correctly but could be cleaner

### API & Backend

**Rate Limiting**
- [ ] Add rate limiting to device registration endpoint
- [ ] Implement rate limiting for message sending (Phase 4)
- [ ] Add IP-based rate limiting for auth endpoints

**Current State:**
- No rate limiting implemented
- Acceptable for development/testing
- Critical for production deployment

**Device Management Features**
- [ ] Add "last seen" indicator in UI
- [ ] Add device nickname/rename functionality
- [ ] Add "revoke device access" feature
- [ ] Show device platform icons in device list

**Current State:**
- Basic device CRUD operations implemented
- Device names auto-generated but not editable
- No UI for viewing device list yet (Settings page placeholder)

### Testing & Quality Assurance

**Automated Tests**
- [ ] Unit tests for device router endpoints
- [ ] Integration tests for device registration flow
- [ ] E2E tests for mobile and TUI device registration
- [ ] Database migration tests

**Current State:**
- Manual testing completed successfully
- No automated test suite
- All critical paths tested manually

**Edge Cases**
- [ ] Test device registration with network interruptions
- [ ] Test concurrent device registrations
- [ ] Test device limit enforcement (if we add limits)
- [ ] Test behavior with corrupt device ID in storage

**Current State:**
- Basic offline behavior tested
- Most edge cases deferred for future testing

### Mobile App (React Native)

**Device Info Enhancement**
- [ ] Use more detailed device info (model name, OS version specifics)
- [ ] Handle device info retrieval errors more gracefully
- [ ] Add device emoji/icon based on type (📱 for mobile, 💻 for desktop)

**Current State:**
- Basic device info captured from `expo-device`
- Auto-generated names are functional but basic

**Storage Security**
- [ ] Review expo-secure-store security guarantees
- [ ] Consider biometric protection for device ID access
- [ ] Add device ID backup/recovery mechanism

**Current State:**
- Using expo-secure-store for device ID storage
- Sufficient for Phase 1, may need enhancement for production

### TUI App

**Device Storage Location**
- [ ] Consider XDG Base Directory specification for config storage
- [ ] Add fallback if `~/.auxlink` directory creation fails
- [ ] Add device ID file encryption (optional)

**Current State:**
- Device ID stored at `~/.auxlink/device-id`
- Plain text file (acceptable since it's a UUID, not sensitive data)
- Works on Linux/macOS, may need Windows path adjustment

**User Experience**
- [ ] Add device management UI in TUI settings
- [ ] Show device registration status on startup
- [ ] Add "this device" indicator in device list

**Current State:**
- Device registration is silent/automatic
- No UI for managing devices yet (Phase 2+)

## Phase 2 Considerations

These items should be reviewed when starting Phase 2 (Device Pairing):

- [ ] Review `device_pairing` table schema before implementation
- [ ] Decide on pairing expiry time (currently 5 minutes in schema)
- [ ] Plan QR code generation and scanning libraries
- [ ] Design pairing flow UX for mobile and TUI

## Phase 3+ Considerations

**Signal Protocol Implementation:**
- [ ] Choose Signal Protocol library (libsignal-protocol-typescript, etc.)
- [ ] Design key storage strategy
- [ ] Plan key distribution mechanism
- [ ] Implement Double Ratchet algorithm

**Message Encryption:**
- [ ] Design message payload format
- [ ] Implement message encryption/decryption
- [ ] Add message authentication (MAC)
- [ ] Handle key exchange failures

## Production Readiness Checklist

Before production deployment, address:

- [ ] Add comprehensive error handling and logging
- [ ] Implement rate limiting and abuse prevention
- [ ] Add monitoring and alerting
- [ ] Security audit of authentication flow
- [ ] Performance testing under load
- [ ] Database backup and recovery procedures
- [ ] API versioning strategy
- [ ] GDPR compliance (user data deletion, export)

## Notes

- This document should be reviewed and updated at the start of each development phase
- Items can be promoted to active development or removed if no longer relevant
- Add new items as technical debt is identified during development

---

**Last Updated:** Phase 1 Completion - January 13, 2026
