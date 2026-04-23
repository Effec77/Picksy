# Pickscraper Build Roadmap

> What we're building, in what order, and how each piece connects.
> 
> **Model Strategy:** Qwen 2.5 3B (Primary) + Llama 3.2 3B (Secondary)

---

## The Big Picture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           PICKSCRAPER SYSTEM                                    │
│                                                                                 │
│  ┌───────────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │
│  │  DUAL MODEL   │──│   RAG   │──│ SCRAPER │──│  TASKS  │──│  AGENTS │         │
│  │    LAYER      │  │(Memory) │  │ (Eyes)  │  │(Skills) │  │(Workers)│         │
│  │               │  │         │  │         │  │         │  │         │         │
│  │ ┌───────────┐ │  └─────────┘  └─────────┘  └─────────┘  └─────────┘         │
│  │ │ Qwen 2.5  │ │                                                              │
│  │ │   3B      │ │       2            3            4            5               │
│  │ │ (Primary) │ │                                                              │
│  │ └───────────┘ │                                                              │
│  │ ┌───────────┐ │                                                              │
│  │ │ Llama 3.2 │ │                                                              │
│  │ │   3B      │ │                                                              │
│  │ │(Secondary)│ │                                                              │
│  │ └───────────┘ │                                                              │
│  └───────────────┘                                                              │
│         1                                                                       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Dual Model Strategy

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         WHY TWO MODELS?                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────┐    ┌─────────────────────────────┐            │
│  │       QWEN 2.5 3B           │    │       LLAMA 3.2 3B          │            │
│  │       (PRIMARY)             │    │       (SECONDARY)           │            │
│  ├─────────────────────────────┤    ├─────────────────────────────┤            │
│  │                             │    │                             │            │
│  │  ⭐ Best structured JSON    │    │  ⚡ Fastest inference       │            │
│  │  ⭐ Highest benchmarks      │    │  ⚡ Best fine-tune ecosystem│            │
│  │  ⭐ 29+ languages           │    │  ⚡ Great community         │            │
│  │  ⭐ Complex reasoning       │    │  ⚡ Simple tasks            │            │
│  │                             │    │                             │            │
│  │  VRAM: ~2GB (Q4)            │    │  VRAM: ~2GB (Q4)            │            │
│  │  Speed: ~55 tok/s           │    │  Speed: ~60 tok/s           │            │
│  │  Context: 128K              │    │  Context: 128K              │            │
│  │                             │    │                             │            │
│  │  USE FOR:                   │    │  USE FOR:                   │            │
│  │  • Product extraction       │    │  • Quick classification     │            │
│  │  • Review sentiment         │    │  • Binary decisions         │            │
│  │  • Summarization            │    │  • High-volume tasks        │            │
│  │  • Complex JSON output      │    │  • Fallback/redundancy      │            │
│  │                             │    │                             │            │
│  └─────────────────────────────┘    └─────────────────────────────┘            │
│                                                                                 │
│  TOTAL VRAM: ~4GB (both loaded) — Fits easily in 8GB GPU!                      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Model Routing Logic

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           MODEL ROUTER                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│                         ┌─────────────┐                                         │
│                         │   TASK      │                                         │
│                         │   INPUT     │                                         │
│                         └──────┬──────┘                                         │
│                                │                                                │
│                                ▼                                                │
│                    ┌───────────────────────┐                                    │
│                    │    ROUTER DECIDES     │                                    │
│                    │    Which model?       │                                    │
│                    └───────────┬───────────┘                                    │
│                                │                                                │
│              ┌─────────────────┴─────────────────┐                              │
│              │                                   │                              │
│              ▼                                   ▼                              │
│   ┌─────────────────────┐             ┌─────────────────────┐                  │
│   │     QWEN 2.5 3B     │             │    LLAMA 3.2 3B     │                  │
│   │                     │             │                     │                  │
│   │  Complex tasks:     │             │  Fast tasks:        │                  │
│   │  • extraction       │             │  • is_product_page  │                  │
│   │  • sentiment        │             │  • spam_check       │                  │
│   │  • summarization    │             │  • language_detect  │                  │
│   │  • recommendation   │             │  • quick_classify   │                  │
│   │                     │             │                     │                  │
│   └─────────────────────┘             └─────────────────────┘                  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

