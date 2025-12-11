# HydroSim - 3D Hydropower Dam Analysis Platform

## Overview

HydroSim is a professional-grade engineering application for 3D hydropower dam analysis and simulation. The platform enables engineers to design, visualize, and analyze dam structures with real-time calculations for power generation, structural stability, and reservoir modeling. Users can interactively adjust dam geometry and flow parameters while viewing results in a 3D viewer with export capabilities for GLB models, CSV data, and PDF reports.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state and data fetching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **3D Visualization**: Three.js with OrbitControls, GLTFLoader, and GLTFExporter for dam rendering and model export
- **Typography**: Inter (primary) and JetBrains Mono (technical values) from Google Fonts

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Design**: RESTful endpoints under `/api` prefix
- **Build Process**: Custom esbuild bundling for production with Vite for client assets

### Authentication
- **Provider**: Replit OpenID Connect (OIDC) authentication
- **Session Management**: Express sessions with PostgreSQL-backed session store (connect-pg-simple)
- **Strategy**: Passport.js with openid-client for OIDC integration

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Tables**: 
  - `sessions` - Session storage for authentication
  - `users` - User profiles with Replit auth integration
  - `simulations` - Saved dam simulation configurations and results

### Project Structure
```
├── client/src/          # React frontend application
│   ├── components/      # UI components including DamViewer, ParametersPanel, ResultsPanel
│   ├── hooks/           # Custom React hooks (useAuth, use-toast)
│   ├── lib/             # Utilities and calculation logic
│   └── pages/           # Route components (Landing, Home)
├── server/              # Express backend
│   ├── routes.ts        # API route definitions
│   ├── storage.ts       # Database access layer
│   └── replitAuth.ts    # Authentication setup
├── shared/              # Shared code between client and server
│   └── schema.ts        # Drizzle database schema and TypeScript types
└── migrations/          # Drizzle database migrations
```

### Key Design Decisions

1. **Monorepo Structure**: Client and server code coexist with shared types in a unified codebase, reducing type duplication and ensuring API contract consistency.

2. **3D Rendering Strategy**: Uses Three.js with extruded geometry for real-time dam visualization. Supports both procedural geometry and GLB model loading for enhanced detail.

3. **Calculation Engine**: Pure TypeScript functions in `damCalculations.ts` compute hydropower metrics (power output, forces, stability factors) client-side for instant feedback.

4. **Component Library**: shadcn/ui provides accessible, customizable components following Material Design-inspired patterns adapted for engineering workflows.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store accessed via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries and schema management

### Authentication Services
- **Replit OIDC**: Identity provider for user authentication via `ISSUER_URL`
- Required environment variables: `REPL_ID`, `SESSION_SECRET`

### Frontend Libraries
- **Three.js**: 3D graphics rendering and model export
- **jsPDF**: PDF report generation for simulation results
- **TanStack Query**: Server state synchronization

### Development Tools
- **Vite**: Development server with HMR and production builds
- **esbuild**: Server-side bundling for optimized cold starts
- **Drizzle Kit**: Database migration and schema push utilities