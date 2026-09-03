import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProgressService } from './progress.service';
import { ProgressController } from './progress.controller';
import { ProgressEntry, ProgressEntrySchema } from './progress.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ProgressEntry.name, schema: ProgressEntrySchema }]),
  ],
  controllers: [ProgressController],
  providers: [ProgressService],
})
export class ProgressModule {}
