# Uncommitted changes: pre-live review

Date: 16 November 2026 (IST)

**Decision: Abhi live deploy hold karein. P1 issues pehle fix aur verify karne hain.**

Yeh current uncommitted changes ka source-based review hai. Runtime reproduction ya fresh production build is review mein nahi kiya gaya. Earlier passing tests ko in findings ke against validation nahi maana gaya. Review ne application code, database ya deployment change nahi kiya.

P1 = live se pehle fix zaroori. P2 = reliability aur storage risks, release checklist mein resolve ya explicitly assess karein.

## Findings

| ID | Priority | Issue aur impact | Affected code | Required implementation |
| --- | --- | --- | --- | --- |
| F01 | P1 | Positive `photoIds` ko valid evidence maan liya jata hai. Nonexistent IDs requirement bypass kar sakti hain; doosre record ki photo reassign ho sakti hai. | `src/app/api/subplate/route.ts:1138-1174` | Server par existence, ownership or explicit authorized reuse, movement type, batch, subplate, stage aur deleted status validate karein. Stage update aur photo linking ek transaction mein karein. |
| F02 | P1 | Shared photo ka doosra project active ho aur uska retention cycle na bana ho, tab bhi photo delete ho sakti hai. | `src/lib/r2/retention.ts:134-158` | Har linked project ka current status aur latest retention cycle check karein. Sab completed hon aur sab deadlines expire hon. Missing cycle ya query failure par delete allow na karein. |
| F03 | P1 | Actual project reopen flow retention cancellation se connected nahi hai. Pending deletion retries eligibility dobara check nahi karte. | `src/lib/r2/retention.ts:60`, `src/lib/r2/retention.ts:301`; integration: `src/features/moulds/hooks/use-mould-project-actions.tsx:47`, `src/app/api/scanning/route.ts:598` | Reopen ke server transaction mein active cycle aur pending deletion jobs cancel karein. Jobs ko retention generation se bind karein. Har delete attempt par current status, generation aur shared-project eligibility revalidate karein. Concurrent reopen aur deletion coordinate karein. |
| F04 | P1 | Existing storage cron sirf folder moves chalata hai. Automatic retention cleanup, reminders aur deletion retries wired nahi hain. Dispatch se automatic completion bhi retention start bypass karti hai. | `src/app/api/photos/storage/cron/route.ts:12`, `src/app/api/projects/[id]/close/route.ts:168`, `supabase/migrations/20261116170000_photo_history_gallery.sql:264` | Retention lifecycle ko har completion/reopen path se centrally connect karein. Completion aur cycle creation atomic aur idempotent hon. Scheduled worker mein cleanup, reminders aur deletion retries add karein. CRM reminder delivery verify karein. |
| F05 | P1 | Draft key user, project aur QC stage isolate nahi karti. Same device par users ya movements ke drafts mix ho sakte hain. | `src/components/photos/movement-photo-uploader.tsx:152` | Draft namespace mein authenticated principal, stable form-draft ID aur stage include karein. Account switch par displayed state aur requests reset/abort karein. Existing drafts ko guessed owner assign na karein. |
| F06 | P1 | Restored files `pending` state mein rehti hain, lekin resume worker nahi hai. Successful photo IDs aur batch ID persist nahi hote. Reload se evidence lose ya mixed-batch save error ho sakta hai. | `src/components/photos/movement-photo-uploader.tsx:222-298`, `src/components/photos/movement-photo-uploader.tsx:312-354` | Form data, pending files, uploaded photo IDs, batch ID, draft ID aur event ID persist karein. Restore aur connectivity return par bounded upload queue resume karein. Successful movement save ke baad hi draft clear karein. |
| F07 | P1 | Export response ke baad detached async task ki lifetime protected nahi hai. Serverless runtime job ko terminate kar sakta hai; job processing mein atak sakti hai. | `src/app/api/photos/export/route.ts:72-135` | Durable export worker use karein, with atomic claim, lease, retry/backoff aur expired-lease recovery. Worker ek queued job ID ko update kare. Short-term `after()` integration platform duration ke andar hi reliable hai, large-export worker ka replacement nahi. |
| F08 | P1 | ZIP generation poora archive memory mein rakhti hai. Download route aur browser bhi poora ZIP buffer karte hain. Large backup memory/time limits hit kar sakta hai. | `src/lib/r2/export-zip.ts:168`, `src/app/api/photos/export/[jobId]/download/route.ts:56`, `src/views/photo-storage-page.tsx:182` | ZIP ko stream karke R2 multipart upload karein. Failed multipart uploads abort karein. Authenticated download stream karein aur browser mein whole-file Blob avoid karein. Shared-photo folder expansion aur CSV index preserve karein. |
| F09 | P2 | `deleteFromR2()` error par `false` return karta hai. Caller result check nahi karta, phir deleted/confirmed/freed counters update ho jate hain. | `src/lib/r2/client.ts:150-162`, `src/lib/r2/retention.ts:179-204`, `src/lib/r2/retention.ts:331` | Delete outcome explicitly check karein ya storage error throw karein. Failed delete ko retryable state mein rakhein. Physical deletion confirm hone se pehle completed ya bytes freed report na karein. Missing object ko successful idempotent delete maana ja sakta hai. |
| F10 | P2 | Retention associations query paginated nahi hai. API row cap ke baad baaki photos miss ho sakti hain, jabki cycle completed mark ho jati hai. | `src/lib/r2/retention.ts:108-124`, `src/lib/r2/retention.ts:223-232`; related stats: `src/app/api/photos/stats/route.ts:32` | Retention candidates ko stable ordering aur pagination se process karein. Remaining work track karein. Partial reads ya DB errors par cycle complete na karein. Dashboard totals ke liye database aggregates use karein. |
| F11 | P2 | Upload attempt lookup aur upsert atomic reservation nahi hain. Same client upload ID ki concurrent requests alag physical objects aur photo rows bana sakti hain. | `src/app/api/photos/upload/route.ts:117-146`, `src/app/api/photos/upload/route.ts:178-192` | Image processing/storage write se pehle unique attempt atomically reserve karein. Sirf reservation owner process kare. Duplicate requests ready result reuse karein ya processing response dein. Crashed attempts ki lease/retry recovery add karein. |
| F12 | P2 | ZIP expiry download access rokta hai, lekin application mein expired archive objects delete karne ka flow nahi hai. External lifecycle absent ho to R2 usage badhti rahegi. | `src/app/api/photos/export/[jobId]/download/route.ts:49`, `src/app/api/photos/export/route.ts:100-113` | R2 `exports/` prefix ke liye verified lifecycle policy ya retryable archive cleanup implement karein. Active jobs aur temporary objects account karein. Physical deletion verify karke job state update karein. |

