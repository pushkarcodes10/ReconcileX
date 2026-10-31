import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface OrgContext {
  id: string;
  name: string;
  slug: string;
}

export const CurrentOrg = createParamDecorator(
  (data: keyof OrgContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const org = request.organization as OrgContext;
    return data ? org?.[data] : org;
  },
);
