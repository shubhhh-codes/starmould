# Rework Subplate: Optional PO & Project Register Flow — Plan

> **Objective:** 
> 1. Rework / Sample subplates ke liye Purchase Order (PO) ko **optional** banana taaki bina commercial PO banaye bhi factory shop-floor kaam (Programming, VMC, QC, Packing) smoothly aage badh sake aur project complete ho sake.
> 2. Jab sab kaam poora ho jaye, toh project **Project Register** mein move ho sake.
> 3. **Strict Location Gate:** Agar koi subplate **Outward Job Work** pe kisi vendor ke paas pending hai, toh project **kisi bhi haal mein Register nahi hona chahiye** jab tak uska Inward Challan ban kar material Star Mould wapas na aa jaye.

---

## 1. Flow Overview & Architecture

```
                 [ Rework Mould Project ]
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
      [ PO Needed? YES ]        [ PO Needed? NO ]
               │                         │
      Generate Commercial PO     Click "No PO Needed"
               │                         │
        Material Inward          Stage 2 & 3 Auto-Cleared
               │                         │
               └────────────┬────────────┘
                            │
               [ Stage 4: Programming ]
               [ Stage 5: VMC Work    ]
               [ Stage 6: VMC QC      ]
               [ Stage 7: Drill & Tap ]
               [ Stage 8: Final QC    ]
               [ Stage 9: Packing     ]
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
     [ Outward Job Work? ]        [ Inside Star Mould? ]
     outward_jobwork_qty > 0      outward_jobwork_qty == 0
              │                           │
       ❌ HARD BLOCK               ✅ READY FOR REGISTER
     "Material pending            Can move to Project Register
      at vendor — record           (via Customer Dispatch or
      Inward Challan first"        Closure Reason)
```

---

## 2. Component & File Changes

### A. Purchase Required Modal (`src/features/subplates/components/purchase-required-modal.tsx`)
* **Current Behavior:** Hamesha ek hi message deta hai: *"Commercial PO Mandatory. Stage 2 cannot be assigned manually."* aur sirf `Create Purchase Order` ka button hota hai.
* **New Behavior for Rework/Sample:**
  - Agar subplate `subplate_type === 'repair'` hai ya project worktype `Rework` hai:
    - Modal title: **"Purchase Order Optional for Rework / Sample"**.
    - Do clear buttons milenge:
      1. **`✦ Generate Purchase Order`** (Agar naya raw material / steel order karna ho).
      2. **`🔧 No PO Needed (In-House / Existing Mould)`** (Agar mould already factory mein hai aur koi nayi purchase nahi karni).
    - "No PO Needed" click karte hi Stage 2 (Purchase) aur Stage 3 (Material Inward) auto-clear/mark ho jayenge aur Stage 4 (Programming) turant unlock ho jayega!

---

### B. Subplate Controller Hook (`src/features/subplates/hooks/use-subplate-page-controller.ts`)
* **Stage 2 (`order_by`) Handler:**
  - Rework plates ke liye hard block toast na dikhaye, balki `PurchaseRequiredModal` khole jisme "No PO Needed" ka option available ho.
* **Stage 3 (`received_workby`) Handler:**
  - Abhi ka check:
    ```ts
    if (field === "received_workby" && userId !== 0) {
      if (inwardQty <= 0) {
        // Blocks: "Steel has not been received at factory gate. Record receipt in Purchase Inward first."
      }
    }
    ```
  - **Fix:** Agar subplate `subplate_type === 'repair'` hai ya plate par PO bypass hua hai, toh yeh check **bypass** ho jayega aur direct assignment allow hogi.
* **New Handler `handleBypassPOForPlate(subplateId)`:**
  - Ek click par `order_by` aur `received_workby` ko current user se mark karega with timestamp `order_at` & `received_work_at`.
  - Cache invalidate karega taaki UI turant update ho.

---

### C. Mould Assignment Hook (`src/features/moulds/hooks/use-mould-assignments.tsx`)
* **`handleAssignSubplateToUser`:**
  - Abhi ka hard block:
    ```ts
    if (stageKey === "order_by") {
      appStore.addToast({
        type: "error",
        message: "Stage 2 (Purchase) cannot be assigned manually. A Purchase Order must be created first.",
      });
      return;
    }
    ```
  - **Fix:** Agar `subplate.subplate_type === "repair"` ya project rework hai, toh error throw karne ke bajaye bypass allow karega.

---

### D. Move to Register Modal (`src/components/mould/move-to-register-modal.tsx`)
Yeh sabse crucial point hai jo user ne emphasize kiya:

1. **Strict Outward Job Work Gate (Location Check):**
   ```ts
   const outwardJwQty = Number(p.jobwork_balance?.outward_jobwork_qty ?? 0);
   if (outwardJwQty > 0) {
     blocking.push({
       plate: p,
       reason: `Outward Job Work Pending: ${outwardJwQty} pcs are currently outside at vendor (${p.jobwork_balance?.active_vendors || 'Vendor'}). You must record an Inward Challan and receive the material back at Star Mould before moving this project to Project Register.`,
     });
     return;
   }
   ```
2. **Optional PO Clearance:**
   - Agar subplate `subplate_type === 'repair'` hai ya plate par PO create nahi hua tha, toh `pendingInwardQty` ka block trigger **nahi** hoga.
3. **Completion & Handover Check:**
   - Agar plate Star Mould mein hai (`outwardJwQty === 0`), aur manufacturing stages complete hain, toh project register hone ke liye 100% eligible hoga!

---

## 3. Verification & Edge Cases

| Scenario | Expected Result |
|---|---|
| Rework subplate pe Stage 2 click kiya | Modal me `Create PO` aur `No PO Needed` dono option aayenge |
| "No PO Needed" click kiya | Stage 2 & 3 clear ho jayenge, Stage 4 (Programming) unlock ho jayega |
| Rework subplate vendor ko Job Work challan par bheja gaya | `outward_jobwork_qty > 0` ho jayega |
| Outward job work pending hote hue "Move to Register" try kiya | ❌ **HARD BLOCK:** Modal reject karega aur bolega *"Material vendor ke paas hai, pehle Inward Challan banao"* |
| Inward Challan banaya aur material Star Mould wapas aa gaya | `outward_jobwork_qty === 0` |
| Ab "Move to Register" click kiya | ✅ **APPROVED:** Project cleanly Project Register mein move ho jayega |
| Regular / New Make project (e.g. Pulp Mould) | Strict PO mandatory flow pehle ki tarah intact rahega |

---

## 4. Next Step
Artifact review karein. Jaise hi aap 'Proceed' ya approval denge, main execution shuru kar dunga!
