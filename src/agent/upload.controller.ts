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
  Body,
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

interface UploadRequestBody {
  conversationId?: string;
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
  @ApiOperation({ 
    summary: 'Upload and process a PDF document',
    description: 'Upload a PDF document and optionally specify a conversationId to keep upload messages in the same conversation thread'
  })
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
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File, 
    @Req() req: AuthenticatedRequest,
    @Body() body: UploadRequestBody
  ) {
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
      // Process document silently without sending any agent messages
      console.log('📤 Processing document...');
      const result = await this.documentUploadService.processDocument({
        userId: req.user.id,
        fileBuffer: file.buffer,
        filename: file.originalname,
        metadata: {
          title: file.originalname.replace('.pdf', ''),
          category: 'user_upload',
        },
      });

      if (result.success) {
        console.log(`🎉 Document processing completed: ${file.originalname}`);
        
        // Return success response - no automatic agent messages
        return {
          success: true,
          filename: file.originalname,
          originalSize: file.size,
          mimeType: file.mimetype,
          status: 'completed',
          message: `Document "${file.originalname}" uploaded and processed successfully. Ready for analysis with ${result.document?.chunkCount || 0} searchable chunks.`,
          document: result.document,
          processing: result.processing,
          uploadedAt: new Date().toISOString(),
        };
      } else {
        console.error(`💥 Document processing failed: ${file.originalname} - ${result.error}`);
        throw new HttpException(
          `Document processing failed: ${result.error}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

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