ROUTING RULES:
┌────────────────────────┬─────────────────┬─────────────────────────────────────┐
│ Task Type              │ Model           │ Reason                              │
├────────────────────────┼─────────────────┼─────────────────────────────────────┤
│ product_extraction     │ Qwen 2.5 3B     │ Needs reliable JSON output          │
│ review_sentiment       │ Qwen 2.5 3B     │ Nuanced analysis required           │
│ review_summary         │ Qwen 2.5 3B     │ Complex generation                  │
│ recommendation_reason  │ Qwen 2.5 3B     │ Reasoning required                  │
├────────────────────────┼─────────────────┼─────────────────────────────────────┤
│ is_product_page        │ Llama 3.2 3B    │ Binary classification (fast)        │
│ spam_filter            │ Llama 3.2 3B    │ Simple yes/no                       │
│ language_detect        │ Llama 3.2 3B    │ Quick check                         │
│ price_quick_check      │ Llama 3.2 3B    │ Simple extraction                   │
└────────────────────────┴─────────────────┴─────────────────────────────────────┘
```

---

## Build Order Flow

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║   PHASE 1                    PHASE 2                    PHASE 3              ║
║   ────────                   ────────                   ────────             ║
║                                                                               ║
║   ┌─────────────┐           ┌─────────────┐           ┌─────────────┐        ║
║   │ DUAL MODEL  │           │             │           │             │        ║
║   │   LAYER     │    ──▶    │     RAG     │    ──▶    │   SCRAPER   │        ║
║   │             │           │             │           │             │        ║
║   │ Qwen 2.5 3B │           │  The Memory │           │  The Eyes   │        ║
║   │ Llama 3.2 3B│           │             │           │             │        ║
║   └─────────────┘           └─────────────┘           └─────────────┘        ║
║         │                         │                         │                ║
║         ▼                         ▼                         ▼                ║
║   • Download models         • Embeddings            • Playwright             ║
║   • Model loader            • ChromaDB              • HTML distiller         ║
║   • Router logic            • Indexer               • Site extractors        ║
║   • Inference engine        • Retriever             • Anti-bot handling      ║
║                                                                               ║
║   Week 1                    Week 2                    Week 3                 ║
║                                                                               ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   PHASE 4                    PHASE 5                    PHASE 6              ║
║   ────────                   ────────                   ────────             ║
║                                                                               ║
║   ┌─────────────┐           ┌─────────────┐           ┌─────────────┐        ║
║   │             │           │             │           │             │        ║
║   │ FINE-TUNING │    ──▶    │    TASKS    │    ──▶    │   AGENTS    │        ║
║   │             │           │             │           │             │        ║
║   │  Training   │           │  The Skills │           │ The Workers │        ║
║   │             │           │             │           │             │        ║
║   └─────────────┘           └─────────────┘           └─────────────┘        ║
║         │                         │                         │                ║
║         ▼                         ▼                         ▼                ║
║   • Collect data            • Extraction            • Misc Agent             ║
║   • Label examples          • Sentiment             • Review Agent           ║
║   • QLoRA on Qwen           • Summarization         • Recommend Agent        ║
║   • Evaluation              • Recommendation        • Orchestration          ║
║                                                                               ║
║   Week 4-5                  Week 6                    Week 7+                ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## Detailed Component Breakdown

### 1️⃣ DUAL MODEL LAYER — The Brain(s)


```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DUAL MODEL LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐  │
│   │                         MODEL MANAGER                                    │  │
│   │                                                                          │  │
│   │   Handles loading, routing, and inference for both models               │  │
│   │                                                                          │  │
│   │   ┌─────────────────────┐         ┌─────────────────────┐               │  │
│   │   │    QWEN 2.5 3B      │         │    LLAMA 3.2 3B     │               │  │
│   │   │    (Q4_K_M)         │         │    (Q4_K_M)         │               │  │
│   │   │                     │         │                     │               │  │
│   │   │  • Complex tasks    │         │  • Fast tasks       │               │  │
│   │   │  • JSON extraction  │         │  • Classification   │               │  │
│   │   │  • Reasoning        │         │  • Quick checks     │               │  │
│   │   │                     │         │                     │               │  │
│   │   │  VRAM: ~2GB         │         │  VRAM: ~2GB         │               │  │
│   │   │  Speed: ~55 tok/s   │         │  Speed: ~60 tok/s   │               │  │
│   │   └─────────────────────┘         └─────────────────────┘               │  │
│   │              │                              │                            │  │
│   │              └──────────────┬───────────────┘                            │  │
│   │                             │                                            │  │
│   │                             ▼                                            │  │
│   │                    ┌─────────────────┐                                   │  │
│   │                    │  MODEL ROUTER   │                                   │  │
│   │                    │                 │                                   │  │
│   │                    │  Routes tasks   │                                   │  │
│   │                    │  to best model  │                                   │  │
│   │                    └─────────────────┘                                   │  │
│   │                                                                          │  │
│   └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│  COMPONENTS:                                                                    │
│                                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐              │
│  │   Model Loader   │  │   Model Router   │  │  Inference Engine│              │
│  │                  │  │                  │  │                  │              │
│  │ • Load GGUF      │  │ • Task routing   │  │ • Generate       │              │
│  │ • GPU allocation │  │ • Load balancing │  │ • Stream         │              │
│  │ • Both models    │  │ • Fallback logic │  │ • JSON mode      │              │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘              │
│                                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                                    │
│  │  Prompt Manager  │  │  Response Parser │                                    │
│  │                  │  │                  │                                    │
│  │ • Model-specific │  │ • JSON parsing   │                                    │
│  │ • Task templates │  │ • Validation     │                                    │
│  │ • Context format │  │ • Error handling │                                    │
│  └──────────────────┘  └──────────────────┘                                    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

