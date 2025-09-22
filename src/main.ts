import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // CORS configuration
  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  });

  // Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('Remograd AI Agent API')
    .setDescription(`
# Multi-User AI Agent for Graduate School Applications

A comprehensive API for AI-powered postgraduate application assistance. Each user gets their own isolated environment with conversation history, document knowledge base, and Google API integration.

## Key Features
- **Google OAuth Authentication**: Secure login with Google accounts
- **Real-time AI Chat**: Streaming responses with progress updates  
- **Document Knowledge Base**: Upload and query PDFs (CVs, research papers)
- **Google APIs Integration**: Create spreadsheets, docs, and send emails
- **Application Tracking**: Research programs, find professors, manage deadlines
- **Multi-user Isolation**: Each user's data is completely separate

## Getting Started
1. **Authenticate**: Visit \`/auth/google\` to login with Google
2. **Get JWT Token**: Copy the access_token from the callback response
3. **Start Chatting**: Use the token to chat with the AI agent
4. **Upload Documents**: Ask the agent to process your CV/documents
5. **Research Programs**: Get personalized graduate program recommendations

## Authentication
All API endpoints (except auth) require a JWT token in the Authorization header:
\`Authorization: Bearer <your_jwt_token>\`
    `)
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Authentication', 'Google OAuth login, user profiles, and token management')
    .addTag('Agent', 'AI agent chat, conversations, and real-time streaming responses')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 Swagger documentation: http://localhost:${port}/api`);
}

bootstrap();
