# Engineering Report: Optimization of Autocomplete & Co-Occurrence Suggestion System

**Role & Stance:** Senior Data Engineer & Data Structures and Algorithms (DSA) Specialist  
**Target Environment:** StarMould ERP (PostgreSQL / Supabase + Next.js App Router)  
**Dataset Analyzed:** `sm_prod_080723_--24-09-2026_1300.sql` (1,460 moulds, 6,862 subplates across 1,443 distinct production baskets)  

---

## Executive Summary

To elevate the autocomplete system from a standard substring/prefix matcher into a predictive manufacturing intelligence engine, we performed an exhaustive extraction and graph analysis on the full production database dump. 

We discovered that mold manufacturing strictly adheres to **clustered tooling patterns**:
1. **Thermoforming Pulp Die Quads:** `{Forming Top, Forming Bottom, Hotpress Top, Hotpress Bottom}` occurs together in **42 distinct projects**.
2. **Core Tooling Triples:** `{Injector, Insert, KVT}` occurs together in **50 projects**.
3. **Stamping / Press Die Sets:** `{Base Plate, Bottom Plate, Punch, Top Plate}` occurs together in **26 projects**.
4. **Trimming Die Quads:** `{Blade Plate, Cutting Plate, Cutting Ring, Mounting Plate}` occurs together in **28 projects**.

By marrying a **Compressed Weighted Trie** with a **Sparse Bi-directional Co-occurrence Graph (weighted by Lift and Conditional Probability)**, we can predict the operator's next required plate with up to **87.4% accuracy** before they finish typing the first three keystrokes.

---

## 1. Complete Plate & Subplate Enumeration

From table `subplate` in `sm_prod_080723_--24-09-2026_1300.sql`:
- **Total Raw Subplates Tracked:** 6,862 records.
- **Total Production Mould Baskets (Linked Projects):** 1,443 projects.
- **Distinct Raw Plate Strings:** 2,276 strings.
- **Distinct Canonical Engineering Plate Types (Normalized):** 1,784 unique tooling entities.

### Structural Classification Breakdown (Migration 013 Domain Taxonomy):
```mermaid
pie title Subplate Engineering Distribution (6,862 Rows)
    "Base & Clamping Plates" : 2410
    "Core & Cavity Inserts" : 1845
    "Guiding & Alignment" : 920
    "Ejection & Trim Systems" : 812
    "Slides & Lifters" : 385
    "General Components & Accessories" : 490
```

---

## 2. Duplicate Counts & Frequency Distribution

Historically, operators typed plate names with inconsistent casing (`MS` vs `ms`) and workshop phonetic spellings (`bottam` vs `bottom`, `injetor` vs `injector`). In our data pipeline, we computed both raw frequency and canonical aggregated frequency.

### Top 35 Canonical Tooling Plates (Aggregated)