Supabase projects default mein maximum 1,000 rows return karte hain; configured API cap alag ho sakta hai. Pagination guidance: [Supabase select documentation](https://supabase.com/docs/reference/javascript/v1/select).

## Deployment checks

- [ ] Production mein missing/partial R2 credentials par upload fail clearly ho. Ephemeral local filesystem ko successful durable storage na dikhayein. Relevant file: `src/lib/r2/client.ts`.
- [ ] Target hosting par fresh production build aur native image-processing compatibility verify karein. Local Node build se Cloudflare deployment compatibility prove nahi hoti.
- [ ] Migrations dependency order mein apply hon. Already-applied migrations edit karne ke bajaye fixes ke liye forward migrations add karein.
- [ ] Existing inventory quantity, replay, partial dispatch aur document-linking guards preserve karein. Photo fixes ke liye core RPC ko weaker implementation se replace na karein.
- [ ] Cron schedule actually deployed ho. Secret present hona schedule configured hone ka proof nahi hai.
- [ ] Original photos, shared photos, temporary ZIPs aur failed multipart uploads sab storage accounting/cleanup mein cover hon.

## Required regression cases

| Area | Minimum verification |
| --- | --- |
| QC and Packing | Nonexistent, deleted, wrong-user, wrong-batch aur wrong-stage photo IDs reject hon. Failed stage update photo metadata change na kare. |
| Shared retention | Project A expired + B active without cycle: photo rahe. Dono expired: delete ho. Eligibility query fail: photo rahe. |
| Reopen | Pending job, failed retry aur concurrent cleanup ke saath reopen test karein. Recomplete par fresh 30-day cycle bane. |
| Completion paths | Manual Register completion aur automatic dispatch completion dono retention start karein. Replay deadline ko unnecessarily reset na kare. |
| Draft ownership | Same device par two accounts, two new movements aur VMC/Final QC drafts separate rahen. |
| Draft recovery | Browser close/reopen, partial upload success, lost upload response aur reconnect ke baad queue resume ho. Original batch identity preserve ho. |
| Draft expiry | Last explicit user edit se 24-hour expiry ho. Automatic retries expiry extend na karein. Expired drafts ka cleanup form dobara khole bina bhi ho. |
| Upload concurrency | Same client upload ID ke simultaneous requests se one logical photo aur one retained physical object bane. |
| Retention pagination | One project with more than configured API row cap. Saare candidates process hon; partial query failure par cycle pending rahe. |
| Deletion failures | R2 error, missing object aur database update failure test karein. Counters aur job state actual outcome dikhayein. |
| Export durability | Response ke baad process interruption aur expired lease recovery test karein. Duplicate workers archive/job corrupt na karein. |
| Export scale | Representative large project aur bulk backup test karein. Peak memory bounded rahe; download resume/failure handling verify ho. |
| ZIP content | Shared photos har relevant mould mein milen. Unlinked photos directly `MOULD-CODE/category/photo.webp` mein hon, per-photo folders na banen. CSV paths actual entries se match hon. |
| Archive expiry | Expired ZIP download reject ho aur physical object cleanup bhi confirm ho. |
| Permissions | Admin download/delete allowed ho. Ordinary users authorized photos view kar saken, admin operations call na kar saken. |

## Review limits

- Findings source inspection se nikli hain. Conditional risks ka trigger table mein diya gaya hai.
- Available runner required isolated execution setup provide nahi karta, isliye is review mein application tests/build execute nahi kiye gaye.
- Existing passing tests ko unchanged production-readiness guarantee na maanein. Upar ke regression cases ke saath fresh tests, clean production build aur target-host staging validation complete karein.
- Review ne koi code fix, commit ya deploy nahi kiya. Yeh file implementation handoff aur release checklist hai.
