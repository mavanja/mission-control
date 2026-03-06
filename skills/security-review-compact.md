---
name: security-review-compact
description: Compact security review — checklists only, no code snippets.
---

# Security Review (Compact)

## Pre-Commit Checklist

### Secrets Management
- [ ] No hardcoded API keys, tokens, or passwords
- [ ] All secrets via `process.env.*`
- [ ] `.env.local` in .gitignore
- [ ] Verify secrets exist at startup (`if (!key) throw ...`)

### Input Validation
- [ ] All user inputs validated with Zod schemas
- [ ] File uploads restricted (size, type, extension)
- [ ] Whitelist validation (not blacklist)
- [ ] Error messages don't leak internals

### SQL Injection
- [ ] All queries use parameterized queries / prepared statements
- [ ] No string concatenation in SQL

### Authentication & Authorization
- [ ] Tokens in httpOnly cookies (not localStorage)
- [ ] Authorization checks before sensitive operations
- [ ] Role-based access control in place

### XSS Prevention
- [ ] User-provided HTML sanitized (DOMPurify)
- [ ] CSP headers configured
- [ ] No unvalidated dangerouslySetInnerHTML

### CSRF & Rate Limiting
- [ ] CSRF tokens on state-changing operations
- [ ] SameSite=Strict on cookies
- [ ] Rate limiting on all API endpoints
- [ ] Stricter limits on expensive operations (search, auth)

### Data Exposure
- [ ] No passwords/tokens/secrets in logs
- [ ] Generic error messages for users, detailed in server logs
- [ ] No stack traces exposed to clients

### Dependencies
- [ ] `npm audit` clean
- [ ] Lock files committed
- [ ] No known vulnerabilities
