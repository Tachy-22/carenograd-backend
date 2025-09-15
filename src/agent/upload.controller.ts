import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpException,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AgentService } from './agent.service';
import { DocumentUploadService } from './document-upload.service';
import type { User } from '../database/database.service';

interface AuthenticatedRequest {
  user: User;
}

@ApiTags('Agent')
@Controller('agent')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class UploadController {
  constructor(
    private readonly agentService: AgentService,
    private readonly documentUploadService: DocumentUploadService
  ) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload and process a PDF document' })
  @ApiResponse({ status: 200, description: 'Document uploaded and processing started' })
  @ApiResponse({ status: 400, description: 'Invalid file or file validation failed' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
      },
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only PDF files are allowed'), false);
        }
      },
    }),
  )
  async uploadDocument(@UploadedFile() file: Express.Multer.File, @Req() req: AuthenticatedRequest) {
    console.log('📁 Upload started:', file?.originalname, `(${file ? (file.size / 1024 / 1024).toFixed(1) : 'unknown'} MB)`);
    
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Validate file using the service
    const validation = this.documentUploadService.validateFile(file);
    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }

    try {
      // SPLIT APPROACH: Handle chat and file processing separately
      
      // 1. Send simple chat message first (fast response)
      console.log('💬 Registering upload with agent...');
      const chatPromise = this.agentService.chat(req.user, {
        message: `I have just uploaded my document "${file.originalname}" (${(file.size / 1024 / 1024).toFixed(1)} MB) to your knowledge base. The document is being processed and will be available for queries shortly. Please acknowledge that you understand I've uploaded this document and confirm you'll be able to analyze it once processing is complete.`,
      });

      // 2. Start document processing concurrently (background)
      console.log('📤 Starting document processing...');
      const processingPromise = this.documentUploadService.processDocument({
        userId: req.user.id,
        fileBuffer: file.buffer,
        filename: file.originalname,
        metadata: {
          title: file.originalname.replace('.pdf', ''),
          category: 'user_upload',
        },
      });

      // Wait for chat response (should be fast)
      const chatResult = await chatPromise;
      console.log('✅ Chat response received');

      // Start processing in background but don't wait
      processingPromise
        .then(async (result) => {
          if (result.success) {
            console.log(`🎉 Document processing completed: ${file.originalname}`);
            
            // Send follow-up message to agent
            try {
              await this.agentService.chat(req.user, {
                message: `Document processing complete! "${file.originalname}" has been successfully processed and is now available in your knowledge base with ${result.document?.chunkCount || 0} searchable chunks. You can now answer questions about this document.`,
                conversationId: chatResult.conversationId,
              });
            } catch (error) {
              console.error('Failed to send completion message:', error);
            }
          } else {
            console.error(`💥 Document processing failed: ${file.originalname} - ${result.error}`);
          }
        })
        .catch(error => {
          console.error(`💥 Document processing error: ${file.originalname}`, error);
        });

      // Return fast response
      return {
        success: true,
        filename: file.originalname,
        originalSize: file.size,
        mimeType: file.mimetype,
        status: 'processing',
        message: 'Document uploaded successfully and is being processed in the background',
        agentResponse: chatResult.response,
        conversationId: chatResult.conversationId,
        messageId: chatResult.messageId,
        uploadedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error('❌ Upload error:', error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        `Failed to upload document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}