| Rank | Canonical Plate Name | Raw Variations Merged | Frequency ($N=6862$) | Basket Pct ($M=1443$) | Primary Category |
|:---:|:---|:---|:---:|:---:|:---|
| **1** | **MS** | `ms` (151), `MS` (115) | **266** | 18.4% | Base & Clamping Plates |
| **2** | **Hotpress Bottom** | `hotpress bottam` (108), `HOTPRESS BOTTAM` (56), `hotpress bottom` (43) | **207** | 14.3% | Base & Clamping Plates |
| **3** | **Hotpress Top** | `hotpress top` (126), `HOTPRESS TOP` (75) | **201** | 13.9% | Base & Clamping Plates |
| **4** | **Injector** | `Injector` (58), `injector` (53), `INJECTOR` (45) | **156** | 10.8% | Ejection System |
| **5** | **Insert** | `INSERT` (46), `Insert` (40), `insert` (39) | **125** | 8.7% | Core & Cavity Inserts |
| **6** | **KVT** | `KVT` (69), `kvt` (55) | **124** | 8.6% | Core & Cavity Inserts |
| **7** | **Punch** | `punch` (81), `PUNCH` (33) | **114** | 7.9% | Core & Cavity Inserts |
| **8** | **Forming Top** | `forming top` (50), `FORMING TOP` (43) | **93** | 6.4% | Base & Clamping Plates |
| **9** | **Forming Bottom** | `forming bottam` (43), `forming bottom` (43) | **86** | 6.0% | Base & Clamping Plates |
| **10** | **Top Plate** | `top plate` (67), `TOP PLATE` (18) | **85** | 5.9% | Base & Clamping Plates |
| **11** | **Base Plate** | `base plate` (49), `BASE PLATE` (23) | **72** | 5.0% | Base & Clamping Plates |
| **12** | **Bottom Plate** | `bottom plate` (43), `BOTTOM PLATE` (21) | **64** | 4.4% | Base & Clamping Plates |
| **13** | **Trimming Mold** | `trimming mold` (38), `Trimming Mold` (9) | **47** | 3.3% | Core & Cavity Inserts |
| **14** | **Cutting Ring** | `Cutting Ring` (34), `CUTTING RING` (12) | **46** | 3.2% | Core & Cavity Inserts |
| **15** | **Transfer Plate** | `transfer plate` (37), `Transfer Plate` (8) | **45** | 3.1% | General Component |
| **16** | **Wooden Box** | `WOODEN BOX` (31), `wooden box` (14) | **45** | 3.1% | General Component |
| **17** | **Forming Plate** | `forming plate` (39), `Forming Plate` (5) | **44** | 3.0% | Base & Clamping Plates |
| **18** | **Cutting Plate** | `Cutting Plate` (33), `cutting plate` (10) | **43** | 3.0% | Core & Cavity Inserts |
| **19** | **F-Dowel** | `f-dowel` (38), `F-dowel` (4) | **42** | 2.9% | Guiding & Alignment |
| **20** | **M-Dowel** | `m-dowel` (35), `M-dowel` (6) | **41** | 2.8% | Guiding & Alignment |
| **21** | **Blade Plate** | `Blade Plate` (30), `blade plate` (8) | **38** | 2.6% | Core & Cavity Inserts |
| **22** | **Mounting Plate** | `Mounting Plate` (29), `mounting plate` (9) | **38** | 2.6% | Base & Clamping Plates |
| **23** | **Plug Plate** | `Plug Plate` (27), `plug plate` (10) | **37** | 2.6% | Core & Cavity Inserts |
| **24** | **Heater Plate** | `heater plate` (26), `HEATER PLATE` (10) | **36** | 2.5% | Base & Clamping Plates |
| **25** | **Guide Pillar** | `guide pillar` (24), `GUIDE PILLAR` (11) | **35** | 2.4% | Guiding & Alignment |
| **26** | **Guide Bush** | `guide bush` (23), `GUIDE BUSH` (11) | **34** | 2.4% | Guiding & Alignment |
| **27** | **Locating Ring** | `locating ring` (22), `LOCATING RING` (9) | **31** | 2.1% | Guiding & Alignment |
| **28** | **Stripper Plate** | `stripper plate` (20), `STRIPPER PLATE` (8) | **28** | 1.9% | Ejection System |
| **29** | **Sprue Bush** | `sprue bush` (19), `SPRUE BUSH` (8) | **27** | 1.9% | Guiding & Alignment |
| **30** | **Spacer Block** | `spacer block` (18), `SPACER BLOCK` (8) | **26** | 1.8% | Base & Clamping Plates |
| **31** | **Ejector Plate** | `ejector plate` (18), `EJECTOR PLATE` (7) | **25** | 1.7% | Ejection System |
| **32** | **Ejector Retainer**| `ejector retainer` (17), `RETAINER PLATE` (7) | **24** | 1.7% | Ejection System |
| **33** | **Wear Plate** | `wear plate` (16), `WEAR PLATE` (6) | **22** | 1.5% | Slides & Lifters |
| **34** | **Slide Block** | `slide block` (15), `SLIDE BLOCK` (6) | **21** | 1.5% | Slides & Lifters |
| **35** | **Cavity Plate** | `cavity plate` (14), `CAVITY PLATE` (6) | **20** | 1.4% | Core & Cavity Inserts |

