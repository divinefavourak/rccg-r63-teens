# Group registration and manual payments

What was built in the backend and the web Console, and what the phone app needs in order to catch up. The rules are in `docs/07-feature-specifications.md` §9. This note covers the shapes and the screens.

## The idea in one paragraph

An event is paid for either **online** (the gateway, Squad today) or by **bank transfer** to an account set on the event. A coordinator can register a **group**: a headcount of boys and girls from their part of the church, paid for once. Each place is a **seat** with a ticket number and a claim code. The coordinator hands these out, and at the event each teen claims their seat in the app. Transfer receipts are checked in the Console by whoever holds `payments.reconcile` over that part of the church: Super Admin, National Coordinator or Regional Coordinator. Verifying a receipt writes a `Payment`, so there is one ledger.

## Models

| Model | Where | What it is |
|---|---|---|
| `Event.payment_method` | `events/models.py` | `online` or `manual`. With `bank_name`, `bank_account_number`, `bank_account_name`, `payment_instructions`, `group_registration_enabled`. |
| `RegistrationBatch` | `events/models.py` | A group: `reference` (`GRP-XXXXXX`), `event`, `node`, `male_count`, `female_count`, `unit_price`, `amount_due`, `amount_paid`, `status` (`awaiting_payment`, `under_review`, `part_paid`, `paid`, `cancelled`). |
| `EventRegistration.batch`, `.claim_code`, `.claimed_at`, `.node` | `events/models.py` | A seat is a registration with a batch. `node` scopes who reconciles it. |
| `PaymentReceipt` | `payments/models.py` | A transfer receipt for a batch **or** a registration, in private storage. `status`: `submitted`, `verified`, `rejected`. |
| `Payment.batch` | `payments/models.py` | Money for a whole group. Manual money has `channel='manual_transfer'`. |

## Endpoints

All are under `/api/v1/` and need a signed-in user.

| Method and path | Who | What for |
|---|---|---|
| `GET /events/batches/` · `GET /events/batches/<id>/` | coordinators (`events.manage`), reconcilers | Groups and one group, with its seats, receipts, bank details and `can_*` flags. |
| `POST /events/batches/` | `events.manage` over `node` | `{event, node, male_count, female_count, contact_email, contact_phone, consent_attested}`. The email and phone are required, and everything about the group is sent to that email. |
| `POST /events/batches/quote/` | coordinators | `{event, male_count, female_count}` returns the unit price, total and whether the group price applied. |
| `PATCH /events/batches/<id>/` | the group's coordinators | Change the counts (before any payment), the contact email or phone, or the notes. |
| `POST /events/batches/<id>/cancel/` | the group's coordinators | Only while nothing has been paid. |
| `PATCH /events/batches/<id>/seats/` | the group's coordinators | `{seats: [{registration_id, name, phone}]}` puts names on seats. |
| `POST /events/registrations/claim/` | any teen | `{registration_id, claim_code}` returns the registration, now theirs. Throttled. |
| `POST /payments/batches/<id>/checkout/` · `/check/` | the group's coordinators | Gateway checkout for what the group still owes, and asking the gateway afterwards. |
| `POST /payments/receipts/` (multipart) | the payer | `batch` or `registration`, plus `amount`, `paid_on`, `payer_name`, `bank_reference` and `file`. |
| `GET /payments/receipts/` · `/<id>/` | the sender, the group's coordinators, reconcilers | `?status=submitted&event=<id>` |
| `GET /payments/receipts/<id>/file/` | the same | The file itself. Never cached, never at a public address. |
| `POST /payments/receipts/<id>/verify/` · `/reject/` | `payments.reconcile` over the node | `{amount, note}` or `{reason}` |
| `GET /payments/reconciliation/?event=<id>` | `payments.view` or `payments.reconcile` | Summary, ledger, groups still owing. `&export=csv` for the ledger. |

