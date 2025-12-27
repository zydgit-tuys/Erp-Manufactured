# Backend Services

This directory contains the backend services for the Fashion Forge application.

## Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   │   └── supabase.ts  # Supabase server client
│   ├── services/        # Business logic services
│   │   ├── auth.service.ts
│   │   └── inventory.service.ts
│   ├── utils/           # Utility functions
│   │   ├── response.ts  # API response helpers
│   │   └── logger.ts    # Logging utility
│   ├── __tests__/       # Unit tests
│   │   ├── response.test.ts
│   │   └── logger.test.ts
│   └── smoke.test.js    # Smoke test
└── package.json
```

## Services

### Authentication Service
- User session verification
- Token management
- User retrieval

### Inventory Service
- CRUD operations for inventory items
- Integration with Supabase

## Utilities

### Response Utils
Standardized API response formatting:
- `successResponse()` - Success responses
- `errorResponse()` - Error responses
- `validationError()` - Validation error responses

### Logger
Centralized logging with context and levels:
- DEBUG, INFO, WARN, ERROR levels
- Timestamped logs
- Contextual logging

## Testing

Run tests:
```bash
npm test                 # Run all backend tests
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage
```

## Environment Variables

Backend requires:
```
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```