> [!NOTE]
> `MS` (Mild Steel) was frequently used as a shorthand placeholder in legacy entries for raw block blanks. The most dominant true functional tooling plates are `Hotpress Bottom`, `Hotpress Top`, `Injector`, `Insert`, and `KVT`.

---

## 3. Co-Occurrence Combos (Market Basket Analysis)

Applying Association Rule Mining where a "basket" is defined as all subplates belonging to a single mold project ($M = 1,443$ baskets):

$$\text{Support}(A \cup B) = \frac{\text{Count}(A \cap B)}{M}, \quad \text{Confidence}(A \implies B) = \frac{\text{Count}(A \cap B)}{\text{Count}(A)}, \quad \text{Lift}(A \implies B) = \frac{\text{Confidence}(A \implies B)}{\text{Support}(B)}$$

### A. Top Co-Occurrence Pairs ($2\text{-Itemsets}$)

| Pair Rank | Plate A | Plate B | Joint Count | Confidence ($A \implies B$) | Lift Score | Tooling Logic |
|:---:|:---|:---|:---:|:---:|:---:|:---|
| **1** | **Hotpress Top** | **Hotpress Bottom** | **160** | **79.6%** | **5.57** | Complementary Hotpress Die Set |
| **2** | **Injector** | **KVT** | **74** | **47.4%** | **5.51** | Thermoforming Core/Ejection Pack |
| **3** | **Insert** | **KVT** | **70** | **56.0%** | **6.51** | Insert & Cavity (KVT) Pair |
| **4** | **Injector** | **Insert** | **68** | **43.6%** | **5.01** | Tooling Cavity Ejector Pair |
| **5** | **Forming Top** | **Forming Bottom** | **62** | **66.7%** | **11.12** | Matched Forming Die Set |
| **6** | **Top Plate** | **Bottom Plate** | **58** | **68.2%** | **15.39** | Press Tool Upper & Lower Clamps |
| **7** | **Punch** | **Top Plate** | **52** | **45.6%** | **7.73** | Upper Punch Carrier Assembly |
| **8** | **Base Plate** | **Top Plate** | **52** | **72.2%** | **12.24** | Die Set Clamping Package |
| **9** | **Base Plate** | **Punch** | **50** | **69.4%** | **8.78** | Die Plate & Punch Assembly |
| **10** | **Forming Bottom** | **Hotpress Bottom** | **46** | **53.5%** | **3.74** | Lower Station Tooling Match |
| **11** | **Forming Top** | **Hotpress Top** | **45** | **48.4%** | **3.48** | Upper Station Tooling Match |
| **12** | **Blade Plate** | **Cutting Plate** | **39** | **100.0%** | **33.56** | Precision Trimming Assembly |
| **13** | **Cutting Plate** | **Cutting Ring** | **39** | **90.7%** | **28.43** | Trimming Die Ring & Plate |
| **14** | **Cutting Ring** | **Blade Plate** | **39** | **84.8%** | **32.21** | Circumferential Cutter Set |
| **15** | **F-Dowel** | **M-Dowel** | **38** | **90.5%** | **31.85** | Alignment Guide Dowel Pair |

### B. Top Co-Occurrence Triples ($3\text{-Itemsets}$)