FILES TO CREATE:
├── slm/
│   ├── models/                  # Model weights directory
│   │   ├── qwen2.5-3b-q4.gguf
│   │   └── llama3.2-3b-q4.gguf
│   ├── model_loader.py          # Load both models
│   ├── model_router.py          # Route tasks to correct model
│   ├── inference.py             # Unified inference interface
│   ├── response_parser.py       # Parse and validate outputs
│   └── prompts/
│       ├── qwen/                # Qwen-specific prompts
│       │   ├── extraction.txt
│       │   ├── sentiment.txt
│       │   └── summary.txt
│       └── llama/               # Llama-specific prompts
│           ├── classify.txt
│           └── quick_check.txt
```

**What it does:** Manages two models, routes tasks intelligently, handles inference.

**Key Innovation:** Task-based routing maximizes quality AND speed.

---

### 2️⃣ RAG (Retrieval-Augmented Generation) — The Memory

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              RAG LAYER                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   QUERY                      RETRIEVE                      AUGMENT              │
│   ─────                      ────────                      ───────              │
│                                                                                 │
│   "Extract Amazon       ──▶  Find similar          ──▶    Inject into          │
│    product info"             examples in DB               model prompt          │
│                                                                                 │
│         │                         │                            │               │
│         ▼                         ▼                            ▼               │
│   ┌──────────────┐         ┌──────────────┐         ┌──────────────┐          │
│   │   Embed      │         │   Search     │         │   Context    │          │
│   │   Query      │   ──▶   │   ChromaDB   │   ──▶   │   Builder    │          │
│   │   [384d]     │         │   Top 5      │         │              │          │
│   └──────────────┘         └──────────────┘         └──────────────┘          │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│  KNOWLEDGE BASE CONTAINS:                                                       │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  📦 Extraction Examples                                                  │   │
│  │     Input: HTML/Markdown → Output: Correct JSON                         │   │
│  │     "Here's how to extract from Amazon, Flipkart, etc."                 │   │
│  ├─────────────────────────────────────────────────────────────────────────┤   │
│  │  🔧 Site-Specific Patterns                                               │   │
│  │     CSS selectors, JSON-LD locations, quirks per site                   │   │
│  │     "Amazon uses .a-price-whole, Flipkart uses ._30jeq3"                │   │
│  ├─────────────────────────────────────────────────────────────────────────┤   │
│  │  📝 Review Analysis Examples                                             │   │
│  │     Fake review patterns, sentiment edge cases                          │   │
│  │     "Reviews with 5 stars but negative text are suspicious"             │   │
│  ├─────────────────────────────────────────────────────────────────────────┤   │
│  │  📚 Domain Knowledge                                                     │   │
│  │     Product categories, common specs, brand info                        │   │
│  │     "Headphones typically have: driver size, impedance, frequency"      │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

FILES TO CREATE:
├── rag/
│   ├── embeddings.py            # sentence-transformers (all-MiniLM-L6-v2)
│   ├── vector_store.py          # ChromaDB wrapper
│   ├── indexer.py               # Add documents to knowledge base
│   ├── retriever.py             # Query similar documents
│   └── knowledge_base/          # Indexed documents
│       ├── extraction_examples/
│       ├── site_patterns/
│       └── domain_knowledge/
```

**What it does:** Stores knowledge, retrieves relevant context to augment model prompts.

**Dependencies:** Embedding model (separate from SLMs)

---

### 3️⃣ SCRAPER — The Eyes

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                             SCRAPER LAYER                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   URL                       FETCH                       DISTILL                 │
│   ───                       ─────                       ───────                 │
│                                                                                 │
│   amazon.com/dp/...    ──▶  Playwright          ──▶    Clean Markdown          │
│                             (headless)                                          │
│                                                                                 │
│         │                        │                           │                  │
│         ▼                        ▼                           ▼                  │
│   ┌──────────────┐        ┌──────────────┐        ┌──────────────┐             │
│   │   Browser    │        │    Page      │        │   HTML →     │             │
│   │   Manager    │  ──▶   │   Content    │  ──▶   │   Markdown   │             │
│   │              │        │              │        │              │             │
│   └──────────────┘        └──────────────┘        └──────────────┘             │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│  EXTRACTION WATERFALL:                                                          │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  TIER 1: JSON-LD (Schema.org)                              Cost: FREE   │   │
│  │  ──────────────────────────────                                         │   │
│  │  Look for <script type="application/ld+json">                           │   │
│  │  Parse @type: Product                                                   │   │
│  │                                                                         │   │
│  │  Found? ──▶ Return immediately                                          │   │
│  │    │                                                                    │   │
│  │    ▼ Not found                                                          │   │
│  ├─────────────────────────────────────────────────────────────────────────┤   │
│  │  TIER 2: CSS Selectors + Heuristics                        Cost: FREE   │   │
│  │  ──────────────────────────────────                                     │   │
│  │  Try known selectors: .price, #product-title, etc.                      │   │
│  │  Score by: currency symbols, position, confidence                       │   │
│  │                                                                         │   │
│  │  High confidence? ──▶ Return                                            │   │
│  │    │                                                                    │   │
│  │    ▼ Low confidence                                                     │   │
│  ├─────────────────────────────────────────────────────────────────────────┤   │
│  │  TIER 3: Qwen 2.5 3B + RAG                                 Cost: GPU    │   │
│  │  ─────────────────────────                                              │   │
│  │  Distill HTML → Markdown                                                │   │
│  │  Retrieve similar examples from RAG                                     │   │
│  │  Send to Qwen for structured extraction                                 │   │
│  │                                                                         │   │
│  │  Always works ──▶ Return                                                │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

