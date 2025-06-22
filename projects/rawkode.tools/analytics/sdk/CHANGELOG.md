# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-20

### Added

- Initial release of the Analytics SDK
- Event batching with configurable batch size and flush interval
- Offline support using IndexedDB for event persistence
- Automatic retry with exponential backoff
- Optional gzip compression for reduced bandwidth usage
- Full TypeScript support with comprehensive type definitions
- CloudEvents specification compliance
- Automatic tracking for page views, clicks, and errors
- Session management with automatic session ID generation
- User identification with persistent user ID storage
- Network status detection for offline/online handling
- Memory storage fallback when IndexedDB is unavailable
- Comprehensive error handling and logging
- Browser support for Chrome 60+, Firefox 55+, Safari 11+, Edge 79+
- ESM and CommonJS builds
- Source maps for debugging
- Extensive test coverage
- Documentation and integration guides
- Example applications

### Security

- No PII collection by default
- Secure event transmission over HTTPS
- Content Security Policy compatibility
- API key authentication support