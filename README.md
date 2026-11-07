# SmartERP AI — Inventory and Demand Forecasting

A React/TypeScript inventory application with an Express/Prisma/MongoDB backend, Python forecasting service, experimental source integration and an offline reproducible forecasting benchmark.

## Start the application

From this project folder:

```bash
bash start.sh
```

Open the address printed in the terminal and click **Launch Dashboard**. The original app tabs remain available; **Connections** is an additional tab. Press **Ctrl+C** in the terminal to stop. See **[START.md](START.md)** for simple setup and restart instructions.

## Project documentation

**[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)** is the main detailed project report: architecture, data models, APIs, application workflows, native models, integration, research evidence, tests, limitations and remaining work.

## Run the research checkpoint

```bash
bash run-research.sh
```

This runs the separate seasonal-naive development benchmark. It does not open the website or change business data. See the [checkpoint report](experiments/reports/CHECKPOINT_AB.md) and [research guide](experiments/README.md).

The current Connections source is synthetic; live-provider synchronization into the main app is still in progress. Inventory-policy research and final-test forecasting comparisons remain planned. Current implementation and measured results are distinguished in the main documentation.