FILES TO CREATE:
├── scraper/
│   ├── browser.py               # Playwright browser manager
│   ├── distiller.py             # HTML → Markdown conversion
│   └── extractors/
│       ├── base.py              # Base extractor class
│       ├── universal.py         # JSON-LD + heuristics (Tier 1-2)
│       ├── amazon.py            # Amazon-specific patterns
│       ├── flipkart.py          # Flipkart-specific patterns
│       └── ai_fallback.py       # Qwen + RAG fallback (Tier 3)
```

**What it does:** Fetches web pages, extracts data using waterfall approach.

**Dependencies:** Dual Model Layer + RAG (for AI fallback)

---

### 4️⃣ FINE-TUNING — The Training


```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           FINE-TUNING LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   We fine-tune QWEN 2.5 3B (primary model) for our specific tasks.             │
│   Llama 3.2 3B stays as base model for fast/simple tasks.                      │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐  │
│   │                      FINE-TUNING STRATEGY                                │  │
│   │                                                                          │  │
│   │   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐             │  │
│   │   │   COLLECT   │      │    TRAIN    │      │   DEPLOY    │             │  │
│   │   │    DATA     │ ──▶  │   QLoRA     │ ──▶  │   ADAPTER   │             │  │
│   │   │             │      │             │      │             │             │  │
│   │   │ 500+ pages  │      │ ~2-4 hours  │      │ ~100MB file │             │  │
│   │   │ labeled     │      │ RTX 4060    │      │ merge/load  │             │  │
│   │   └─────────────┘      └─────────────┘      └─────────────┘             │  │
│   │                                                                          │  │
│   └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│  TRAINING DATA FORMAT:                                                          │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  EXTRACTION TASK                                                         │   │
│  │  {                                                                       │   │
│  │    "instruction": "Extract product information from this page.",         │   │
│  │    "input": "# Sony WH-1000XM5\n\nPrice: $348.00\nRating: 4.5/5...",     │   │
│  │    "output": "{\"title\": \"Sony WH-1000XM5\", \"price\": 348.00, ...}"  │   │
│  │  }                                                                       │   │
│  ├─────────────────────────────────────────────────────────────────────────┤   │
│  │  SENTIMENT TASK                                                          │   │
│  │  {                                                                       │   │
│  │    "instruction": "Analyze the sentiment of this review.",               │   │
│  │    "input": "Great product but battery life could be better...",         │   │
│  │    "output": "{\"sentiment\": \"mixed\", \"score\": 0.6, ...}"           │   │
│  │  }                                                                       │   │
│  ├─────────────────────────────────────────────────────────────────────────┤   │
│  │  SUMMARIZATION TASK                                                      │   │
│  │  {                                                                       │   │
│  │    "instruction": "Summarize these reviews into pros and cons.",         │   │
│  │    "input": "[Review 1]...[Review 2]...[Review 3]...",                   │   │
│  │    "output": "{\"pros\": [...], \"cons\": [...], \"summary\": \"...\"}"  │   │
│  │  }                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│  QLoRA CONFIGURATION (RTX 4060 8GB):                                            │
│                                                                                 │
│  lora_config = {                                                                │
│      "r": 16,                    # LoRA rank                                    │
│      "lora_alpha": 32,           # Scaling factor                               │
│      "target_modules": ["q_proj", "v_proj", "k_proj", "o_proj"],               │
│      "lora_dropout": 0.05,                                                      │
│      "bias": "none"                                                             │
│  }                                                                              │
│                                                                                 │
│  training_args = {                                                              │
│      "per_device_train_batch_size": 2,                                          │
│      "gradient_accumulation_steps": 8,    # Effective batch = 16               │
│      "num_train_epochs": 3,                                                     │
│      "learning_rate": 2e-4,                                                     │
│      "fp16": True                          # Mixed precision                   │
│  }                                                                              │
│                                                                                 │
│  TRAINING TIME: ~2-4 hours for 500-1000 examples                               │
│  VRAM USAGE: ~6GB during training                                              │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

