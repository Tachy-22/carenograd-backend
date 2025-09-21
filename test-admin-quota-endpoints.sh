#!/bin/bash

# Admin Quota Endpoints Test Script
# This script tests all the admin quota endpoints to verify they're working correctly

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:3000"
JWT_TOKEN=""

# Function to print colored output
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Function to make authenticated request
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ -z "$JWT_TOKEN" ]; then
        print_error "JWT_TOKEN not set. Please set JWT_TOKEN environment variable."
        return 1
    fi
    
    if [ -n "$data" ]; then
        curl -s -w "\nHTTP Status: %{http_code}\n" \
             -X "$method" \
             -H "Authorization: Bearer $JWT_TOKEN" \
             -H "Content-Type: application/json" \
             -d "$data" \
             "$BASE_URL$endpoint"
    else
        curl -s -w "\nHTTP Status: %{http_code}\n" \
             -X "$method" \
             -H "Authorization: Bearer $JWT_TOKEN" \
             -H "Content-Type: application/json" \
             "$BASE_URL$endpoint"
    fi
}

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local data=$4
    
    echo -e "\n${YELLOW}Testing: $description${NC}"
    echo -e "${BLUE}$method $endpoint${NC}"
    
    response=$(make_request "$method" "$endpoint" "$data")
    echo "$response"
    
    # Extract HTTP status code
    status_code=$(echo "$response" | tail -n 1 | grep -o '[0-9]*')
    
    if [ "$status_code" -eq 200 ] || [ "$status_code" -eq 201 ]; then
        print_success "Test passed (HTTP $status_code)"
    elif [ "$status_code" -eq 401 ]; then
        print_error "Authentication failed (HTTP $status_code) - Check JWT token"
    elif [ "$status_code" -eq 403 ]; then
        print_error "Access forbidden (HTTP $status_code) - Check admin role"
    else
        print_error "Test failed (HTTP $status_code)"
    fi
    
    echo "----------------------------------------"
}

# Main script
print_header "Admin Quota Endpoints Test Suite"

# Check if JWT_TOKEN is provided
if [ -z "$JWT_TOKEN" ]; then
    print_warning "JWT_TOKEN environment variable not set."
    echo "Please set it using: export JWT_TOKEN='your-jwt-token-here'"
    echo ""
    echo "To get a JWT token:"
    echo "1. Visit $BASE_URL/auth/google to login"
    echo "2. Copy the access_token from the response"
    echo "3. Set the token: export JWT_TOKEN='your-token'"
    echo ""
    read -p "Enter your JWT token now: " JWT_TOKEN
fi

# Test 1: Check authentication first
print_header "Step 1: Authentication Check"
test_endpoint "GET" "/auth/profile" "Check current user profile and role"

# Test 2: System Quota Overview
print_header "Step 2: System Quota Overview"
test_endpoint "GET" "/admin/quota/system-overview" "Get system-wide quota overview"

# Test 3: Key Pool Statistics
print_header "Step 3: Key Pool Statistics"
test_endpoint "GET" "/admin/quota/key-pool-stats" "Get API key pool statistics"

# Test 4: User Allocations (with pagination)
print_header "Step 4: User Allocations"
test_endpoint "GET" "/admin/quota/users?page=1&limit=10" "Get user allocations (page 1, limit 10)"
test_endpoint "GET" "/admin/quota/users?page=1&limit=5&model=gemini-2.5-flash" "Get user allocations filtered by model"

# Test 5: Usage Trends
print_header "Step 5: Usage Trends"
test_endpoint "GET" "/admin/quota/usage-trends?days=7" "Get 7-day usage trends"
test_endpoint "GET" "/admin/quota/usage-trends?days=30&model=gemini-2.5-flash" "Get 30-day usage trends for specific model"

# Test 6: Quota Alerts
print_header "Step 6: Quota Alerts"
test_endpoint "GET" "/admin/quota/alerts" "Get quota alerts and warnings"

# Test 7: Individual User Quota (if we have users)
print_header "Step 7: Individual User Quota"
echo "Note: This test requires a valid user ID. Getting users first..."
test_endpoint "GET" "/admin/users?page=1&limit=1" "Get first user for testing individual quota"

# Test 8: Update User Allocation (requires user ID)
print_header "Step 8: Update User Allocation"
echo "Note: This test requires a valid user ID from the previous step."
echo "Manual test command (replace USER_ID):"
echo "curl -X POST '$BASE_URL/admin/quota/users/USER_ID/adjust' \\"
echo "     -H 'Authorization: Bearer \$JWT_TOKEN' \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"userId\":\"USER_ID\",\"modelName\":\"gemini-2.5-flash\",\"dailyAllocation\":50}'"

# Summary
print_header "Test Summary"
echo "All basic quota endpoints tested."
echo ""
echo "Common Issues & Solutions:"
echo "- HTTP 401: Invalid or expired JWT token"
echo "- HTTP 403: User doesn't have admin role (update: role = 'admin' in database)"
echo "- HTTP 500: Server error (check backend logs)"
echo "- Connection refused: Backend server not running"
echo ""
echo "To make yourself admin, run in your database:"
echo "UPDATE users SET role = 'admin', is_active = true WHERE email = 'your-email@example.com';"

# Interactive mode for further testing
echo ""
read -p "Would you like to run a specific endpoint test? (y/n): " run_specific

if [ "$run_specific" = "y" ] || [ "$run_specific" = "Y" ]; then
    echo ""
    echo "Available endpoints:"
    echo "1. /admin/quota/system-overview"
    echo "2. /admin/quota/key-pool-stats"
    echo "3. /admin/quota/users"
    echo "4. /admin/quota/usage-trends"
    echo "5. /admin/quota/alerts"
    echo "6. /auth/profile"
    echo ""
    read -p "Enter endpoint path: " custom_endpoint
    read -p "Enter HTTP method (GET/POST): " custom_method
    
    test_endpoint "$custom_method" "$custom_endpoint" "Custom endpoint test"
fi

print_header "Testing Complete"