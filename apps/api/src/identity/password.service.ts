import { BadRequestException, Injectable } from '@nestjs/common';
import { hash, verify } from 'argon2';

@Injectable()
export class PasswordService {
  validate(password: string): void {
    if (password.length < 12 || password.length > 128)
      throw new BadRequestException('Password must be between 12 and 128 characters.');
  }

  async hash(password: string): Promise<string> {
    this.validate(password);
    return hash(password, { type: 2, memoryCost: 65_536, timeCost: 3, parallelism: 1 });
  }

  async verify(hashValue: string, password: string): Promise<boolean> {
    try {
      return await verify(hashValue, password);
    } catch {
      return false;
    }
  }
}
