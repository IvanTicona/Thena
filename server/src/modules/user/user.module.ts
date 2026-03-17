import { Module } from '@nestjs/common';
import { UserController } from './infrastructure/controllers/user.controller.js';
import { UserService } from './application/services/user.service.js';

@Module({
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
