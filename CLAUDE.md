# Claude Instructions

## AI SDK v5 Usage - MANDATORY RULES

### Documentation Source
- **ONLY** use information from the AI-SDK_V5_DOCS folder in this project
- **NEVER** infer, assume, or guess API patterns, syntax, or parameters
- **ALWAYS** reference the exact examples and syntax shown in the documentation files
- When uncertain about any AI SDK functionality, READ the relevant doc file first

### Implementation Guidelines
- Use exact model names, parameters, and syntax as shown in documentation examples
- Follow the precise import statements and function calls from the docs
- Check that dependencies and versions match what's required in the documentation
- If an approach doesn't work, consult the docs again rather than trying variations

### Specific AI SDK v5 Rules
- Model specification: Use formats exactly as shown in docs (e.g., `openai('gpt-4o')` or `'openai/gpt-4.1'`)
- Tool definitions: Follow the exact `tool()` function signature from docs
- Parameters: Use `stopWhen: stepCountIs(n)` not `maxSteps` or other variations
- Imports: Import only what's shown in documentation examples

### When Adding Features
1. First, search AI-SDK_V5_DOCS for relevant examples
2. Use the exact patterns shown in those examples
3. Test with the documented approach before trying alternatives
4. If something doesn't work, re-read the docs rather than inferring fixes

### Error Resolution
- If getting version errors, check the exact model names used in docs
- If getting parameter errors, verify against the exact function signatures in docs
- If imports fail, use the exact import statements from documentation examples

This project is a learning exercise for AI SDK v5 - strict adherence to documentation is essential for understanding the correct patterns.