`EventRegistrationDetailSerializer` (the phone's ticket) now also carries `batch` and `claimed_at`. `can_pay` is false for a seat, which is paid with its group, and for a manual-payment event, because the gateway is refused there. `EventListSerializer` and `EventDetailSerializer` carry `payment_method` and `group_registration_enabled`. The detail also carries the bank fields.

## Mobile app guidelines (not built yet)

The phone talks to the same endpoints. Nothing here needs a backend change.

### 1. A teen claims a seat: the priority for the camp

- **Where:** a "Got a ticket from your coordinator?" row at the top of `app/tickets.tsx`, opening a new `app/ticket/claim.tsx`. Show it while the teen has no ticket for an upcoming event, and always as a smaller link below the list.
- **Form:** the ticket number (for example `TEENS-20261024-00007`, uppercased as typed) and the 6-character code. The codes use `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, with no 0/O or 1/I. Offer camera scanning later if the ticket sheet gains a QR code.
- **Call:** `POST /events/registrations/claim/`. On 200, invalidate the `mine` registrations query in `src/api/queries.ts` and route to `ticket/[id]` with the returned id.
- **Errors:** 400 returns `detail` in words a teen can act on: wrong ticket or code, already claimed, a seat for the other gender, already has a ticket for this event. Show it as is. A 429 means too many tries: "Wait a minute and try again."
- **Profile first:** the claim copies the name, age and guardian details from the profile, and checks gender against the seat. If the profile has no gender or date of birth, send the teen through the gender prompt the app already has before claiming.
- **At the desk:** a teen with no phone keeps the seat unclaimed. Check-in works on the ticket number alone (`/events/checkin/search/` and `/scan/` are unchanged), because a paid seat is a paid ticket.

### 2. Paying by transfer for one's own registration

- **Where:** `app/ticket/[id].tsx`, which today shows Pay (Squad) when `can_pay` is true.
- **When the event's `payment_method` is `manual` and the registration is unpaid:**
  - Hide the Squad button and the parent pay link.
  - Show the bank name, account number and account name from the event detail, each with a copy button, the amount (`amount_due`), and the instructions. Suggest the ticket number as the narration.
  - Add a "Send your receipt" button. It picks an image with `expo-image-picker`, which is already a dependency. For PDFs, add `expo-document-picker`.
  - Post multipart to `/payments/receipts/` with `registration`, `amount`, `paid_on` (today by default), the optional `bank_reference` and `file`. The server refuses anything over 5 MB or not a JPG/PNG/WebP/PDF, so compress large photos on the phone before sending.
  - List the receipts from `GET /payments/receipts/?registration=<id>` with their status: waiting to be checked, verified, or rejected with the reviewer's reason. Allow another receipt while the registration is unpaid.
- **When it becomes paid:** the ticket shows as paid, as it already does for Squad.

### 3. A coordinator's groups (later, in `app/console/`)

The web Console is the main place for this. A phone version for coordinators on the go:

- A list of groups (`GET /events/batches/`) with status and balance.
- A group screen with the seats, a "Share tickets" action (the system share sheet with the ticket numbers and codes as text, which is what coordinators send on WhatsApp), and the same pay or receipt panel as the web: gateway checkout via `POST /payments/batches/<id>/checkout/` opened in `expo-web-browser`, or the transfer details and a receipt upload with `batch` instead of `registration`.
- New group: the same fields as the web modal, including the required contact email (pre-filled from the account, but editable) and phone, with the live quote from `/events/batches/quote/`.
- Gate it the way the web does: on `events.manage` from `/identity/me/`, never on a role name.

### 4. Copy

Use the words the Console uses, so a coordinator hears one vocabulary: *group*, *seat*, *ticket number*, *code*, *claim*, *receipt*, *being checked*, *part paid*.

## Operations

- Set `R2_PRIVATE_BUCKET_NAME` to a bucket with no public domain before taking real receipts. See `docs/ops/07-production-secrets.md`.
- Migrations: `events.0013`, `payments.0005`, and `identity.0007`, which grants `payments.reconcile`. Every existing event stays `online`, and group registration is **on** for all events, existing ones included. Turn it off per event in the editor.
- To take transfers for an event: in the Console, edit the event, choose **Bank transfer**, fill in the account, and tick **Coordinators can register groups**. Optionally set a group price from a group size.
