# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed


## [0.1.0-alpha.1] - 2025-11-26

### Added

#### Core Client
- `NeonPostgrestClient` class extending upstream PostgrestClient with Neon-specific configuration
- Full PostgreSQL query capabilities via PostgREST protocol
- Support for custom headers and fetch implementation
- Schema configuration support

#### Authentication Utilities
- `fetchWithToken()` generic utility for adding token-based authentication to requests
- Support for async token providers
- Seamless integration with external authentication systems

#### Environment Support
- Full browser and Node.js compatibility
- No authentication dependencies - can be used standalone for non-authenticated scenarios

#### TypeScript
- Full TypeScript support with strict mode enabled
- Comprehensive type definitions for all exports

### Internal 

- Updated build configuration in `tsdown.config.ts`
- Minor documentation updates

[unreleased]: https://github.com/neondatabase/neon-js/compare/v0.1.0-alpha.1...HEAD
[0.1.0-alpha.1]: https://github.com/neondatabase/neon-js/releases/tag/v0.1.0-alpha.1
