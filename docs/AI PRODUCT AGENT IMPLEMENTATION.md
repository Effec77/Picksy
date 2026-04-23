# Architectural Blueprint and Technical Implementation Strategy for Picksy AI: A Scalable, Zero-Cost E-Commerce Intelligence Platform

## 1\. Executive Summary

The contemporary e-commerce landscape is defined by a profound information asymmetry. While retailers deploy sophisticated algorithmic pricing, behavioral analytics, and automated inventory management, consumers are largely relegated to manual comparison and fragmented information gathering. This disparity creates a market opportunity for intelligent, client-side agents capable of leveling the playing field. Picksy AI aims to fill this void by deploying a comprehensive browser extension that orchestrates three distinct intelligent agents—the Misc Agent for extraction, the Review Agent for analysis, and the Recommendation Agent for discovery.

The primary engineering challenge detailed in this report is the construction of a "flawless" integrated system that operates within a strictly zero-fund constraint while retaining the capacity for infinite scale. Achieving this requires a radical departure from traditional server-centric architectures. Instead of relying on capital-intensive residential proxies and heavy backend scraping fleets, Picksy AI adopts a distributed computing paradigm where the user's browser serves as the primary edge node, supported by a lightweight, serverless infrastructure leveraging the free tiers of enterprise-grade providers.

This document serves as the definitive technical roadmap for the implementation of the Picksy ecosystem. It provides an exhaustive analysis of the system architecture, detailing the integration of Google’s Gemini 1.5 Flash for high-throughput cognitive processing, Supabase for vector-based persistence, and Cloudflare Workers for secure edge proxying. By rigorously adhering to a serverless, event-driven design, the proposed architecture allows the platform to scale to tens of thousands of active users without incurring operational costs, establishing a sustainable pathway to monetization through affiliate aggregation and premium data insights. The following sections dismantle the complexity of "flawless" AI integration, offering granular solutions for DOM distillation, vector similarity search, and privacy-preserving personalization within the constraints of Chrome’s Manifest V3.

## 2\. Architectural Paradigm: The Zero-Cost Distributed Ecosystem

### 2.1. The Financial and Technical Constraints

The requirement to deploy a robust, scalable system with "zero funds" acts as the primary forcing function for all architectural decisions. In a traditional startup environment, capital is deployed to purchase reliability—via managed residential proxies to bypass IP blocks, EC2 instances for reliable scraping, and paid APIs for sentiment analysis. For a student project aiming for commercial viability, these costs are prohibitive.

Therefore, the architecture must invert the traditional model. Instead of centralized scraping, the system must utilize **Distributed Client-Side Execution**. Every user who installs the Picksy extension becomes a node in the scraping network, utilizing their own residential IP address and local CPU cycles to fetch and process data. This eliminates the two largest cost centers: proxy bandwidth and compute time. However, client-side execution introduces significant security risks, particularly regarding API key exposure and data integrity. To mitigate this, we introduce a "Thin-Client, Smart-Edge" architecture.1

### 2.2. The Four-Layer Stack

The system is composed of four distinct, loosely coupled layers, each selected for its generous free-tier limits and ability to scale horizontally.

#### 2.2.1. The Execution Layer: Chrome Extension (Manifest V3)

The extension is the operational heart of Picksy AI. It operates within the user's browser, providing direct access to the Document Object Model (DOM) of e-commerce sites.

*   **Role:** User Interface (UI), DOM injection, "Invisible Tab" management, and local state management.
*   **Constraint:** Manifest V3 strictly limits the lifespan of background Service Workers, necessitating an event-driven design where scraping jobs must complete quickly or be persisted to storage.4
*   **Cost:** $0 (Client hardware).

#### 2.2.2. The Security & Proxy Layer: Cloudflare Workers

Directly embedding the Gemini API key in the extension source code is a critical security vulnerability. Cloudflare Workers act as a secure, serverless reverse proxy.

*   **Role:** Request authentication, API key injection, rate limiting, and response caching.
*   **Capacity:** The free tier allows for 100,000 requests per day with a 10ms CPU time limit per request. This is sufficient to support a user base of approximately 2,000-5,000 daily active users (DAU) assuming aggressive caching strategies.5
*   **Cost:** $0 (Up to 100k requests/day).