FILES TO CREATE:
├── training/
│   ├── data/
│   │   ├── extraction/          # Product extraction examples
│   │   ├── sentiment/           # Review sentiment labels
│   │   └── summarization/       # Summary examples
│   ├── prepare_dataset.py       # Data preprocessing
│   ├── train_qwen_lora.py       # QLoRA training for Qwen
│   ├── merge_adapter.py         # Merge LoRA into base model
│   └── evaluate.py              # Model evaluation
```

**What it does:** Fine-tunes Qwen 2.5 3B for our specific e-commerce tasks.

**Note:** Only fine-tune Qwen (primary). Llama stays as base for fast tasks.

---

### 5️⃣ TASKS — The Skills

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              TASKS LAYER                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Each task is a complete pipeline that uses the right model:                   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                      EXTRACTION TASK (Qwen)                              │   │
│  │                                                                          │   │
│  │   URL ──▶ Scraper ──▶ RAG ──▶ QWEN 2.5 3B ──▶ JSON Output               │   │
│  │                                                                          │   │
│  │   Uses: Qwen (best at structured JSON)                                   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                      SENTIMENT TASK (Qwen)                               │   │
│  │                                                                          │   │
│  │   Reviews ──▶ Batch ──▶ QWEN 2.5 3B ──▶ Sentiment Scores                │   │
│  │                                                                          │   │
│  │   Uses: Qwen (nuanced analysis)                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                    SUMMARIZATION TASK (Qwen)                             │   │
│  │                                                                          │   │
│  │   Reviews ──▶ Chunk ──▶ QWEN 2.5 3B ──▶ Pros/Cons/Summary               │   │
│  │                                                                          │   │
│  │   Uses: Qwen (complex generation)                                        │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                   RECOMMENDATION TASK (Qwen + Embeddings)                │   │
│  │                                                                          │   │
│  │   Product ──▶ Embed ──▶ Vector Search ──▶ Similar Products              │   │
│  │                                                                          │   │
│  │   Uses: Embedding model + Qwen for reasoning                             │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                    CLASSIFICATION TASK (Llama)                           │   │
│  │                                                                          │   │
│  │   Page ──▶ LLAMA 3.2 3B ──▶ is_product_page? / spam? / language?        │   │
│  │                                                                          │   │
│  │   Uses: Llama (fast binary decisions)                                    │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

FILES TO CREATE:
├── tasks/
│   ├── extraction.py            # Product extraction (Qwen)
│   ├── sentiment.py             # Review sentiment (Qwen)
│   ├── summarization.py         # Review summaries (Qwen)
│   ├── recommendation.py        # Similar products (Qwen + Embeddings)
│   └── classification.py        # Quick checks (Llama)
```

**What it does:** Complete pipelines for each capability, using the right model.

---

### 6️⃣ AGENTS — The Workers

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              AGENTS LAYER                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Agents orchestrate multiple tasks using BOTH models:                          │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         MISC AGENT                                       │   │
│  │                                                                          │   │
│  │  "Find best price for iPhone 15"                                         │   │
│  │                                                                          │   │
│  │   1. [Llama] Quick check: Is this a product page?                        │   │
│  │   2. [Qwen]  Extract product info from current page                      │   │
│  │   3. [Llama] Classify: Which competitor sites to check?                  │   │
│  │   4. [Qwen]  Extract prices from each competitor                         │   │
│  │   5. [Qwen]  Compare and recommend best deal                             │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        REVIEW AGENT                                      │   │
│  │                                                                          │   │
│  │  "Analyze reviews for this product"                                      │   │
│  │                                                                          │   │
│  │   1. [Llama] Quick filter: Remove spam reviews                           │   │
│  │   2. [Qwen]  Analyze sentiment for each review                           │   │
│  │   3. [Qwen]  Detect fake review patterns                                 │   │
│  │   4. [Qwen]  Generate trust score                                        │   │
│  │   5. [Qwen]  Summarize into pros/cons                                    │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                     RECOMMENDATION AGENT                                 │   │
│  │                                                                          │   │
│  │  "Find similar products"                                                 │   │
│  │                                                                          │   │
│  │   1. [Qwen]  Extract current product features                            │   │
│  │   2. [Embed] Generate product embedding                                  │   │
│  │   3. [RAG]   Search vector DB for similar                                │   │
│  │   4. [Llama] Quick filter: Remove irrelevant results                     │   │
│  │   5. [Qwen]  Rank and explain recommendations                            │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

FILES TO CREATE:
├── agents/
│   ├── base.py                  # Base agent class
│   ├── misc_agent.py            # Price comparison agent
│   ├── review_agent.py          # Review analysis agent
│   └── recommend_agent.py       # Recommendation agent
```

**What it does:** High-level orchestration using both models strategically.

---

## Complete Data Flow (Dual Model)


```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE SYSTEM FLOW (DUAL MODEL)                            │
└─────────────────────────────────────────────────────────────────────────────────┘

