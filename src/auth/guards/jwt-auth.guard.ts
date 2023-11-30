import { ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { GqlExecutionContext } from "@nestjs/graphql";
import { Request } from "express";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  getRequest(context: ExecutionContext) {
    // Check if the request is in the GraphQL context

    if (this.isGraphQLContext(context)) {
      const ctx = GqlExecutionContext.create(context);
      return ctx.getContext().req;
    }
    // Handle REST context
    const request = context.switchToHttp().getRequest();
    this.attachAccessTokenFromQuery(request);

    return request;
  }

  handleRequest(
    err: unknown,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user: any,
    info: unknown,
    context: ExecutionContext,
  ) {
    // const allowAny = this.reflector.get<string[]>(
    //   "allow-any",
    //   context.getHandler(),
    // );

    if (user) {
      return user;
    }
    // if (allowAny) {
    //   return null;
    // }
    // throw new UnauthorizedException();
    return null;
  }

  private isGraphQLContext(context: ExecutionContext): boolean {
    const contextType = context.getType();

    return (contextType as string) === "graphql";
  }

  private attachAccessTokenFromQuery(request: Request) {
    const token = request.query?.access_token;
    if (!request.headers.authorization && token) {
      request.headers.authorization = `Bearer ${token}`;
    }
  }
}
