# 16 — Release Checklist (Region 63 Launch Gate)

This is a gate, not a guideline. Every unchecked item is a launch blocker unless the product lead and regional admin jointly sign a written exception. Sections marked ✧ apply when the corresponding V2 features ship (community, parents) and are included now so the gate for those releases already exists.

## Security

- [ ] Authentication review: password hashing (argon2/bcrypt), OTP rate limiting, brute-force lockouts, session rotation and revocation verified (`15-technical-architecture.md`).
- [ ] Tokens in HTTP-only Secure cookies; no credentials or tokens in localStorage; CSRF protection verified.
- [ ] RBAC/scope enforcement tested server-side: attempt matrix of every role against out-of-scope resources returns 403 (automated test suite, run against ≥2 seeded regions).
- [ ] OWASP pass: injection, XSS (strict CSP live), IDOR sweep on all ID-bearing endpoints, SSRF on any fetch-by-URL admin features.
- [ ] Dependency and container vulnerability scan clean of criticals; secrets in managed store, none in repo history.
- [ ] External penetration test completed; criticals and highs remediated and retested.
- [ ] Paystack webhook signature verification + idempotency tested (replay attack test); payment flows cannot be spoofed to confirm registrations.
- [ ] QR tickets signed; forged/duplicate ticket scan rejected in test.
- [ ] Audit logging live for all privileged actions; logs tamper-evident and retained per policy.
- [ ] Admin accounts: strong-password policy enforced; 2FA for Administrator role.

## Performance

- [ ] Budgets met on reference device (mid-range Android, 3G throttled): first load ≤300KB critical path; repeat Today interactive <1s; Bible chapter navigation instant with prefetch (`15-technical-architecture.md`).
- [ ] API p95 <300ms reads under load test at 5× expected launch concurrency; devotional-morning spike (05:00–07:00 WAT) specifically simulated.
- [ ] Image/media pipeline verified: responsive variants served, per-screen weight budgets met, data-saver mode functional.
- [ ] Offline suite passes: airplane-mode walkthrough of `06-user-flows.md` flow 21 (devotional read, Bible read, ticket display, queued sync on reconnect, no data loss).
- [ ] WEB translation download: resumable, correct on flaky connection, local search functional offline.

## Accessibility

- [ ] WCAG 2.1 AA audit passed on all teen-surface screens (contrast, focus, semantics, labels).
- [ ] Screen reader walkthrough (TalkBack) of the five core flows: signup, read devotional, read Bible, register for event, view ticket.
- [ ] 200% text scaling without breakage; reduced-motion honored; touch targets ≥44px verified.
- [ ] Console keyboard-navigable end to end.

## Content