USER REQUEST: "Analyze this Amazon product page"
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: QUICK CHECK (Llama 3.2 3B — Fast)                                      │
│  ─────────────────────────────────────────                                      │
│                                                                                 │
│  Input: URL                                                                     │
│  Model: LLAMA 3.2 3B                                                            │
│  Task: "Is this a product page?"                                                │
│  Output: true/false                                                             │
│  Time: ~100ms                                                                   │
│                                                                                 │
│  ✓ Yes, it's a product page → Continue                                         │
└─────────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: SCRAPE & DISTILL                                                       │
│  ────────────────────────                                                       │
│                                                                                 │
│  URL ──▶ Playwright ──▶ Raw HTML ──▶ Distiller ──▶ Clean Markdown              │
│                                                                                 │
│  Output: "# Sony WH-1000XM5\n\nPrice: $348.00\nRating: 4.5/5..."               │
│  Time: ~2-3 seconds                                                             │
└─────────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: RETRIEVE CONTEXT (RAG)                                                 │
│  ──────────────────────────────                                                 │
│                                                                                 │
│  Query: "Extract product from Amazon"                                           │
│  Model: Embedding (all-MiniLM-L6-v2)                                            │
│                                                                                 │
│  Retrieved:                                                                     │
│  • "Amazon extraction example #1" (0.92 similarity)                             │
│  • "Amazon CSS selectors" (0.87 similarity)                                     │
│  • "Price extraction pattern" (0.85 similarity)                                 │
│                                                                                 │
│  Time: ~50ms                                                                    │
└─────────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: EXTRACT PRODUCT (Qwen 2.5 3B — Quality)                                │
│  ───────────────────────────────────────────────                                │
│                                                                                 │
│  Model: QWEN 2.5 3B                                                             │
│  Input: Distilled markdown + RAG context                                        │
│  Task: Structured JSON extraction                                               │
│                                                                                 │
│  Output: {                                                                      │
│    "title": "Sony WH-1000XM5 Wireless Noise Canceling Headphones",             │
│    "price": 348.00,                                                             │
│    "currency": "USD",                                                           │
│    "rating": 4.5,                                                               │
│    "review_count": 12847,                                                       │
│    "availability": true                                                         │
│  }                                                                              │
│                                                                                 │
│  Time: ~1-2 seconds                                                             │
└─────────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  STEP 5: ANALYZE REVIEWS (Qwen 2.5 3B — Quality)                                │
│  ───────────────────────────────────────────────                                │
│                                                                                 │
│  Model: QWEN 2.5 3B                                                             │
│  Input: Scraped reviews (batched)                                               │
│  Tasks: Sentiment + Fake detection + Summary                                    │
│                                                                                 │
│  Output: {                                                                      │
│    "sentiment": {"positive": 72, "neutral": 18, "negative": 10},               │
│    "trust_score": 0.85,                                                         │
│    "pros": ["Great sound quality", "Comfortable fit"],                         │
│    "cons": ["Expensive", "Case is bulky"],                                     │
│    "summary": "Highly rated premium headphones with excellent ANC..."          │
│  }                                                                              │
│                                                                                 │
│  Time: ~3-5 seconds                                                             │
└─────────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  STEP 6: STORE & RETURN                                                         │
│  ──────────────────────                                                         │
│                                                                                 │
│  • Cache response for future queries                                            │
│  • Store product embedding in vector DB (for recommendations)                   │
│  • Return structured data to user/extension                                     │
│                                                                                 │
│  TOTAL TIME: ~7-10 seconds (first request)                                      │
│  CACHED TIME: ~100ms (subsequent requests)                                      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Dependency Graph

```
                    ┌─────────────────────────┐
                    │                         │
                    │   1. DUAL MODEL LAYER   │  ◀── START HERE
                    │                         │
                    │   ┌─────────────────┐   │
                    │   │  Qwen 2.5 3B    │   │
                    │   │  (Primary)      │   │
                    │   └─────────────────┘   │
                    │   ┌─────────────────┐   │
                    │   │  Llama 3.2 3B   │   │
                    │   │  (Secondary)    │   │
                    │   └─────────────────┘   │
                    │                         │
                    └────────────┬────────────┘
                                 │
                                 │ depends on
                                 ▼
                    ┌─────────────────────────┐
                    │                         │
                    │        2. RAG           │
                    │      (The Memory)       │
                    │                         │
                    └────────────┬────────────┘
                                 │
                                 │ depends on
                                 ▼
                    ┌─────────────────────────┐
                    │                         │
                    │      3. SCRAPER         │
                    │      (The Eyes)         │
                    │                         │
                    └────────────┬────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              │                                     │
              ▼                                     ▼
     ┌─────────────────────┐             ┌─────────────────────┐
     │                     │             │                     │
     │   4. FINE-TUNING    │             │      5. TASKS       │
     │   (Train Qwen)      │             │     (Skills)        │
     │                     │             │                     │
     └──────────┬──────────┘             └──────────┬──────────┘
                │                                   │
                │         improves                  │
                └──────────────────┬────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────┐
                    │                         │
                    │       6. AGENTS         │
                    │      (Workers)          │
                    │                         │
                    └─────────────────────────┘
```

---