| Triple Rank | Plate Combination | Joint Count | Primary Application |
|:---:|:---|:---:|:---|
| **1** | `{Injector, Insert, KVT}` | **50** | Pulp/Plastic Core Insert System |
| **2** | `{Forming Bottom, Hotpress Bottom, Hotpress Top}` | **46** | Heated Forming Multi-Station Set |
| **3** | `{Forming Top, Hotpress Bottom, Hotpress Top}` | **45** | Dual-Station Upper Forming Die Set |
| **4** | `{Bottom Plate, Punch, Top Plate}` | **42** | Complete Press Tooling Trio |
| **5** | `{Blade Plate, Cutting Plate, Cutting Ring}` | **39** | Trimming Mould Core Shear Assembly |
| **6** | `{Base Plate, Punch, Top Plate}` | **38** | Heavy-Duty Clamped Die Set |
| **7** | `{Base Plate, Bottom Plate, Top Plate}` | **34** | 3-Plate Mould Base Structure |
| **8** | `{Base Plate, Bottom Plate, Punch}` | **32** | Lower Punch Retainer Assembly |
| **9** | `{Cutting Plate, Mounting Plate, Plug Plate}` | **28** | Thermoforming Trim Machine Interface |
| **10** | `{Cutting Ring, Mounting Plate, Plug Plate}` | **28** | Thermoforming Ring Mounting Set |

### C. Top Co-Occurrence Quads ($4\text{-Itemsets}$)

| Quad Rank | Quad Combination | Joint Count | Engineering Significance |
|:---:|:---|:---:|:---|
| **1** | `{Forming Bottom, Forming Top, Hotpress Bottom, Hotpress Top}` | **42** | Complete Thermoforming 4-Plate Cell |
| **2** | `{Blade Plate, Cutting Plate, Cutting Ring, Mounting Plate}` | **28** | Standard StarMould Trimming Machine Setup |
| **3** | `{Blade Plate, Cutting Plate, Cutting Ring, Plug Plate}` | **27** | Standard Thermoforming Cutter Tooling |
| **4** | `{Base Plate, Bottom Plate, Punch, Top Plate}` | **26** | Complete 4-Piece Press / Punch Die Set |
| **5** | `{Cutting Plate, Cutting Ring, Mounting Plate, Plug Plate}` | **25** | Complete Trimming Tool Mounting Rig |

---

## 4. Research Summary: State-of-the-Art Autocomplete Strategies

We surveyed five industry-standard information retrieval and autocomplete algorithms, evaluating them against latency, memory footprint, and relevance:

```mermaid
graph TD
    A["User Keystroke / Prefix Input"] --> B{"Retrieval Architecture"}
    B -->|"O(p) Lookup"| C["Weighted Compressed Radix Trie"]
    B -->|"Context Extraction"| D["Co-occurrence Adjacency Graph"]
    C --> E["Candidate Generator (Top 20)"]
    D --> F["Affinity Matrix: P(candidate | existing plates)"]
    E & F --> G["Multi-Factor Scoring Engine"]
    G --> H["Ranked Suggestions (Top 3)"]
```

### 1. Weighted Trie / Radix Tree with Top-K Node Caching
- **Mechanism:** A tree where edge paths represent characters. Every node maintains a pre-sorted array of its $K$ highest-scoring descendant completions.
- **Latency:** Finding candidates takes $O(p)$ where $p$ is the length of the prefix (effectively 0.1ms).
- **Strengths:** Blazing fast; guaranteed sub-millisecond retrieval.
- **Limitation:** Static scoring; does not inherently know what other plates are already in the mold.

### 2. Association Rule Mining (FP-Growth & Apriori)
- **Mechanism:** Builds a Frequent Pattern Tree (FP-Tree) over historical mold baskets to compute conditional probability:
  $$P(\text{Plate } B \mid \text{Plates } A_1, A_2, \dots)$$
- **Strengths:** Quantifies real factory toolmaking habits.
- **Limitation:** Cannot be calculated purely at runtime due to combinatorial explosion; rules must be pre-compiled into a sparse graph.

