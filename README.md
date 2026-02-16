# Original Assignment (verbatim)

# Take-Home Assignment — Full-Stack Developer

## Context

This archive ships `cpg-gen` — a Code Property Graph (CPG) generator for Go projects. A CPG fuses the abstract syntax tree, control flow graph, data flow graph, call graph, type system, and static analysis results into a single queryable graph stored as an SQLite database.

Three Go modules are referenced as git submodules: **Prometheus**, **client_golang**, and **prometheus-adapter**. You will add a fourth module yourself (see below).

## Setup

```bash
git submodule update --init
```

This fetches the three source modules from GitHub.

## Prerequisites

- **Go 1.25+** — the generator requires Go 1.25.0 or later

## Building and Generation

Build the generator and produce the CPG database. The primary module is `./prometheus`; additional modules are specified with the `-modules` flag. Run `./cpg-gen -help` for all available options.

Use this value for `-modules`:

```
./client_golang:github.com/prometheus/client_golang:client_golang,./prometheus-adapter:sigs.k8s.io/prometheus-adapter:adapter
```

Pick a **fourth Go module** from the Prometheus ecosystem — alertmanager, node_exporter, pushgateway, blackbox_exporter, or any other — add it via the same `-modules` flag, and regenerate the database.

The database is self-documenting: the `schema_docs` table describes every table and column; the `queries` table contains ready-made SQL for common operations. Start there.

### What to expect

The generated database is roughly **900 MB** and contains approximately **555,000 nodes** and **1,500,000 edges**. Design your application with this scale in mind.

## Task

Build a web application (an in-browser IDE) that lets a developer explore and understand a codebase through the lens of its CPG.

Technology stack is entirely your choice — use whatever languages, frameworks, and libraries you believe produce the best result. What matters is a well-engineered product.

One hard constraint: **graph visualization must be a central part of the experience**, not a sidebar widget.

## Example Features

Three directions to consider. You may pursue any one, combine several, or take an entirely different approach.

### 1. Call Graph Explorer

Click a function → BFS over `call` edges → render an interactive call graph (10–60 nodes). Click any node to navigate into its neighborhood. Display source code from the `sources` table on selection.

Relevant built-in queries: `function_neighborhood`, `call_chain`, `callers_of`.

### 2. Data Flow Slicer

Select a variable → trace backward or forward along `dfg` edges → visualize the data path from definition to use. Overlay the slice onto source code by highlighting the participating lines.

Relevant built-in queries: `backward_slice`, `forward_slice`, `data_flow_path`.

### 3. Package Architecture Map

Render the package dependency graph from `dashboard_package_graph` (~170 packages, ~400 edges). Size nodes by complexity (`dashboard_package_treemap`), color them by module. Click a package to drill down into its functions via `dashboard_function_detail`.

## What We're Looking For

- **Deliberate choices** — which data from the database matters most to a developer, and why you chose it
- **A working prototype** that handles the full dataset, not a static mockup
- **Focused subgraphs** (10–100 nodes per view) rather than an attempt to render the entire graph at once

## Evaluation Criteria

| Criterion | Weight |
|---|---|
| Graph work — visualization, interactivity, meaningful subgraph selection | 25% |
| Developer utility — how effectively the tool aids code comprehension | 20% |
| Engineering quality — architecture, clean code, separation of concerns | 20% |
| Performance — smooth operation on the full dataset | 15% |
| Schema exploration — depth of investigation, creative use of the data | 10% |
| UI/UX — intuitive interface, loading states, error handling | 10% |

## Submission Format

- A git repository with clear setup instructions
- **A `docker-compose.yml` is required.** We must be able to run `docker compose up` and have the application fully operational — no manual setup steps beyond cloning the repo
- A brief write-up of the decisions you made and any trade-offs (in the README or a separate file)

## Deadline

24 hours from the moment you begin.

## Questions?

If anything is unclear or you run into issues, reach out to [matvei@theartisan.ai](mailto:matvei@theartisan.ai).

# Project Notes (additions)

These notes are additions made during the project to improve reproducibility and clarify decisions.

- Go version used for generation: `go1.26.0` (requirement is Go 1.25+).
- Fourth module chosen: `node_exporter` (`github.com/prometheus/node_exporter`) because `alertmanager` conflicts in a workspace with `prometheus` due to a duplicate nested module path `github.com/prometheus/prometheus/internal/tools`.
- CPG generation command used:
  ```bash
  go build -o cpg-gen .
  ./cpg-gen -modules "./client_golang:github.com/prometheus/client_golang:client_golang,./prometheus-adapter:sigs.k8s.io/prometheus-adapter:adapter,./node_exporter:github.com/prometheus/node_exporter:node_exporter" ./prometheus cpg.db
  ```
- Output database: `cpg.db` (~937 MB). It is ignored by git to avoid committing large binaries.
- Submodule revisions (for reproducibility):
- `client_golang`: `bf37be4fecc0a3d89f980252e206b67806990e56` (v1.23.2-98-gbf37be4)
- `prometheus`: `8937cbd3955513efe0e0c76c58a3e0665a35df3a` (v0.309.1-304-g8937cbd39)
- `prometheus-adapter`: `01919d0ef11859bc214e0c8a8bd5368afd9d47f7` (v0.12.0-4-g01919d0)
- `node_exporter`: `e8812553ac19526e4753e1972020c9f3e55ddb17` (v1.10.2-39-ge8812553)

## Developer Benefit

**Package Architecture Map** gives an at-a-glance view of module boundaries and dependencies: the package graph makes hotspots obvious, complexity sizing highlights risk areas, and drilling into a package’s functions speeds up ownership discovery and impact analysis.
