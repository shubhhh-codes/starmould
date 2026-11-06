# Dashboard aur Subplate changes ki jaanch

Date: 6 November 2026. Koi commit nahi kiya gaya.

## Kya badla

- Dashboard ke views, forms, actions aur data helpers alag files mein hain.
- Subplate page mein 2-space indentation hai; bade table, mobile, stage aur form
  sections meaningful components mein hain.
- Purane imports aur requests ka format bana hua hai. Database mein koi structure change nahi hua.
- Quantity ki actual value 1 hone ke bawajood pehli baar 0 dikhne ki galti theek ki.
- Drawer mein plate ka naam, code/badges aur stage/actions ko jagah di gayi hai.
- Mobile mould cards par saaf `View Subplates` aur `History` buttons hain. Naye mobile
  buttons sirf Admin ko dikhte hain; purane desktop permissions nahi badle.

## Actual app mein manually kya check hua

Chrome ke logged-in app, `http://localhost:3000`, mein checks hue.
User ki permission se TEST CUST ke andar `QA TEMP - DELETE AFTER TEST` mould bana.
Uska code `0002_TESTC_002` aur test plate ka code `0002_TESTC_002_001` tha.

| Check | Expected | Actual |
|---|---|---|
| Temporary mould save | Naya record dikhe, TESTC initials rahein | Match; dashboard refresh ke baad record dikha |
| Dashboard sort | Received date ke hisaab se order badle | Dono date orders screen par dikhe |
| Dashboard search | QA TEMP par sirf test mould | Match; Escape se search clear hua |
| Selection | Header se dono rows select; Escape se clear | Match; koi bulk action submit nahi hua |
| Page size | 10 aur 15 select ho sakein | Match; records kam hone ke kaaran next-page check nahi hua |
| Add plate defaults | Plate 1, generated code, MS-Bright, mm, quantity 1 | Match; quantity display issue pehle mila aur phir correct 1 visually verify hua |
| Weight | 100 × 50 × 20 mm, MS-Bright, 1 piece = 0.781 kg | Match; save ke baad bhi 0.781 kg aur quantity 1 |
| Minimum quantity | Keyboard se 1 ke neeche na jaye | Match; Down par 1, Up par 2, Down par 1 |
| Inline expansion | Saved plate aur details dikhein | Match |
| Details drawer | Plate, dimensions aur code dikhein | Match |
| Drawer text | Naam squeeze na ho; badges wrap hon | Desktop aur 390px mobile par visually checked |
| Mobile entry | Labelled button se subplate drawer aur History khulein | Dono khule; History mein saved plate aur mould events dikhe |
| Subplate mobile view | Search, dimensions, qty, stages aur edit action kaam karein | Match |
| Subplate edit | Sirf disposable plate ka naam update ho | Match; `QA TEMP PLATE A EDITED` dikha; code/dimensions/quantity/weight rahe |
| Blank name validation | Save disabled ho | Match |
| Purchase/inward restrictions | Unordered plate par direct manual stage assignment ki jagah PO/Gate Entry action ho | Mobile studio mein PO required aur Gate Entry Required dikha; commercial record create nahi kiya |
| Delete cancellation | Cancel se test mould bache | Match |
| Test cleanup | Sirf disposable mould aur uski plate haten | Match; QA TEMP search empty; original mould aur plate phir dikhe |

Original customer initials edit nahi kiye. Original mould `0001_TESTC_001` aur plate
`0001_TESTC_001_001`, 121 × 12 × 21 mm, quantity 10, cleanup ke baad screen par maujood the.
Test mould ka sequence number use hua; counter ko reset nahi kiya.

## Actual app mein kya poori tarah verify nahi hua

### Dobara ki gayi live jaanch — 6 November 2026

- Quantity par 5 plus/minus cycles mein har baar 1 → 2 → 1 mila. Button chhodne ke
  baad number stable raha; minimum par minus disabled tha.
- Browser mein button ko 700 ms hold karne par quantity 7 hui aur release ke baad
  7 par ruki. Keyboard se wapas 1 kiya. Yeh browser mouse check hai; physical phone
  touch ko isse verified nahi maana gaya.
- Naye disposable mould `QA TEMP - DELETE AFTER TEST - VERIFY 01`, code
  `0002_TESTC_002`, mein `QA TEMP VERIFY PLATE` (plate #4) banayi gayi.
- Is plate ka Design Order `designer` ko assign hua; 1/9 stages aur timestamp dikha.
  Refresh ke baad assignment raha. Admin se Unassigned karne par 0/9 aur Pending dikha.
- Non-admin login ke dauraan account badalta dikha; stable staff session ka poora
  result abhi record nahi hua. Isse staff test pass nahi maana gaya.
- Chrome ke network controls tak pahunchte waqt browser control ne current URL
  confidently confirm na hone par kaam rok diya. Isliye network failure, pagination,
  live permission revoke aur baaki device gestures ka follow-up complete nahi hua.
- **Is follow-up ka disposable mould aur plate abhi app mein hain.** Browser control
  rukne ki wajah se cleanup nahi hua. Original business records ko nahi badla gaya.

Neeche pehli jaanch ki limitations hain; quantity mouse/hold aur Admin assignment
ke liye upar wala follow-up result naya status hai.

- Non-admin account se login aur permission revoke/reassign ke live checks nahi hue.
  Naye mobile buttons ka Admin/staff visibility check isolated browser mein hua.
- Assignment save/unassign ka reliable end-to-end manual result record nahi hua.
- Actual network/database failure force karke save/delete recovery nahi check ki.
- Ek pointer action par counter expected se zyada badha; isolated click check mein yeh
  reproduce nahi hua. Physical touch/hold/repeat behavior ko fully verified nahi maana gaya.
- 15 se zyada moulds create nahi kiye; actual multi-page navigation nahi check hui.
- Actual device long press, drag-close aur reduced-motion preferences ka full manual matrix nahi hua.
- Existing linked commercial records ko delete, edit ya recreate nahi kiya.
- Shared drawer animation checks automated hain; manual observations se har animation frame certify nahi kiya gaya.

## Repeatable checks

- `npm test`: 106 existing library checks; customer identity, mould form/filter and query checks.
- `npm run test:ui`: isolated dashboard, Subplate and shared drawer browser checks.
- Query movement: 15 functions/types ka old/new implementation exact match check hua.
- Subplate movement: 98 existing state/action statements ka order aur implementation exact match hua.
- Type check, changed-file lint, language check aur production build run kiye gaye.
- Final production build, type checking, repeatable browser tests aur offline tests pass hue.
  Changed-file lint mein koi error nahi hai; existing warnings abhi hain.
- Subplate ke 7 old/new browser checkpoints mein visible text aur input states exact match hue.

Isolated checks fake records use karte hain. App ke saved business data ko unse access nahi kiya jata.
Purane lint warnings aur compatibility quirks ko silently fix nahi kiya gaya.
CSV/print exports aur blank-dimension behavior alag changes ke liye pending hain.