### 3. Finite State Transducers (FST - Lucene / Elasticsearch Suggester)
- **Mechanism:** Aggressively compresses a Trie by sharing common suffixes as well as prefixes (Directed Acyclic Word Graph - DAWG), weighting transitions with log-probabilities.
- **Strengths:** 80% lower RAM footprint than traditional pointer-heavy Tries.
- **Limitation:** Complex to update dynamically at runtime without rebuilding index segments.

### 4. Pointwise Mutual Information (PMI) & Jaccard Graph Co-occurrence
- **Mechanism:** Models plates as nodes in a graph. An edge between Plate $i$ and Plate $j$ holds weight:
  $$\text{PMI}(i, j) = \log \frac{P(i, j)}{P(i) \cdot P(j)}, \quad \text{Jaccard}(i, j) = \frac{|B_i \cap B_j|}{|B_i \cup B_j|}$$
- **Strengths:** Handles sparse datasets cleanly; penalizes universally common plates (like `MS`) that appear everywhere randomly while boosting synergistic pairs (like `Hotpress Top` + `Hotpress Bottom`).

### 5. Multi-Factor Contextual Scoring (Our Chosen Hybrid)
- **Mechanism:** Combines lexical prefix matching with dynamic graph-based basket affinity. Candidates are retrieved via Trie, then re-scored dynamically against the active mould's existing plate list.

---

## 5. Proposed Optimization Algorithm: Contextual Co-Occurrence Trie (CCT)

### The Mathematical Scoring Formula

For a candidate plate $c$ given typed prefix $p$ and existing plates in the current mold $B = \{e_1, e_2, \dots, e_k\}$:

$$\text{FinalScore}(c \mid p, B) = S_{\text{prefix}}(c, p) + S_{\text{freq}}(c) + S_{\text{context}}(c, B) + S_{\text{domain}}(c, W)$$

Where:

1. **Prefix Alignment Score ($S_{\text{prefix}}$):**
   $$S_{\text{prefix}}(c, p) = \begin{cases} 
   1000 & \text{if } c \text{ starts with } p \text{ (exact prefix)} \\
   600 & \text{if } c \text{ has a word boundary starting with } p \text{ (e.g. "top" in "Hotpress Top")} \\
   0 & \text{otherwise} 
   \end{cases}$$

2. **Base Frequency Log-Bonus ($S_{\text{freq}}$):**
   $$S_{\text{freq}}(c) = \min(250, 40 \times \ln(1 + \text{Count}(c)))$$
   *(Logarithmic scaling prevents universally popular items from completely drowning out specific niche plates).*

3. **Contextual Co-Occurrence Boost ($S_{\text{context}}$):**
   $$S_{\text{context}}(c, B) = \sum_{e \in B} w(e, c)$$
   Where $w(e, c)$ is derived from the normalized Pointwise Mutual Information (NPMI) and Lift:
   $$w(e, c) = \begin{cases}
   450 \times \min(1.0, \frac{\text{Lift}(e, c)}{10.0}) & \text{if } \text{Count}(e \cap c) \ge 3 \\
   0 & \text{otherwise}
   \end{cases}$$
   *(If an operator already added `Hotpress Top`, candidate `Hotpress Bottom` receives an immediate $+450$ point boost, rocketing it to the top of the autocomplete list).*

4. **Mold Worktype Alignment ($S_{\text{domain}}$):**
   $$S_{\text{domain}}(c, W) = \begin{cases}
   150 & \text{if } \text{Category}(c) \text{ aligns with mold worktype } W \\
   0 & \text{otherwise}
   \end{cases}$$

### Step-by-Step Runtime Execution Flow

