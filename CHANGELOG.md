# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2025-10-25

### Added
- Pricing data storage and retrieval
- `--price` / `-p` flag to include market pricing in output
- Automatic price refresh when data is >24 hours old
- New `pricing` table in database schema
- Full pricing data from FMP API (price, change, market cap, volume, beta, etc.)

## [0.2.0] - 2025-10-25

### Added
- Wrapper script (`bin/tickisinator`) for automatic .env loading
- Support for symlinks from other projects
- `bin/.env.example` configuration template

### Changed
- Compiled binary renamed to `bin/tickisinator.bin`
- Build task outputs to `.bin` extension
- Updated .gitignore to track wrapper but exclude binary and .env

### Fixed
- Environment variable loading when executable is symlinked from other directories

## [0.1.0] - 2025-10-25

### Added
- Initial Phase 0 implementation
- ISIN validation and computation module
- CUSIP to ISIN conversion for US securities
- SQLite database with relational schema
- Financial Modeling Prep (FMP) API client
- CLI argument parsing and validation
- Ticker → ISIN/CUSIP lookup via FMP API
- Reverse lookup for cached entries (ISIN/CUSIP → ticker)
- JSONL output format
- Batch processing support
- Stdin/interactive mode
- Help and version flags
- Verbose logging mode
- 66 unit tests with 100% core coverage
- Comprehensive documentation (README, TECHNICAL_NOTES)
- Compiled binary support

### Limitations
- ISIN → Ticker reverse lookup only works for cached entries (FMP free tier)
- 250 API requests/day limit (FMP free tier)
- US securities focus

[Unreleased]: https://github.com/mmazour/tickisinator/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/mmazour/tickisinator/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/mmazour/tickisinator/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/mmazour/tickisinator/releases/tag/v0.1.0