## Week-by-Week Plan (Dual Model)

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  WEEK 1: DUAL MODEL FOUNDATION                                                ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  Day 1-2: Environment Setup                                                   ║
║  ├── Install Python 3.11, CUDA 12.x                                           ║
║  ├── Create virtual environment                                               ║
║  ├── Install PyTorch + llama-cpp-python                                       ║
║  └── Verify GPU detection                                                     ║
║                                                                               ║
║  Day 3-4: Download & Load Models                                              ║
║  ├── Download Qwen 2.5 3B Q4_K_M (~2GB)                                       ║
║  ├── Download Llama 3.2 3B Q4_K_M (~2GB)                                      ║
║  ├── Implement model_loader.py (load both)                                    ║
║  └── Test both models can run simultaneously                                  ║
║                                                                               ║
║  Day 5-6: Model Router                                                        ║
║  ├── Implement model_router.py                                                ║
║  ├── Define routing rules (which task → which model)                          ║
║  └── Test routing logic                                                       ║
║                                                                               ║
║  Day 7: Inference Engine                                                      ║
║  ├── Implement inference.py (unified interface)                               ║
║  ├── Create prompt templates for both models                                  ║
║  └── Test JSON output mode                                                    ║
║                                                                               ║
║  ✅ MILESTONE: Both models loaded, router working, can generate JSON          ║
║                                                                               ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  WEEK 2: RAG PIPELINE                                                         ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  Day 1-2: Embeddings                                                          ║
║  ├── Install sentence-transformers                                            ║
║  ├── Implement embeddings.py (all-MiniLM-L6-v2)                               ║
║  └── Test embedding generation                                                ║
║                                                                               ║
║  Day 3-4: Vector Store                                                        ║
║  ├── Install ChromaDB                                                         ║
║  ├── Implement vector_store.py                                                ║
║  └── Implement indexer.py                                                     ║
║                                                                               ║
║  Day 5-6: Knowledge Base                                                      ║
║  ├── Create initial extraction examples                                       ║
║  ├── Add site-specific patterns (Amazon, Flipkart)                            ║
║  └── Index into ChromaDB                                                      ║
║                                                                               ║
║  Day 7: Retrieval + Integration                                               ║
║  ├── Implement retriever.py                                                   ║
║  ├── Connect RAG to Qwen                                                      ║
║  └── Test RAG-augmented extraction                                            ║
║                                                                               ║
║  ✅ MILESTONE: RAG retrieves context, improves Qwen extraction                ║
║                                                                               ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  WEEK 3: SCRAPER ENGINE                                                       ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  Day 1-2: Browser Automation                                                  ║
║  ├── Install Playwright                                                       ║
║  ├── Implement browser.py                                                     ║
║  └── Test page fetching (handle JS-heavy sites)                               ║
║                                                                               ║
║  Day 3-4: HTML Distillation                                                   ║
║  ├── Implement distiller.py                                                   ║
║  ├── HTML → Markdown conversion                                               ║
║  ├── Remove noise (scripts, styles, nav)                                      ║
║  └── Test on Amazon, Flipkart, etc.                                           ║
║                                                                               ║
║  Day 5-6: Extraction Waterfall                                                ║
║  ├── Implement universal.py (JSON-LD + heuristics)                            ║
║  ├── Implement ai_fallback.py (Qwen + RAG)                                    ║
║  └── Test waterfall: Tier 1 → Tier 2 → Tier 3                                 ║
║                                                                               ║
║  Day 7: Site-Specific Extractors                                              ║
║  ├── Implement amazon.py                                                      ║
║  ├── Implement flipkart.py                                                    ║
║  └── Test extraction accuracy                                                 ║
║                                                                               ║
║  ✅ MILESTONE: Can scrape and extract from product pages                      ║
║                                                                               ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  WEEK 4-5: FINE-TUNING QWEN                                                   ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  Week 4 Day 1-3: Data Collection                                              ║
║  ├── Scrape 500+ product pages (diverse sites)                                ║
║  ├── Use universal extractor to get initial data                              ║
║  └── Store raw HTML + extracted JSON pairs                                    ║
║                                                                               ║
║  Week 4 Day 4-7: Data Labeling                                                ║
║  ├── Review and correct extracted JSON                                        ║
║  ├── Add edge cases (missing prices, weird formats)                           ║
║  └── Format as instruction-input-output triples                               ║
║                                                                               ║
║  Week 5 Day 1-2: Training Setup                                               ║
║  ├── Implement prepare_dataset.py                                             ║
║  ├── Implement train_qwen_lora.py                                             ║
║  └── Test training loop (small batch)                                         ║
║                                                                               ║
║  Week 5 Day 3-4: Training                                                     ║
║  ├── Run QLoRA training on Qwen 2.5 3B                                        ║
║  ├── Monitor loss curves                                                      ║
║  └── ~2-4 hours on RTX 4060                                                   ║
║                                                                               ║
║  Week 5 Day 5-7: Evaluation                                                   ║
║  ├── Implement evaluate.py                                                    ║
║  ├── Test on held-out data                                                    ║
║  ├── Compare: base Qwen vs fine-tuned Qwen                                    ║
║  └── Iterate if accuracy < 90%                                                ║
║                                                                               ║
║  ✅ MILESTONE: Fine-tuned Qwen with >90% extraction accuracy                  ║
║                                                                               ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  WEEK 6: TASK PIPELINES                                                       ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  Day 1-2: Extraction Task                                                     ║
║  ├── Implement extraction.py                                                  ║
║  ├── End-to-end: URL → JSON                                                   ║
║  └── Uses: Scraper + RAG + Qwen                                               ║
║                                                                               ║
║  Day 3: Classification Task                                                   ║
║  ├── Implement classification.py                                              ║
║  ├── Quick checks: is_product_page, spam_filter                               ║
║  └── Uses: Llama (fast)                                                       ║
║                                                                               ║
║  Day 4-5: Sentiment Task                                                      ║
║  ├── Implement sentiment.py                                                   ║
║  ├── Review batch → sentiment scores                                          ║
║  └── Uses: Qwen (nuanced)                                                     ║
║                                                                               ║
║  Day 6: Summarization Task                                                    ║
║  ├── Implement summarization.py                                               ║
║  ├── Reviews → pros/cons/summary                                              ║
║  └── Uses: Qwen (complex generation)                                          ║
║                                                                               ║
║  Day 7: Recommendation Task                                                   ║
║  ├── Implement recommendation.py                                              ║
║  ├── Product → similar products                                               ║
║  └── Uses: Embeddings + RAG + Qwen                                            ║
║                                                                               ║
║  ✅ MILESTONE: All task pipelines working                                     ║
║                                                                               ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  WEEK 7+: AGENTS & OPTIMIZATION                                               ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  Agents:                                                                      ║
║  ├── Implement base.py (base agent class)                                     ║
║  ├── Implement misc_agent.py (price comparison)                               ║
║  ├── Implement review_agent.py (review analysis)                              ║
║  └── Implement recommend_agent.py (recommendations)                           ║
║                                                                               ║
║  Optimization:                                                                ║
║  ├── Response caching (Redis or local)                                        ║
║  ├── Batch processing for reviews                                             ║
║  ├── Model warm-up (keep loaded)                                              ║
║  └── Error handling + retries                                                 ║
║                                                                               ║
║  Integration:                                                                 ║
║  ├── API endpoints (FastAPI)                                                  ║
║  └── Extension integration                                                    ║
║                                                                               ║
║  ✅ MILESTONE: Production-ready system                                        ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## Project Structure (Final)