#### 2.2.3. The Intelligence Layer: Google Gemini 1.5 Flash

The cognitive heavy lifting—parsing unstructured HTML, analyzing review sentiment, and generating embeddings—is offloaded to Google's Gemini API.

*   **Role:** Structure extraction (HTML to JSON), Sentiment Analysis, and Vector Embedding generation.
*   **Selection Logic:** We prioritize **Gemini 1.5 Flash** over the Pro or Ultra variants. Flash is engineered for high-frequency, low-latency tasks and offers a massive context window (1M tokens) with a generous free tier of 15 Requests Per Minute (RPM) and 1,500 Requests Per Day (RPD). This throughput is critical for the Review Agent, which must process bulk text data.8
*   **Cost:** $0 (Within rate limits).

#### 2.2.4. The Persistence Layer: Supabase (PostgreSQL + pgvector)

To enable the Recommendation Agent, the system requires a database capable of storing and querying high-dimensional vector embeddings.

*   **Role:** Long-term storage of product metadata, user interaction logs, and vector similarity search.
*   **Capacity:** The Supabase free tier provides 500MB of database storage. Given that a typical product record with a 768-dimension vector consumes approximately 3-4KB, this capacity supports an index of roughly 125,000 to 150,000 products—ample for the project's growth phase.10
*   **Cost:** $0 (Up to 500MB).

### 2.3. Operational Data Flow

The three agents—Misc, Review, and Recommendation—operate within a unified data pipeline designed to maximize data reuse.

