import { Module } from '@nestjs/common';

import { FileUploadModule } from 'src/engine/core-modules/file/file-upload/file-upload.module';
import { FilePathGuard } from 'src/engine/core-modules/file/guards/file-path-guard';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { EnvironmentService } from 'src/engine/integrations/environment/environment.service';

import { FileController } from './controllers/file.controller';
import { FileService } from './services/file.service';

@Module({
  imports: [FileUploadModule, JwtModule],
  providers: [FileService, EnvironmentService, FilePathGuard],
  exports: [FileService],
  controllers: [FileController],
})
export class FileModule {}
