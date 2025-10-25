# Tickisinator

## Project Objective

Build a CLI tool to translate investment identifiers between different representations:

- **ISIN** (International Securities Identification Number)
- **Ticker** symbols
- **CUSIP** (Committee on Uniform Securities Identification Procedures)
- **SEDOL** (Stock Exchange Daily Official List) - exploratory

The primary focus is ISIN ↔ Ticker ↔ CUSIP translation for US securities, backed by SQLite and multiple free/freemium data sources. HTTP API to be added in Phase 1.

## Development Approach

### Planning First
- Do not begin building code until explicitly requested
- Prefer to explore, understand, and plan thoroughly before implementation
- Discuss architecture and design decisions before coding

### Test-Driven Development (TDD)
- **Always follow TDD practices**
- Write tests first, then implementation
- Apply TDD for both:
  - New feature development
  - Bug fixes

### Testing Requirements
- All new code must have corresponding tests written first
- All bug fixes must include a failing test that reproduces the issue before the fix
- Maintain high test coverage
