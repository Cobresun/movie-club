import {
  HandlerContext,
  HandlerEvent,
  HandlerResponse,
} from "@netlify/functions";
import { Path } from "path-parser";

import { internalServerError, methodNotAllowed, notFound } from "./responses";
import { StringRecord } from "./types";

export type MiddewareCallback = (
  event: HandlerEvent,
  context: HandlerContext,
  params: StringRecord,
  next: () => Promise<HandlerResponse>
) => Promise<HandlerResponse>;

interface Route {
  path: Path<StringRecord>;
  callbacks: MiddewareCallback[];
}

interface SubRouter {
  path: Path<StringRecord>;
  router: Router;
}

enum HTTPMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
}

export class Router {
  private subRouters: SubRouter[];
  private routes: Record<HTTPMethod, Route[]>;
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.routes = {
      [HTTPMethod.GET]: [],
      [HTTPMethod.POST]: [],
      [HTTPMethod.PUT]: [],
      [HTTPMethod.DELETE]: [],
    };
    this.subRouters = [];
    this.baseUrl = baseUrl ?? "";
  }

  private addRoute(
    method: HTTPMethod,
    pathStr: string,
    callbacks: MiddewareCallback[]
  ) {
    this.routes[method].push({
      path: this.getPath(pathStr),
      callbacks,
    });
  }

  get(path: string, ...callbacks: MiddewareCallback[]) {
    this.addRoute(HTTPMethod.GET, path, callbacks);
  }
  post(path: string, ...callbacks: MiddewareCallback[]) {
    this.addRoute(HTTPMethod.POST, path, callbacks);
  }
  put(path: string, ...callbacks: MiddewareCallback[]) {
    this.addRoute(HTTPMethod.PUT, path, callbacks);
  }
  delete(path: string, ...callbacks: MiddewareCallback[]) {
    this.addRoute(HTTPMethod.DELETE, path, callbacks);
  }

  use(pathStr: string, router: Router) {
    this.subRouters.push({ path: this.getPath(pathStr), router });
  }

  private getPath(pathStr: string) {
    return new Path<StringRecord>(`${this.baseUrl}${pathStr}`);
  }

  async route(
    event: HandlerEvent,
    context: HandlerContext
  ): Promise<HandlerResponse> {
    for (const subRouter of this.subRouters) {
      const pathTest = subRouter.path.partialTest(event.path);
      if (pathTest) {
        return subRouter.router.route(event, context);
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
    console.log(event);
    console.log(context);
    return notFound();
  }

  dispatch(
    event: HandlerEvent,
    context: HandlerContext,
    params: StringRecord,
    route: MiddewareCallback[]
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