```
Pickscraper/
│
├── 📁 docs/
│   ├── ARCHITECTURE.md          # System architecture
│   └── BUILD_ROADMAP.md         # This document
│
├── 📁 slm/                      # Dual Model Layer
│   ├── 📁 models/               # Model weights
│   │   ├── qwen2.5-3b-q4.gguf   # Primary model (~2GB)
│   │   └── llama3.2-3b-q4.gguf  # Secondary model (~2GB)
│   ├── model_loader.py          # Load both models
│   ├── model_router.py          # Route tasks to correct model
│   ├── inference.py             # Unified inference interface
│   ├── response_parser.py       # Parse and validate outputs
│   └── 📁 prompts/
│       ├── 📁 qwen/             # Qwen-specific prompts
│       │   ├── extraction.txt
│       │   ├── sentiment.txt
│       │   └── summary.txt
│       └── 📁 llama/            # Llama-specific prompts
│           ├── classify.txt
│           └── quick_check.txt
│
├── 📁 rag/                      # RAG Layer
│   ├── embeddings.py            # sentence-transformers
│   ├── vector_store.py          # ChromaDB wrapper
│   ├── indexer.py               # Add docs to knowledge base
│   ├── retriever.py             # Query similar docs
│   └── 📁 knowledge_base/       # Indexed documents
│
├── 📁 scraper/                  # Scraper Layer
│   ├── browser.py               # Playwright manager
│   ├── distiller.py             # HTML → Markdown
│   └── 📁 extractors/
│       ├── base.py              # Base extractor
│       ├── universal.py         # JSON-LD + heuristics
│       ├── amazon.py            # Amazon-specific
│       ├── flipkart.py          # Flipkart-specific
│       └── ai_fallback.py       # Qwen + RAG fallback
│
├── 📁 tasks/                    # Task Pipelines
│   ├── extraction.py            # Product extraction (Qwen)
│   ├── sentiment.py             # Review sentiment (Qwen)
│   ├── summarization.py         # Review summaries (Qwen)
│   ├── recommendation.py        # Similar products (Qwen)
│   └── classification.py        # Quick checks (Llama)
│
├── 📁 agents/                   # Agent Layer
│   ├── base.py                  # Base agent class
│   ├── misc_agent.py            # Price comparison
│   ├── review_agent.py          # Review analysis
│   └── recommend_agent.py       # Recommendations
│
├── 📁 training/                 # Fine-Tuning
│   ├── 📁 data/
│   │   ├── extraction/
│   │   ├── sentiment/
│   │   └── summarization/
│   ├── prepare_dataset.py
│   ├── train_qwen_lora.py       # Train Qwen only
│   ├── merge_adapter.py
│   └── evaluate.py
│
├── 📁 storage/                  # Persistence
│   ├── cache.py                 # Response caching
│   └── 📁 data/
│
├── 📁 config/
│   ├── settings.py
│   └── model_config.yaml
│
├── requirements.txt
└── README.md
```

---

## Summary: Dual Model Strategy

| Model | Role | Tasks | VRAM | Speed |
|-------|------|-------|------|-------|
| **Qwen 2.5 3B** | Primary | Extraction, Sentiment, Summary, Reasoning | ~2GB | ~55 tok/s |
| **Llama 3.2 3B** | Secondary | Classification, Quick checks, Fallback | ~2GB | ~60 tok/s |
| **Combined** | — | All tasks optimized | ~4GB | Best of both |

**Why This Works:**
- Total VRAM: ~4GB (half of your 8GB capacity)
- Qwen handles quality-critical tasks (JSON, reasoning)
- Llama handles speed-critical tasks (classification, filtering)
- Both have 128K context windows
- Both are Apache 2.0 licensed

**End Result:** A fully self-hosted AI system that:
- Extracts product data with >90% accuracy
- Analyzes reviews for sentiment and fake detection
- Summarizes reviews into pros/cons
- Recommends similar products
- Compares prices across sites
- All without external API dependencies 🚀

---

*Ready to start? Week 1: Set up environment and load both models.*
