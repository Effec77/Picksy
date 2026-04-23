---
title: Pickscraper Architecture
description: Self-Hosted RAG + SLM for E-Commerce Intelligence
version: 1.0.0
author: Picksy Team
date: 2024-12-21
---

# Pickscraper: Self-Hosted RAG + SLM Architecture

> **TL;DR:** Pickscraper replaces external API dependencies (Gemini, OpenAI) with a local Small Language Model (SLM) augmented by Retrieval-Augmented Generation (RAG). Zero API costs, unlimited usage, full control.

## Table of Contents

- [1. Overview](#1-overview)
  - [1.1 Core Philosophy](#11-core-philosophy)
  - [1.2 What It Replaces](#12-what-it-replaces)
- [2. System Architecture](#2-system-architecture)
  - [2.1 High-Level Flow](#21-high-level-flow)
  - [2.2 Component Stack](#22-component-stack)
- [3. Hardware Requirements](#3-hardware-requirements)
  - [3.1 Minimum Specifications](#31-minimum-specifications)
  - [3.2 Target Hardware Profile](#32-target-hardware-profile)
  - [3.3 VRAM Budget](#33-vram-budget)
- [4. Software Requirements](#4-software-requirements)
  - [4.1 Core Dependencies](#41-core-dependencies)
  - [4.2 Installation Guide](#42-installation-guide)
- [5. Model Selection](#5-model-selection)
  - [5.1 Primary SLM](#51-primary-slm)
  - [5.2 Embedding Model](#52-embedding-model)
  - [5.3 Alternative Models](#53-alternative-models)
- [6. RAG Knowledge Base](#6-rag-knowledge-base)
  - [6.1 What Gets Indexed](#61-what-gets-indexed)
  - [6.2 Chunking Strategy](#62-chunking-strategy)
  - [6.3 Retrieval Flow](#63-retrieval-flow)
- [7. Fine-Tuning Strategy](#7-fine-tuning-strategy)
  - [7.1 Method: QLoRA](#71-method-qlora)
  - [7.2 Training Data Requirements](#72-training-data-requirements)
  - [7.3 Training Configuration](#73-training-configuration)
- [8. Constraints & Limitations](#8-constraints--limitations)
- [9. Project Structure](#9-project-structure)
- [10. Implementation Roadmap](#10-implementation-roadmap)
- [11. Performance Benchmarks](#11-performance-benchmarks)
- [12. API vs Self-Hosted Comparison](#12-api-vs-self-hosted-comparison)
- [13. References](#13-references)

---

## 1. Overview

### 1.1 Core Philosophy

Pickscraper inverts the traditional API-dependent architecture:

