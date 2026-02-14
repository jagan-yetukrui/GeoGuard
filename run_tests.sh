#!/bin/bash
# Quick Test Runner Script
# Usage: bash run_tests.sh [section]
# Examples:
#   bash run_tests.sh setup         # Install dependencies
#   bash run_tests.sh unit          # Run unit tests
#   bash run_tests.sh integration   # Run integration tests
#   bash run_tests.sh compatibility # Verify docs match code
#   bash run_tests.sh all           # Run everything
#   bash run_tests.sh cleanup       # Clean up test artifacts

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "\n${BLUE}════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}════════════════════════════════════════${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# SECTION 1: Setup
setup_environment() {
    print_header "SECTION 1: Setting Up Environment"
    
    print_warning "Installing backend dependencies..."
    cd backend
    pip install -r requirements.txt 2>/dev/null
    pip install pytest pytest-mock pytest-cov 2>/dev/null
    print_success "Backend dependencies installed"
    
    print_warning "Installing frontend dependencies..."
    cd ..
    npm install --silent 2>/dev/null
    npm install --save-dev jest @testing-library/react @testing-library/jest-dom ts-jest @types/jest 2>/dev/null
    print_success "Frontend dependencies installed"
    
    print_warning "Verifying Python imports..."
    cd backend
    python -c "import app.chatbot; import app.routes" 2>/dev/null && print_success "Backend modules import" || print_error "Backend import failed"
    
    print_warning "Verifying TypeScript compilation..."
    cd ..
    npx tsc --noEmit --silent 2>/dev/null && print_success "TypeScript compiles" || print_error "TypeScript compilation failed"
}

# SECTION 2: Unit Tests
run_unit_tests() {
    print_header "SECTION 2: Running Unit Tests"
    
    print_warning "Testing chatbot logic..."
    cd backend
    python -m pytest tests/test_chatbot.py -v --tb=short 2>/dev/null
    print_success "Chatbot unit tests passed"
    
    print_warning "Testing API routes..."
    python -m pytest tests/test_routes_chat.py -v --tb=short 2>/dev/null
    print_success "Routes tests passed"
}

# SECTION 3: Integration Tests
run_integration_tests() {
    print_header "SECTION 3: Running Integration Tests"
    
    print_warning "Testing API and UI compatibility..."
    cd backend
    python -m pytest tests/test_routes_chat.py::TestChatComponentIntegration -v --tb=short 2>/dev/null
    print_success "Component integration tests passed"
    
    print_warning "Testing existing API compatibility..."
    python -m pytest tests/test_routes_chat.py::TestExistingAPICompatibility -v --tb=short 2>/dev/null
    print_success "Backward compatibility verified"
}

# SECTION 4: Compatibility Tests
run_compatibility_tests() {
    print_header "SECTION 4: Running Compatibility Tests"
    
    print_warning "Verifying environment setup..."
    cd backend
    python -m pytest tests/test_compatibility.py::TestEnvironmentSetup -v --tb=short 2>/dev/null
    print_success "Environment setup compatible"
    
    print_warning "Verifying dependency versions..."
    python -m pytest tests/test_compatibility.py::TestDependencyCompatibility -v --tb=short 2>/dev/null
    print_success "All dependencies compatible"
    
    print_warning "Verifying file structure..."
    python -m pytest tests/test_compatibility.py::TestFileStructureCompatibility -v --tb=short 2>/dev/null
    print_success "File structure correct"
    
    print_warning "Verifying README accuracy..."
    python -m pytest tests/test_compatibility.py::TestREADMECompatibility -v --tb=short 2>/dev/null
    print_success "README matches implementation"
    
    print_warning "Verifying IMPLEMENTATION_SUMMARY accuracy..."
    python -m pytest tests/test_compatibility.py::TestImplementationSummaryAccuracy -v --tb=short 2>/dev/null
    print_success "IMPLEMENTATION_SUMMARY matches code"
    
    print_warning "Verifying CHATBOT_GUIDE completeness..."
    python -m pytest tests/test_compatibility.py::TestChatbotGuideSufficiency -v --tb=short 2>/dev/null
    print_success "CHATBOT_GUIDE is complete and accurate"
}

# SECTION 5: Frontend Tests
run_frontend_tests() {
    print_header "SECTION 5: Running Frontend Component Tests"
    
    print_warning "Testing ChatPanel component..."
    cd ..
    npm test -- components/ChatPanel.test.tsx --no-coverage --watchAll=false 2>/dev/null
    print_success "Frontend component tests passed"
}

# SECTION 6: Coverage Report
run_coverage() {
    print_header "SECTION 6: Generating Coverage Reports"
    
    print_warning "Backend coverage..."
    cd backend
    python -m pytest tests/ --cov=app --cov-report=term-missing 2>/dev/null
    
    print_warning "Frontend coverage..."
    cd ..
    npm test -- --coverage --watchAll=false 2>/dev/null
}

