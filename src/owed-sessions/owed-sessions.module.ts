import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OwedSessionsService } from './owed-sessions.service';
import { OwedSessionsController } from './owed-sessions.controller';
import { OwedSession, OwedSessionSchema } from './owed-session.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: OwedSession.name, schema: OwedSessionSchema }])],
  controllers: [OwedSessionsController],
  providers: [OwedSessionsService],
  exports: [OwedSessionsService],
})
export class OwedSessionsModule {}
