# Hermes Contract & Architecture Documentation

## Overview
Hermes is the dedicated mutating tool execution bridge for SyncScript and Cortex.
All mutating write tools route exclusively through Hermes `/v1/invoke` with idempotency verification and complete execution audit traces.

## Supported Mutating Tools
- `apply_task_patch`: Patch task state across projects and daily tracking.
- `create_calendar_hold`: Create calendar holds for deep work and scheduling events.

## Dock Event Integration
During tool invocation via `/v1/invoke`, Hermes emits contract events for the dashboard dock:
- `agent.run.started`
- `agent.run.step`
- `agent.run.completed`
- `agent.run.failed`

## Endpoints
- `GET /health` or `GET /healthz` - Health probe
- `GET /v1/tools` - Catalog of registered mutating tools
- `POST /v1/invoke` - Execute gated tool with idempotency key and trace response

