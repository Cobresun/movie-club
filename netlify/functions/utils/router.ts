import {
  HandlerContext,
  HandlerEvent,
  HandlerResponse,
} from "@netlify/functions";
import { Path } from "path-parser";

import { internalServerError, methodNotAllowed, notFound } from "./responses";
import { StringRecord } from "./types";

export type MiddlewareCallback = (
  event: HandlerEvent,
  context: HandlerContext,
  params: StringRecord,
  next: () => Promise<HandlerResponse>
) => Promise<HandlerResponse>;

interface Route {
  path: Path<StringRecord>;
  callbacks: MiddlewareCallback[];
}

enum HTTPMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
}

export class Router {
  private subRoutes: Route[];
  private routes: Record<HTTPMethod, Route[]>;
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.routes = {
      [HTTPMethod.GET]: [],
      [HTTPMethod.POST]: [],
      [HTTPMethod.PUT]: [],
      [HTTPMethod.DELETE]: [],
    };
    this.subRoutes = [];
    this.baseUrl = baseUrl ?? "";
  }

  private addRoute(
    method: HTTPMethod,
    pathStr: string,
    callbacks: MiddlewareCallback[]
  ) {
    this.routes[method].push({
      path: this.getPath(pathStr),
      callbacks,
    });
  }

  get(path: string, ...callbacks: MiddlewareCallback[]) {
    this.addRoute(HTTPMethod.GET, path, callbacks);
  }
  post(path: string, ...callbacks: MiddlewareCallback[]) {
    this.addRoute(HTTPMethod.POST, path, callbacks);
  }
  put(path: string, ...callbacks: MiddlewareCallback[]) {
    this.addRoute(HTTPMethod.PUT, path, callbacks);
  }
  delete(path: string, ...callbacks: MiddlewareCallback[]) {
    this.addRoute(HTTPMethod.DELETE, path, callbacks);
  }

  use(pathStr: string, ...callbacks: (MiddlewareCallback | Router)[]) {
    const resultCallbacks: MiddlewareCallback[] = callbacks.map((callback) => {
      if (callback instanceof Router) {
        return (event, context) => callback.route(event, context);
      } else {
        return callback;
      }
    });
    this.subRoutes.push({
      path: this.getPath(pathStr),
      callbacks: resultCallbacks,
    });
  }

  private getPath(pathStr: string) {
    return new Path<StringRecord>(`${this.baseUrl}${pathStr}`);
  }

  async route(
    event: HandlerEvent,
    context: HandlerContext
  ): Promise<HandlerResponse> {
    for (const subRoute of this.subRoutes) {
      const pathTest = subRoute.path.partialTest(event.path);
      if (pathTest) {
        return this.dispatch(event, context, pathTest, subRoute.callbacks);
      }
    }

    const httpMethod = event.httpMethod as HTTPMethod;
    for (const route of this.routes[httpMethod]) {
      const pathTest = route.path.test(event.path);
      if (pathTest) {
        return this.dispatch(event, context, pathTest, route.callbacks);
      }
    }

    for (const method of Object.keys(this.routes)) {
      for (const route of this.routes[method as HTTPMethod]) {
        const pathTest = route.path.test(event.path);
        if (pathTest) {
          return methodNotAllowed();
        }
      }
    }
    return notFound();
  }

  dispatch(
    event: HandlerEvent,
    context: HandlerContext,
    params: StringRecord,
    route: MiddlewareCallback[]
  ) {
    let idx = 0;
    return next();
    async function next(): Promise<HandlerResponse> {
      const callback = route[idx++];
      if (callback) {
        return callback(event, context, params, next);
      } else {
        return internalServerError();
      }
    }
  }
}