1.  **Trigger:** The user navigates to a product page (e.g., Amazon).
2.  **Identification:** The **Misc Agent** activates, scraping the page to identify the product (Title, Price, Image). It attempts a "Universal Extraction" first, falling back to Gemini via Cloudflare if heuristic parsing fails.1
3.  **Analysis:** Once the product is identified, the **Review Agent** is triggered asynchronously. It spawns an offscreen document to fetch review data, batches the text, and sends it to Gemini for sentiment analysis.
4.  **Indexing:** Simultaneously, the **Recommendation Agent** generates a vector embedding for the product (using Gemini's embedding model) and performs an "upsert" (update or insert) into Supabase. It then queries the database for semantically similar products to display as alternatives.

| Component | Technology | Free Tier Limit | Optimization Strategy |
| --- | --- | --- | --- |
| Compute | Cloudflare Workers | 100k req/day | Caching responses for 24h; Batching review analysis requests. |
| Database | Supabase | 500MB Storage | Pruning old/inactive product data; Storing heavy text (reviews) locally, only vectors remotely. |
| AI Model | Gemini 1.5 Flash | 15 RPM / 1.5k RPD | Token-efficient HTML distillation; Request queuing with leaky-bucket rate limiting. |
| Scraping | Chrome Extension | Unlimited | Using "Invisible Tabs" and chrome.offscreen to utilize client bandwidth. |

## 3\. Agent 1: The Misc Agent – Advanced Extraction Engineering

The Misc Agent is the foundation of the Picksy system. While the current implementation boasts a 90% success rate using "Universal Extraction," achieving "flawless" performance requires a robust fallback mechanism for the 10% of edge cases where DOM structures are non-standard or obfuscated by dynamic JavaScript.

### 3.1. The Hybrid Extraction Logic: Waterfall Methodology

The extraction logic follows a "waterfall" pattern, prioritizing speed and low cost before escalating to computationally expensive AI methods.

1.  Tier 1: Metadata & Microdata (0ms Latency)  
    The script first queries the DOM for structured metadata. Modern e-commerce sites heavily utilize Schema.org microdata for SEO. The scraper looks for application/ld+json script tags.
    *   _Action:_ Parse JSON-LD looking for @type: Product.
    *   _Reliability:_ Extremely high for price and title; moderate for availability.
    *   _Cost:_ Zero.
2.  Tier 2: Semantic Selectors & Heuristics (~50ms Latency)  
    If metadata is missing, the script traverses the DOM using a list of high-probability selectors (e.g., .price, #product-price, \[data-test-id="price"\]).
    *   _Algorithm:_ It employs a weighted scoring system. A node containing a currency symbol ($, ₹) and a numeric value, located near the top of the visual viewport (calculated via getBoundingClientRect), receives a high probability score.
    *   _Cost:_ Zero.
3.  Tier 3: The AI Fallback (The "Smart" Layer)  
    When Tiers 1 and 2 fail (return null or low confidence scores), the system invokes the Gemini 1.5 Flash API. This is where the "flawless" requirement is met. The challenge here is Context Window Optimization. Sending the entire raw HTML <body> of an Amazon page can easily exceed token limits or introduce noise that confuses the model.12

### 3.2. DOM Distillation and Token Optimization

To use Gemini efficiently, we must "distill" the webpage into a lightweight representation that retains semantic structure but discards noise.

**The Distillation Algorithm:**

1.  **Tree Traversal:** The content script performs a Depth-First Search (DFS) of the DOM.
2.  **Node Pruning:** It aggressively removes non-content nodes: <script>, <style>, <svg>, <canvas>, <iframe, <footer, <nav>, and hidden elements (display: none).
3.  **Attribute Stripping:** It strips all attributes _except_ those with semantic value: id, class (filtered for keywords like 'price', 'title', 'header'), itemprop, and aria-label.
4.  **Markdown Conversion:** The remaining simplified DOM is converted into Markdown. Markdown is far more token-efficient than HTML (often a 40-60% reduction) and is naturally understood by LLMs.14

**Example Distilled Input:**

# Sony WH-1000XM5 Wireless Noise Canceling Headphones

Price: $348.00

Status: In Stock

Description: Industry-leading noise cancellation...

This distilled payload is sent to the Cloudflare Worker, which forwards it to Gemini with a strict system instruction.

### 3.3. Prompt Engineering for Structured JSON

To ensure the output is machine-readable and "flawless," we must force Gemini to output strict JSON, bypassing its tendency to add conversational filler ("Here is the data you requested...").

System Prompt Strategy:

We utilize Gemini's Structured Output (JSON Mode) capabilities. The prompt explicitly defines the schema.

*   **System Instruction:** "You are a precise data extraction engine. You will receive a Markdown representation of a product page. Your task is to extract the product details into valid JSON. If a field is missing, return null. Do not invent data."
*   **Schema Definition:**  
    JSON  
    {  
    "type": "object",  
    "properties": {  
    "title": { "type": "string" },  
    "current\_price": { "type": "number" },  
    "original\_price": { "type": "number" },  
    "currency": { "type": "string", "enum": },  
    "availability": { "type": "boolean" },  
    "rating": { "type": "number" },  
    "review\_count": { "type": "integer" }  
    },  
    "required": \["title", "current\_price"\]  
    }  
    

By enforcing this schema, the Misc Agent guarantees that the data passed to the Recommendation Agent is normalized and type-safe, eliminating downstream errors.16

### 3.4. Invisible Tab Management & Batch Processing

The Misc Agent must compare prices across 12+ sites. Opening 12 tabs simultaneously would crash the user's browser. The solution is a **Queued Batch Processor**.

*   **Concurrency Control:** The background service worker maintains a queue of URLs to scrape. It utilizes a semaphore pattern to allow only 3 concurrent "invisible" tabs.
*   **Invisible Tab Logic:** In Manifest V3, we cannot easily create hidden background pages. Instead, we use chrome.tabs.create({ active: false }) to open a tab in the background.
*   **Lifecycle Management:**
    1.  Create Tab (Inactive).
    2.  Inject Content Script.
    3.  Wait for Message (Data or Timeout).
    4.  **Crucial Step:** Immediately close the tab (chrome.tabs.remove) upon data receipt to free memory.
    5.  **Timeout:** If no response is received within 30 seconds, the tab is killed, and the site is marked as "Unreachable" to prevent hanging the queue.1

## 4\. Agent 2: The Review Agent – Sentiment & Trust Analysis

The Review Agent elevates Picksy from a simple price tracker to a decision-support tool. Its implementation is complex due to the sheer volume of text data involved in reviews and the necessity of detecting manipulation (fake reviews).

### 4.1. Cross-Platform Data Aggregation

To provide a holistic view, the agent must aggregate reviews not just from the current product page, but from trusted third-party sources (Reddit, Trustpilot, YouTube).

Discovery Mechanism:

Once the Misc Agent identifies the product (e.g., "Bose QC45"), the Review Agent triggers a background search process. It constructs search queries using the "Golden Record" title:

*   site:reddit.com "Bose QC45" review
*   site:trustpilot.com "Bose"
*   site:youtube.com "Bose QC45" review

The agent uses the chrome.offscreen API (a new feature in Manifest V3) to perform these searches and parse the results in a hidden document, ensuring the user's browsing experience is uninterrupted.19

### 4.2. Pagination and Infinite Scroll Strategies

Reviews are rarely loaded on a single page. To get a representative sample, the agent must navigate pagination.

*   **Standard Pagination:** The scraper looks for "Next" buttons or numbered links. It traverses up to 5 pages to gather a statistically significant sample (e.g., ~100 reviews).
*   **Infinite Scroll:** For sites like Twitter or modern e-commerce SPAs, the scraper injects a script that programmatically scrolls the container (window.scrollTo(0, document.body.scrollHeight)). It attaches a MutationObserver to the container to detect when new DOM nodes (reviews) are appended. If no nodes appear after 3 seconds, it assumes the end of the list.20

### 4.3. The "Map-Reduce" Analysis Pipeline

Sending 500 reviews to Gemini individually would instantly exhaust the 15 RPM rate limit. We implement a **Map-Reduce** architecture using Gemini 1.5 Flash's large context window.

Step 1: The "Map" Phase (Batching)

The extension aggregates reviews locally into batches. With a 1M token context window, Gemini 1.5 Flash can theoretically process huge volumes, but latency increases with context size. A sweet spot is ~50 reviews per batch.

The payload sent to the Cloudflare Worker looks like:

JSON

{  
"reviews":  
}  

Step 2: The "Reduce" Phase (AI Processing)

The Cloudflare Worker sends this batch to Gemini with a complex analytical prompt.

*   **Prompt Strategy:** "Analyze the following 50 reviews. Output a JSON summary including: 1. Sentiment distribution (Positive/Neutral/Negative). 2. Top 5 distinct pros. 3. Top 5 distinct cons. 4. A 'Suspicion Score' for potential fake activity."

### 4.4. Algorithmic Fake Review Detection

While Gemini performs semantic analysis, we bolster it with deterministic statistical analysis to detect "botted" patterns.

**Detection Vectors:**

1.  **Temporal Burstiness:** If a disproportionate number of 5-star reviews were posted within a short timeframe (e.g., 48 hours), the system flags this as a "Review Bombing" event.
2.  **Lexical Similarity (Jaccard Index):** The system calculates the similarity between review texts. If multiple reviews share >80% phrasing, they are likely copy-pasted bot spam.
3.  **Sentiment-Rating Divergence:** The AI checks for reviews with negative text ("Product broke immediately") but 5-star ratings—a common tactic to inflate scores while warning humans.
4.  **Trust Score Calculation:** The final Trust Score is a weighted composite:
    *   Trust = (Volume\_Score \* 0.25) + (Distribution\_Score \* 0.25) + (Verified\_Rate \* 0.25) + (Recency\_Score \* 0.25).1

This multi-layered approach ensures that the "Trust Score" displayed to the user is mathematically grounded, not just an AI hallucination.

## 5\. Agent 3: The Recommendation Agent – Vector Search & Personalization

The Recommendation Agent is the engine of discovery and long-term user retention. It moves beyond simple "people also bought" logic to true semantic understanding of products.

### 5.1. Vector Embeddings: The Core Concept

Traditional recommendation systems use collaborative filtering (user behavior matrices), which requires massive user data—something Picksy doesn't have at launch. Instead, we use **Content-Based Filtering** via **Vector Embeddings**.

An embedding converts a product (Title + Description + Specs) into a vector of floating-point numbers (e.g., \[0.12, -0.45, 0.88,...\]). Products with similar meanings will have vectors that are mathematically close to each other in this multi-dimensional space.22

### 5.2. Implementing the Vector Database with Supabase

We leverage **Supabase** (PostgreSQL) and the open-source pgvector extension. This combination is powerful and free.

**Database Schema Design:**

SQL

\-- Enable the vector extension  
create extension vector;  
  
\-- Products Table: Stores the "Golden Record"  
create table public.products (  
id uuid primary key default uuid\_generate\_v4(),  
title text not null,  
description text,  
url text unique not null,  
image\_url text,  
price numeric,  
\-- 768 dimensions matches the output of Gemini's 'text-embedding-004' model  
embedding vector(768),  
created\_at timestamptz default now()  
);  
  
\-- Indexing for Performance  
\-- IVFFlat is used here as it is memory-efficient and suitable for the free tier constraints  
create index on public.products using ivfflat (embedding vector\_cosine\_ops)  
with (lists = 100);  

This schema allows us to store the product metadata alongside its semantic meaning. The IVFFlat index ensures that similarity queries remain fast (sub-100ms) even as the table grows to thousands of rows.24

### 5.3. The Embedding Pipeline

1.  **Generation:** When the Misc Agent scrapes a product, the extension sends the text data to the Cloudflare Worker.
2.  **Proxy:** The Worker calls Gemini's models/text-embedding-004. This model is chosen for its balance of performance and dimension size (768 dimensions is efficient for storage).22
3.  **Storage:** The Worker upserts the resulting vector and product metadata into Supabase.

### 5.4. Privacy-First "Local" Recommendations

A key requirement is maintaining user trust. We implement a **Local-First Personalization** architecture.

*   **User Profile Vector:** The extension maintains a "User Interest Vector" in chrome.storage.local. This vector is the mathematical average (centroid) of the embeddings of the last 50 products the user has visited.
*   **Privacy:** This User Vector never leaves the client (except to query for matches). The centralized database does _not_ store a history of "User X viewed Product Y." It only knows that _someone_ queried for products similar to Vector Z.
*   **Query Logic:** When the user opens the extension, it sends the _User Interest Vector_ to Supabase. Supabase performs a similarity search using the <=> (cosine distance) operator and returns products that match the user's aggregate taste.

SQL

\-- Supabase RPC function to find similar products  
create or replace function match\_products (  
query\_embedding vector(768),  
match\_threshold float,  
match\_count int  
)  
returns setof products  
language plpgsql  
as $$  
begin  
return query  
select \*  
from products  
where 1 - (products.embedding <=> query\_embedding) > match\_threshold  
order by products.embedding <=> query\_embedding  
limit match\_count;  
end;  
$$;  

This ensures high relevance without building a surveillance-style tracking database.27

## 6\. Security Infrastructure: The Cloudflare Proxy

The "Zero Funds" requirement necessitates using free tiers, but it does not excuse poor security. The Cloudflare Worker is the gatekeeper of the system.

### 6.1. The Vulnerability

Browser extensions are inherently insecure environments. Any API key stored in content.js or background.js can be viewed by anyone who "Inspects" the extension source. If the Gemini API key were exposed, malicious actors could drain the free quota in seconds, breaking Picksy for all users.

### 6.2. The Proxy Solution

We deploy a Cloudflare Worker to hold the secrets. The extension communicates _only_ with this Worker.

**Implementation Logic:**

1.  **Environment Variables:** The Gemini API Key and Supabase Credentials are stored as encrypted Environment Variables in the Cloudflare Dashboard (wrangler secret put GEMINI\_API\_KEY).
2.  **Request Validation:** The Worker checks the Origin header of the incoming request. While headers can be spoofed outside a browser, within the Chrome Extension environment, the browser enforces the Origin header (e.g., chrome-extension://<id>). The Worker rejects any request not matching the official Extension ID.
3.  **Rate Limiting:** The Worker implements a "Token Bucket" algorithm using Cloudflare's ephemeral state or KV store. It limits each IP address to a reasonable number of requests (e.g., 50 per hour), preventing abuse.

### 6.3. Caching for Efficiency

To maximize the free tier limits of Gemini (1,500 RPD), the Worker implements aggressive caching.

*   **Key Generation:** The cache key is a hash of the request URL and the product ID.
*   **Logic:** If User A requests a review summary for "iPhone 15", the Worker stores the Gemini response in the Cloudflare Cache API for 24 hours. If User B requests the same data, the Worker serves the cached JSON immediately. This saves an API call and reduces latency to milliseconds.9

## 7\. Technical Roadmap: From Code to Launch

This roadmap outlines the sequential execution plan to build the system.

### Phase 1: Foundation & Security (Weeks 1-3)

*   **Infrastructure:** Set up Cloudflare Account and Supabase Project.
*   **Development:**
    *   Write the Cloudflare Worker to proxy Gemini requests.
    *   Implement the aiExtraction.js utility in the extension to route calls through the Worker.
    *   Set up the Supabase database schema and enable pgvector.
*   **Milestone:** Misc Agent successfully extracts data using Gemini via the proxy without exposing keys.

### Phase 2: The Review Agent (Weeks 4-7)

*   **Development:**
    *   Implement chrome.offscreen logic for background review scraping.
    *   Develop the DOM distillation logic to optimize HTML for Gemini.
    *   Create the "Map-Reduce" batching logic for processing reviews.
    *   Integrate the Trust Score algorithm into the UI.
*   **Milestone:** Extension displays a "Trust Score" and "AI Summary" for products on Amazon.

### Phase 3: The Recommendation Engine (Weeks 8-11)

*   **Development:**
    *   Implement the embedding generation pipeline in the Cloudflare Worker.
    *   Write the logic to maintain the "User Interest Vector" in chrome.storage.local.
    *   Create the "Similar Products" UI carousel in the popup.
    *   Wire up the Supabase RPC function for similarity search.
*   **Milestone:** Users see personalized recommendations based on their browsing history.

### Phase 4: Scalability & Monetization (Weeks 12+)

*   **Affiliate Integration:** Update the Misc Agent to append affiliate tags to product URLs found during scraping. This is the primary zero-cost revenue driver.
*   **Optimization:** Implement localStorage caching in the client to reduce hits to the Cloudflare Worker.
*   **Monitoring:** Use Cloudflare Analytics to track API usage and identify bottlenecks before they hit free tier limits.

## 8\. Scalability and Monetization Strategy

### 8.1. Scaling "Zero" to "Millions"

The architecture is designed to scale linearly.

*   **Database:** Supabase's free tier handles ~150k products. As revenue comes in, upgrading to the Pro plan ($25/month) unlocks 8GB storage (millions of products).
*   **Compute:** Cloudflare Workers are effectively infinitely scalable. The cost per million requests after the free tier is negligible ($0.15/million).
*   **Scraping:** Since scraping is distributed to clients, adding 1 million users adds $0 to server-side scraping costs.

### 8.2. Monetization Pathways

1.  **Affiliate Aggregation:** The most immediate revenue source. Picksy acts as a "super-affiliate," ensuring that every purchase made through the extension's comparison tool carries an affiliate tag.
2.  **Premium Insights:** "Pro" users (subscription model) get access to historical price data (stored in Supabase) and "Stock Alerts" (run via Cloudflare Cron Triggers).
3.  **Data Syndication:** Aggregated, anonymized sentiment data on products is valuable to brands. This data can be sold as market intelligence reports.

## 9\. Conclusion

The "Picksy AI" project demonstrates that "flawless" AI integration does not require a flawless budget. By intelligently leveraging the specific strengths of **Cloudflare Workers** (Edge Security & Caching), **Gemini 1.5 Flash** (High-Volume Cognitive Processing), and **Supabase** (Vector Persistence), the architecture circumvents the traditional cost barriers of e-commerce intelligence. The system transforms the user's browser into a powerful edge node, distributing the workload and preserving privacy while centralizing intelligence. This roadmap provides a concrete, engineering-grade path from a student concept to a scalable, revenue-generating platform, proving that in the modern serverless era, architecture—not capital—is the primary determinant of scale.

## 10\. Tables and Data Structures

### Table 1: Free Tier Resource Allocation Strategy

| Component | Provider | Free Tier Limit | Picksy Usage Strategy | Scale Limit |
| --- | --- | --- | --- | --- |
| Edge Compute | Cloudflare Workers | 100,000 req/day | API Proxy, Auth, Caching | ~5,000 DAU |
| Vector DB | Supabase | 500MB Storage | Product Embeddings, Metadata | ~150,000 Products |
| LLM (Text) | Gemini 1.5 Flash | 1,500 RPD | Extraction, Sentiment Analysis | ~1,500 "Deep Scans"/day |
| LLM (Embed) | Gemini Embedding | Free (in AI Studio) | Generating Vectors | Unlimited (High) |
| Scraping | Chrome Client | Unlimited | HTML Parsing, DOM Distillation | Infinite (Distributed) |

### Table 2: Database Schema for Product Persistence

| Column Name | Data Type | Description | Index Type |
| --- | --- | --- | --- |
| id | UUID | Primary Key | B-Tree |
| title | Text | Product Title | - |
| url | Text | Canonical URL (Unique) | B-Tree |
| embedding | Vector(768) | Semantic representation | IVFFlat |
| price | Numeric | Last recorded price | - |
| metadata | JSONB | Flex fields (specs, color) | GIN |
| updated_at | Timestamp | For cache invalidation | - |

### Table 3: Trust Score Weighting Logic

| Factor | Weight | Metric Calculation | Rationale |
| --- | --- | --- | --- |
| Volume | 25% | log(count) / log(threshold) | High volume implies statistical significance. |
| Distribution | 25% | 1 - (abs(skew) * penalty) | Natural reviews follow a normal distribution; extreme skew is suspicious. |
| Verified | 25% | % of Verified Purchase | Directly correlates to authentic experience. |
| Recency | 25% | decay_function(days_since) | Recent reviews reflect the current product state (e.g., batch defects). |

#### Works cited

1.  Complete picksy context.docx
2.  Web Scraper - The #1 web scraping extension, accessed on December 19, 2025, [https://webscraper.io/](https://webscraper.io/)
3.  How I built a zero cost serverless scraper - DEV Community, accessed on December 19, 2025, [https://dev.to/anshaj/how-i-built-a-zero-cost-completely-serverless-scraper-20io](https://dev.to/anshaj/how-i-built-a-zero-cost-completely-serverless-scraper-20io)
4.  Extensions / Manifest V3 - Chrome for Developers, accessed on December 19, 2025, [https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
5.  Limits · Cloudflare Workers KV docs, accessed on December 19, 2025, [https://developers.cloudflare.com/kv/platform/limits/](https://developers.cloudflare.com/kv/platform/limits/)
6.  Pricing · Cloudflare Workers docs, accessed on December 19, 2025, [https://developers.cloudflare.com/workers/platform/pricing/](https://developers.cloudflare.com/workers/platform/pricing/)
7.  Free Plan Overview - Cloudflare, accessed on December 19, 2025, [https://www.cloudflare.com/plans/free/](https://www.cloudflare.com/plans/free/)
8.  Gemini Developer API pricing, accessed on December 19, 2025, [https://ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing)
9.  Rate limits | Gemini API - Google AI for Developers, accessed on December 19, 2025, [https://ai.google.dev/gemini-api/docs/rate-limits](https://ai.google.dev/gemini-api/docs/rate-limits)
10.  Pricing & Fees - Supabase, accessed on December 19, 2025, [https://supabase.com/pricing](https://supabase.com/pricing)
11.  Introducing Vector Buckets - Supabase, accessed on December 19, 2025, [https://supabase.com/blog/vector-buckets](https://supabase.com/blog/vector-buckets)
12.  HTML Preprocessing for LLMs - DEV Community, accessed on December 19, 2025, [https://dev.to/rosgluk/html-preprocessing-for-llms-3mk8](https://dev.to/rosgluk/html-preprocessing-for-llms-3mk8)
13.  Splitting a HTML document for an LLM with limited token size - Stack Overflow, accessed on December 19, 2025, [https://stackoverflow.com/questions/79029041/splitting-a-html-document-for-an-llm-with-limited-token-size](https://stackoverflow.com/questions/79029041/splitting-a-html-document-for-an-llm-with-limited-token-size)
14.  How to Convert HTML to Markdown. TL;DR | by Darshan Khandelwal | Medium, accessed on December 19, 2025, [https://medium.com/@darshankhandelwal12/how-to-convert-html-to-markdown-89d391b4ffc4](https://medium.com/@darshankhandelwal12/how-to-convert-html-to-markdown-89d391b4ffc4)
15.  The easiest way to make the web LLM-readable - ScrapingBee, accessed on December 19, 2025, [https://www.scrapingbee.com/features/markdown-scraper/](https://www.scrapingbee.com/features/markdown-scraper/)
16.  Structured Outputs | Gemini API - Google AI for Developers, accessed on December 19, 2025, [https://ai.google.dev/gemini-api/docs/structured-output](https://ai.google.dev/gemini-api/docs/structured-output)
17.  How to consistently output JSON with the Gemini API using controlled generation - Medium, accessed on December 19, 2025, [https://medium.com/google-cloud/how-to-consistently-output-json-with-the-gemini-api-using-controlled-generation-887220525ae0](https://medium.com/google-cloud/how-to-consistently-output-json-with-the-gemini-api-using-controlled-generation-887220525ae0)
18.  Instant Data Scraper - Chrome Web Store, accessed on December 19, 2025, [https://chromewebstore.google.com/detail/instant-data-scraper/ofaokhiedipichpaobibbnahnkdoiiah?hl=en-US](https://chromewebstore.google.com/detail/instant-data-scraper/ofaokhiedipichpaobibbnahnkdoiiah?hl=en-US)
19.  Clean way to scrape web pages from Manifest V3 chrome extension - Stack Overflow, accessed on December 19, 2025, [https://stackoverflow.com/questions/76268275/clean-way-to-scrape-web-pages-from-manifest-v3-chrome-extension](https://stackoverflow.com/questions/76268275/clean-way-to-scrape-web-pages-from-manifest-v3-chrome-extension)
20.  How to Scrape Data from a Page with Infinite Scroll - DEV Community, accessed on December 19, 2025, [https://dev.to/shegz/how-to-scrape-data-from-a-page-with-infinite-scroll-4o14](https://dev.to/shegz/how-to-scrape-data-from-a-page-with-infinite-scroll-4o14)
21.  How to handle pagination in web scraping? - DataHen, accessed on December 19, 2025, [https://www.datahen.com/blog/how-to-handle-pagination-in-web-scraping/](https://www.datahen.com/blog/how-to-handle-pagination-in-web-scraping/)
22.  Embeddings | Gemini API - Google AI for Developers, accessed on December 19, 2025, [https://ai.google.dev/gemini-api/docs/embeddings](https://ai.google.dev/gemini-api/docs/embeddings)
23.  Embeddings and Vector Databases | SnapLogic - Integration Nation - 39516, accessed on December 19, 2025, [https://community.snaplogic.com/blog/sl-tech-blog/embeddings-and-vector-databases/39516](https://community.snaplogic.com/blog/sl-tech-blog/embeddings-and-vector-databases/39516)
24.  IVFFlat indexes | Supabase Docs, accessed on December 19, 2025, [https://supabase.com/docs/guides/ai/vector-indexes/ivf-indexes](https://supabase.com/docs/guides/ai/vector-indexes/ivf-indexes)
25.  pgvector: Embeddings and vector similarity | Supabase Docs, accessed on December 19, 2025, [https://supabase.com/docs/guides/database/extensions/pgvector](https://supabase.com/docs/guides/database/extensions/pgvector)
26.  Get text embeddings | Generative AI on Vertex AI - Google Cloud Documentation, accessed on December 19, 2025, [https://docs.cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings)
27.  AI & Vectors | Supabase Docs, accessed on December 19, 2025, [https://supabase.com/docs/guides/ai](https://supabase.com/docs/guides/ai)
28.  Build a Personalized AI Assistant with Postgres - Supabase, accessed on December 19, 2025, [https://supabase.com/blog/natural-db](https://supabase.com/blog/natural-db)
29.  Overview · Cloudflare AI Gateway docs, accessed on December 19, 2025, [https://developers.cloudflare.com/ai-gateway/](https://developers.cloudflare.com/ai-gateway/)