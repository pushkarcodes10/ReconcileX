import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@reconcilex/db';

export interface MembershipContext {
  id: string;
  role: Role;
}

export const CurrentMembership = createParamDecorator(
  (data: keyof MembershipContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const membership = request.membership as MembershipContext;
    return data ? membership?.[data] : membership;
  },
);
