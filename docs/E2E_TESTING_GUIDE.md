# End-to-End Testing Guide

## Overview

This document describes the comprehensive end-to-end (E2E) and integration testing suite for the SEO & GEO Health Checker application. The testing suite covers complete analysis workflows, frontend-backend communication, performance testing, and export functionality.

## Test Structure

### Test Categories

1. **End-to-End Workflow Tests** (`backend/src/__tests__/e2e/`)
   - Complete analysis workflows from URL input to report generation
   - Error recovery and graceful degradation scenarios
   - Data consistency across the entire pipeline

2. **Frontend-Backend Integration Tests** (`frontend/src/__tests__/integration/`)
   - Real-time communication between frontend and backend
   - User interface interactions with API responses
   - Error handling and user feedback

3. **Performance Tests** (`backend/src/__tests__/performance/`)
   - Concurrent analysis handling
   - Memory and CPU utilization
   - Scalability under load

4. **Export Functionality Tests** (`backend/src/__tests__/e2e/export-functionality.e2e.test.ts`)
   - PDF, CSV, and JSON export validation
   - Large dataset handling
   - Export security and error handling

## Test Data

### SEO/GEO Test Scenarios

The test suite includes predefined test sites with known characteristics:

- **Perfect SEO Site**: High scores across all metrics (85-100 overall score)
- **Poor SEO Site**: Multiple issues and low scores (0-40 overall score)
- **Mixed Content Site**: Varied quality content (40-75 overall score)
- **Technical Issues Site**: Performance and technical problems (20-60 overall score)
- **GEO Optimized Site**: AI-optimized content with excellent GEO factors (70-95 overall score)

### Mock Data

Test data includes:
- Sample analysis results with realistic scores
- Error scenarios for different failure modes
- Performance benchmarks and thresholds
- Export format examples

## Running Tests

### Prerequisites

1. Node.js (v16 or higher)
2. npm or yarn
3. All project dependencies installed

### Quick Start

```bash
# Run all E2E and integration tests
./scripts/run-e2e-tests.sh

# Run specific test categories
npm run test:e2e          # Backend E2E tests
npm run test:performance  # Performance tests
npm run test:integration  # Frontend integration tests
```

### Individual Test Commands

```bash
# Backend E2E tests
cd backend
npm run test:e2e

# Frontend integration tests
cd frontend
npm run test:integration

# Performance tests only
cd backend
npm run test:performance
```

## Test Coverage

### Coverage Thresholds

- **Backend E2E**: 70% minimum coverage (lines, functions, branches, statements)
- **Frontend Integration**: 75% minimum coverage
- **Combined Coverage**: Comprehensive report across all components

### Coverage Reports

Coverage reports are generated in:
- `backend/coverage/e2e/` - Backend E2E coverage
- `frontend/coverage/integration/` - Frontend integration coverage
- `coverage/combined/` - Combined coverage report

## Performance Benchmarks

### Response Time Targets

- **Single URL Analysis**: < 30 seconds completion
- **Multi-URL Analysis**: < 60 seconds for 5 URLs
- **API Response Time**: < 2 seconds for most endpoints
- **Export Generation**: < 10 seconds for standard reports

### Resource Limits

- **Memory Usage**: < 500MB peak during concurrent analyses
- **CPU Utilization**: Efficient multi-core usage
- **Concurrent Analyses**: Support for 10+ simultaneous analyses

### Load Testing Scenarios

1. **Concurrent Single-URL Analyses**: 10 simultaneous analyses
2. **Multi-URL Batch Processing**: 5 concurrent analyses with 3 URLs each
3. **High Load Stress Test**: 50 rapid-fire requests
4. **Memory Stress Test**: 15 concurrent analyses with memory monitoring

## Error Scenarios Tested

### Network and Connectivity

- Unreachable URLs and DNS failures
- Connection timeouts and slow responses
- Rate limiting from external APIs
- Intermittent network issues

### Data and Validation

- Invalid URL formats
- Cross-domain URL submissions
- Malformed analysis requests
- Incomplete or corrupted data

### Service Failures

- External API unavailability
- Database connection issues
- Export service failures
- Configuration errors

### Recovery Testing

- Graceful degradation with partial failures
- Retry mechanisms with exponential backoff
- Error reporting and user feedback
- Data consistency during failures

## Integration Test Scenarios

### URL Input and Validation Flow

1. User enters multiple URLs
2. Frontend validates format and sends to backend
3. Backend validates domain consistency
4. Success/error feedback displayed to user

### Analysis Progress Flow

1. Analysis request submitted
2. Real-time progress updates via polling
3. Status changes reflected in UI
4. Completion notification and results display

### Results Display Flow

1. Analysis results retrieved from backend
2. Scores and recommendations rendered
3. Interactive charts and visualizations
4. Detailed breakdowns and explanations

### Export Functionality Flow

1. User selects export format (PDF/CSV/JSON)
2. Export request sent to backend
3. File generation and download initiation
4. Success confirmation or error handling

## Continuous Integration

### CI/CD Integration

The E2E test suite is designed for integration with CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run E2E Tests
  run: |
    ./scripts/run-e2e-tests.sh
    
- name: Upload Coverage Reports
  uses: actions/upload-artifact@v2
  with:
    name: coverage-reports
    path: coverage/combined/
```

### Test Environment Setup

1. **Database**: In-memory or test database
2. **External APIs**: Mocked or test endpoints
3. **File System**: Temporary directories for exports
4. **Network**: Isolated test environment

## Troubleshooting

### Common Issues

1. **Test Timeouts**: Increase timeout values for slow environments
2. **Port Conflicts**: Ensure test ports (3000, 3001) are available
3. **Memory Issues**: Adjust Node.js memory limits if needed
4. **External Dependencies**: Check network connectivity and API availability

### Debug Mode

Enable debug logging:

```bash
DEBUG=true ./scripts/run-e2e-tests.sh
```

### Test Data Reset

Reset test data between runs:

```bash
# Clear test databases and temporary files
npm run test:cleanup
```

## Best Practices

### Test Isolation

- Each test should be independent and not rely on others
- Clean up resources after each test
- Use fresh test data for each scenario

### Realistic Scenarios

- Test with realistic data sizes and complexity
- Include edge cases and boundary conditions
- Simulate real user behavior patterns

### Performance Monitoring

- Monitor resource usage during tests
- Set realistic performance expectations
- Track performance trends over time

### Error Handling

- Test both happy path and error scenarios
- Verify error messages are user-friendly
- Ensure graceful degradation

## Maintenance

### Regular Updates

- Update test data to reflect current SEO/GEO best practices
- Adjust performance benchmarks as system evolves
- Add new test scenarios for new features

### Test Review

- Review test coverage regularly
- Identify gaps in test scenarios
- Update tests when requirements change

### Performance Baselines

- Establish performance baselines for different environments
- Monitor for performance regressions
- Update benchmarks as system scales

## Reporting

### Test Results

Test results include:
- Pass/fail status for each test category
- Performance metrics and benchmarks
- Coverage percentages and detailed reports
- Error logs and debugging information

### Metrics Tracking

Key metrics tracked:
- Test execution time
- Coverage percentages
- Performance benchmarks
- Error rates and types

### Dashboard Integration

Results can be integrated with monitoring dashboards:
- Test success rates over time
- Performance trend analysis
- Coverage evolution
- Error pattern identification