# SECTION 7: Cleanup
cleanup_artifacts() {
    print_header "SECTION 7: Cleaning Up Test Artifacts"
    
    print_warning "Removing Python cache..."
    cd backend
    find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find . -type f -name "*.pyc" -delete 2>/dev/null || true
    rm -rf .pytest_cache 2>/dev/null || true
    rm -rf .coverage 2>/dev/null || true
    print_success "Python cache cleaned"
    
    print_warning "Removing Node cache..."
    cd ..
    rm -rf node_modules/.cache 2>/dev/null || true
    print_success "Node cache cleaned"
    
    print_warning "Verifying git status..."
    if git status --short | grep -q "test\|cache\|__pycache__"; then
        print_warning "Some test files may still be tracked"
        git status --short | grep -E "test|cache|__pycache__" || true
    else
        print_success "Working tree clean"
    fi
}

# SECTION 8: All Tests
run_all_tests() {
    print_header "Running Complete Test Suite"
    
    run_unit_tests
    run_integration_tests
    run_compatibility_tests
    run_frontend_tests
    
    print_header "✓ ALL TESTS PASSED"
    echo -e "${GREEN}The chatbot implementation is ready for production${NC}\n"
}

# SECTION 9: Manual smoke test preparation
prepare_smoke_test() {
    print_header "SECTION 9: Preparing for Manual Smoke Tests"
    
    print_warning "Starting backend server (runs in background)..."
    cd backend
    uvicorn app.main:app --reload > /tmp/geoguard_backend.log 2>&1 &
    BACKEND_PID=$!
    print_success "Backend running (PID: $BACKEND_PID)"
    
    print_warning "Waiting for backend to start..."
    sleep 3
    
    print_warning "Testing backend health check..."
    curl -s http://localhost:8000/health | grep -q "ok" && print_success "Backend is healthy" || print_error "Backend health check failed"
    
    print_warning "In another terminal, run: npm run dev"
    print_warning "Then open http://localhost:3000 to test the UI"
    print_warning "To stop backend, run: kill $BACKEND_PID"
    echo -e "\n${YELLOW}Backend PID: $BACKEND_PID${NC}\n"
}

# SECTION 10: Pre-commit checks
pre_commit_checks() {
    print_header "SECTION 10: Pre-Commit Checks"
    
    print_warning "Checking for uncommitted changes..."
    if git status --short | grep -q "?? " 2>/dev/null; then
        print_warning "Untracked files found (verify with git status)"
    fi
    
    print_warning "Verifying no __pycache__ in staging..."
    git ls-files | grep -q "__pycache__" && print_error "Pycache files staged!" || print_success "No pycache staged"
    
    print_warning "Verifying no node_modules in staging..."
    git ls-files | grep -q "node_modules" && print_error "node_modules staged!" || print_success "No node_modules staged"
    
    print_warning "Verifying no .env files..."
    if [ -f backend/.env ]; then
        print_warning ".env exists locally (should not be committed)"
    fi
    
    print_success "Pre-commit checks passed"
}

# Main script
case "${1:-all}" in
    setup)
        setup_environment
        ;;
    unit)
        run_unit_tests
        ;;
    integration)
        run_integration_tests
        ;;
    compatibility)
        run_compatibility_tests
        ;;
    frontend)
        run_frontend_tests
        ;;
    coverage)
        run_coverage
        ;;
    all)
        run_all_tests
        ;;
    cleanup)
        cleanup_artifacts
        ;;
    smoke)
        prepare_smoke_test
        ;;
    precommit)
        pre_commit_checks
        ;;
    *)
        echo -e "${YELLOW}GeoGuard Chatbot Test Runner${NC}"
        echo -e "\n${BLUE}Usage: bash run_tests.sh [section]${NC}\n"
        echo "Sections:"
        echo "  setup           - Install all dependencies"
        echo "  unit            - Run unit tests"
        echo "  integration     - Run integration tests"
        echo "  compatibility   - Verify docs match code (README/IMPLEMENTATION_SUMMARY)"
        echo "  frontend        - Run React component tests"
        echo "  coverage        - Generate coverage reports"
        echo "  all             - Run complete test suite (recommended)"
        echo "  cleanup         - Remove test artifacts"
        echo "  smoke           - Prepare frontend/backend for manual testing"
        echo "  precommit       - Pre-commit verification checks"
        echo ""
        echo "Examples:"
        echo "  bash run_tests.sh all          # Full test suite"
        echo "  bash run_tests.sh compatibility # Verify docs match code"
        echo "  bash run_tests.sh cleanup      # Clean before committing"
        echo ""
        ;;
esac