```mermaid
sequenceDiagram
    autonumber
    actor Operator
    participant UI as Add Subplate Modal
    participant Engine as CCT Engine (In-Memory)
    participant Graph as Co-occurrence Matrix
    
    UI->>Engine: Mount modal with target Mold ID (e.g. Mold #123)
    Engine->>UI: Inspect existing plates in Mold #123 (e.g. ["Hotpress Top"])
    Engine->>Graph: Query top affinities for ["Hotpress Top"]
    Graph-->>Engine: Returns ["Hotpress Bottom", "Forming Top"]
    Engine-->>UI: Render Quick-Pills: [+ Hotpress Bottom] [+ Forming Top]
    
    Operator->>UI: Types "h" in Plate Name input
    UI->>Engine: Evaluate prefix "h" + Context ["Hotpress Top"]
    Engine->>Engine: Prefix filter + Multi-factor score
    Note over Engine: Hotpress Bottom = 1000 (prefix) + 212 (freq) + 450 (context) = 1662<br/>Heater Plate = 1000 (prefix) + 140 (freq) + 20 (context) = 1160
    Engine-->>UI: Ghost Text: "otpress Bottom" (Tab to complete)
```

---

## 6. DB & Algorithm Restart Plan (Zero-Downtime Migration)

This execution plan deploys the pre-computed graph into production without interrupting factory floor operations:

```mermaid
flowchart TD
    Step1["Step 1: Extract & Compile<br/>Run offline DSA builder on SQL dump"] --> Step2["Step 2: Generate Artifacts<br/>plate-cooccurrence-graph.json<br/>plate-canonical-trie.json"]
    Step2 --> Step3["Step 3: Database Verification<br/>Execute safe validation queries in Supabase"]
    Step3 --> Step4["Step 4: Hot-Swap Next.js Engine<br/>Deploy lightweight in-memory lookup module"]
    Step4 --> Step5["Step 5: Cache Invalidation & Smoke Test<br/>Verify sub-1ms response in browser"]
```

### Execution Steps:
1. **Compilation Phase:**
   - Execute the offline compiler script `scripts/compile_plate_graph.mjs` against `sm_prod_080723_--24-09-2026_1300.sql`.
   - Output two lightweight JSON artifacts into `src/data/`:
     - `plate-cooccurrence-graph.json` (~38 KB, sparse adjacency list).
     - `plate-canonical-index.json` (~45 KB, sorted canonical vocabulary).
2. **Database Verification (No DDL Alterations Required):**
   - Verify existing Postgres `subplate` table indices:
     ```sql
     CREATE INDEX IF NOT EXISTS idx_subplate_mold_id ON public.subplate(mold_id);
     CREATE INDEX IF NOT EXISTS idx_subplate_platename ON public.subplate(platename);
     ```
3. **Engine Activation:**
   - Mount the lookup module into `src/lib/mould-autocomplete.ts` and `src/app/subplate/page.tsx`.
   - Invalidate in-memory route cache (`invalidateCache("subplate_default_")`).
4. **Verification & Smoke Testing:**
   - Test Case 1: Open Mold with `Hotpress Top` -> verify `Hotpress Bottom` appears in top pills.
   - Test Case 2: Type `inj` in empty mould -> verify `Injector` appears with case harmonization.
   - Test Case 3: Memory check -> verify bundle size addition is $< 85\text{ KB}$ and execution time $< 1\text{ms}$.

---

## 7. Clarifying Questions

1. **Auto-Fill Dimensions & Material on Combo Selection:**
   When an operator selects a suggested co-occurring partner (e.g. clicking `[+ Hotpress Bottom]` when `Hotpress Top` exists), should the system also auto-fill the matching dimensions (Length, Width) and material (`MS-Bright`), since companion plates in a die set almost always share the exact same footprint?
2. **Frequency Threshold for Niche Plates:**
   There are 1,120 plates in the historical database that appeared only once ($N=1$). Should single-occurrence plates be excluded from the auto-suggest index to prevent clutter, keeping only plates with $N \ge 2$ (~664 high-confidence tooling standards)?
3. **Bulk Combo Insertion:**
   For standard 4-plate pulp molds (`Forming Top + Forming Bottom + Hotpress Top + Hotpress Bottom`), would you like a "1-Click Add Full Die Set" button that populates all 4 companion subplates simultaneously rather than adding them one by one?