- [ ] **60-day devotional buffer** scheduled and doctrinally reviewed (two-person rule verified in the workflow); every devotional carries its required memory verse — the Verse-of-the-Day pipeline has zero gaps (`02-roadmap.md` dependency, `07-feature-specifications.md` #5).
- [ ] Bible texts (WEB, KJV) ingested and **verified against source for completeness and verse-accuracy** (automated checksum/verse-count validation + spot review) (`08-bible-experience.md`).
- [ ] Copyright/attribution lines render correctly per translation; verse-share images carry required attribution.
- [ ] Library seeded with launch content set; shelves curated; no empty categories visible.
- [ ] All UI strings pass copy review against `11-content-strategy.md`; no lorem ipsum, no unreviewed error messages; empty states implemented per `06-user-flows.md` flow 26.
- [ ] Current weekly manual loaded; teacher access verified.
- [ ] Legal/content review of licensing posture signed off by counsel (`08-bible-experience.md` §11).

## Testing

- [ ] Automated: unit + integration suites green; tenancy scope tests green against multi-region seed data; payment/webhook integration tests green in Paystack test mode.
- [ ] Reminder ladder verified end to end: rungs fire per preset and quiet hours; **completing the devotional cancels all remaining rungs (including queued sends) within seconds**; 7-day-ignore auto step-down triggers with its in-app note; timezone boundaries (midnight WAT) tested (`07-feature-specifications.md` #10).
- [ ] Grace Day logic tested: monthly grant, earning, 4-day cap, 2-consecutive limit and third-miss reset, streak pause and resume, visible "Grace covered…" messaging (`12-gamification.md`).
- [ ] End-to-end: the 26 flows in `06-user-flows.md` executed on real devices — minimum matrix: low-end Android (≤2GB RAM) Chrome, mid-range Android, one iOS Safari device, desktop Chrome/Firefox.
- [ ] Live payment test: real card + bank transfer + USSD through production Paystack, refunded and reconciled.
- [ ] Event dress rehearsal: a real pilot event (small gathering) run end-to-end — create, register, pay, QR check-in with two scanners including offline check-in sync, report export.
- [ ] Pilot cohort: ≥50 real teens + 5 leaders used the app for ≥2 weeks; critical feedback triaged; showstoppers fixed.
- [ ] UAT sign-off from: regional admin (Funmi profile), one coordinator, one teacher.

## Analytics

- [ ] Event taxonomy implemented and verified end-to-end (fire → ingest → warehouse → dashboard) for all launch events (`14-analytics.md`).
- [ ] WED computes correctly against seeded test data (timezone edge cases: midnight WAT boundary tested).
- [ ] Offline analytics queueing verified (action offline → correct-day attribution after sync).
- [ ] Console dashboards render for coordinator and admin scopes; weekly digest email sends.
- [ ] Guardrail metrics wired with alerts (notification opt-out, pipeline gap detection).

## Monitoring & operations

- [ ] Error tracking (client + server), uptime checks, performance monitoring, and alerting live; on-call/escalation rota defined for launch month.
- [ ] Devotional pipeline monitor: alert fires if no devotional scheduled within 48h (tested by removing one).
- [ ] Payment webhook failure alerting + replay runbook.
- [ ] Status/incident communication path defined (who tells coordinators what, when something breaks on a Sunday morning).
- [ ] Runbooks written: deploy, rollback, restore-from-backup, OTP provider failover, Paystack incident.

## Backups & recovery

- [ ] Automated encrypted database backups (point-in-time recovery enabled); object storage versioning on.
- [ ] **Restore drill executed** to a clean environment; RTO/RPO measured and documented (targets: RPO ≤1h, RTO ≤4h).
- [ ] Backup access restricted and audited.

## Privacy & compliance

- [ ] NDPR/Nigeria DPA review with counsel complete: lawful bases documented, records of processing maintained, DPO/contact designated (`13-community.md`).
- [ ] Privacy notice published in plain teen-readable language; consent capture at signup implemented as counsel directs (including guardian consent handling for minors).
- [ ] Data-subject rights workflows functional: export, correction, deletion (tested end-to-end; deletion verified to erase/anonymize within the defined window).
- [ ] Data minimization audit: every collected field justified; no third-party trackers/ad-tech SDKs present.
- [ ] Breach response plan documented with notification timelines.
- [ ] Under-13 signup block verified.
- [ ] ✧ Community gate (V2 releases only): safeguarding policy ratified by leadership — explicitly covering the constrained encouragement-note channel, its screening, retention, and safeguarding-lead audit access; moderators named and trained per region; crisis escalation protocol live and drilled; report SLA monitoring wired; Friends constraints verified in tests (mutual-only, teen-peer-only enforced server-side, no counts/feeds/likes rendered anywhere, silent block/decline); Accountability Partner consent and instant revocation verified; parent-visibility boundaries verified against `13-community.md` privacy law.

## Documentation & enablement

- [ ] This `/docs` handbook current with as-built reality (drift audit done).
- [ ] Console guides written for admin, coordinator, teacher (short, visual, WhatsApp-shareable PDFs — the audience will not read wikis).
- [ ] Teen-facing help: FAQ + "how to install" one-pager with screenshots for the WhatsApp launch message.
- [ ] Support channel staffed (designated responders, hours, escalation to engineering).
- [ ] Launch communication plan: announcement content, parish rollout sequence, teacher briefing at the pre-launch leaders' meeting.

## Final gate

- [ ] Go/no-go meeting held: product lead, engineering lead, regional admin, regional teens leadership. Every section above green or formally excepted.
- [ ] Rollback plan rehearsed: the app can be taken to a friendly maintenance state without data loss within 15 minutes.
- [ ] Launch-week monitoring rota confirmed; first-week WED baseline reporting scheduled.

*After launch: this checklist is versioned per release. V1.5 and V2 releases re-run the relevant sections plus their ✧ gates.*
