# Coding Standards for Remograd Project

## TypeScript Standards
- **NEVER use 'any' type** - Always use proper typing with interfaces, types, or generics
- **Type Safety**: Prefer explicit types over implicit ones
- **Strict Mode**: Always maintain strict TypeScript configuration
- **Error Handling**: Always include proper error handling with specific error types

## Tool Development Guidelines
- Use the established `tool()` function pattern from AI SDK v5
- Include comprehensive Zod input schemas with proper descriptions
- Implement proper OAuth2 authentication handling for Google services
- Return structured responses with success/error states
- Follow existing naming conventions and file structure
- Always validate input parameters with Zod schemas

## Project Architecture
This is a modular AI agent system built with:
- **AI SDK v5** for tool creation and agent orchestration
- **TypeScript** with strict typing enforcement
- **Zod** for comprehensive input validation
- **Axios** for HTTP requests to external APIs
- **Multiple tool families**: Gmail, Google Sheets, Google Docs, Web Scraping, etc.

## Code Quality Requirements
- No use of `any` type anywhere in the codebase
- Proper error handling with typed catch blocks
- Comprehensive JSDoc comments for complex functions
- Consistent naming conventions across all modules
- Modular structure with clear separation of concerns

## OAuth2 Integration Standards
- Always require `accessToken` parameter for Google service tools
- Include proper token validation and error handling
- Provide clear error messages for authentication failures
- Follow Google API authentication best practices