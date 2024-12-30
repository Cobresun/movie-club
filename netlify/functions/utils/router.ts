// To fix some issues with definition resulting middlewares

import {
  HandlerContext,
  HandlerEvent,
  HandlerResponse,
} from "@netlify/functions";
import { Path } from "path-parser";

import { internalServerError, methodNotAllowed, notFound } from "./responses";
import { StringRecord } from "./types";

const RouterResponseSym = Symbol();

export type RouterResponse = {
  type: typeof RouterResponseSym;
  response: HandlerResponse;
};

export function createRouterResponse(
  response: HandlerResponse,
): RouterResponse {
  return {
    type: RouterResponseSym,
    response,
  };
}

export function isRouterResponse(
  response: unknown,
): response is RouterResponse {
  return (
    typeof response === "object" &&
    response !== null &&
    "type" in response &&
    response.type === RouterResponseSym
  );
}

export interface Request {
  event: HandlerEvent;
  context: HandlerContext;
  params: StringRecord;
}

export function isRequest(req: unknown): req is Request {
  return (
    typeof req === "object" &&
    req !== null &&
    "event" in req &&
    "context" in req &&
    "params" in req
  );
}

export type MiddlewareCallback<T, R> = (
  req: T,
  res: (data: HandlerResponse) => RouterResponse,
) => Promise<RouterResponse | R>;

/**
 * A single chain “item” can be either a middleware or a Router.
 */
export type UseItem<In extends Request, Out> =
  | MiddlewareCallback<In, Out>
  | Router<In>;

/**
 * The signature of the chaining function, enumerating multiple overloads
 * so that TypeScript can infer the type transformations step by step.
 *
 * Each overload ensures the final item returns a RouterResponse.
 */
export interface ChainMethod<TInput extends Request> {
  // Overload 0: no middlewares
  (path: string): void;

  // Overload 1: just one item, must produce RouterResponse from TInput
  (
    path: string,
    c1:
      | UseItem<TInput, Request /* not used here */>
      | UseItem<TInput, RouterResponse>,
  ): void;

  // Overload 2
  <A extends Request>(
    path: string,
    c1: UseItem<TInput, A>,
    c2: UseItem<A, RouterResponse>,
  ): void;

  // Overload 3
  <A extends Request, B extends Request>(
    path: string,
    c1: UseItem<TInput, A>,
    c2: UseItem<A, B>,
    c3: UseItem<B, RouterResponse>,
  ): void;

  // Overload 4
  <A extends Request, B extends Request, C extends Request>(
    path: string,
    c1: UseItem<TInput, A>,
    c2: UseItem<A, B>,
    c3: UseItem<B, C>,
    c4: UseItem<C, RouterResponse>,
  ): void;

  // Overload 5
  <A extends Request, B extends Request, C extends Request, D extends Request>(
    path: string,
    c1: UseItem<TInput, A>,
    c2: UseItem<A, B>,
    c3: UseItem<B, C>,
    c4: UseItem<C, D>,
    c5: UseItem<D, RouterResponse>,
  ): void;

  // Overload 6
  <
    A extends Request,
    B extends Request,
    C extends Request,
    D extends Request,
    E extends Request,
  >(
    path: string,
    c1: UseItem<TInput, A>,
    c2: UseItem<A, B>,
    c3: UseItem<B, C>,
    c4: UseItem<C, D>,
    c5: UseItem<D, E>,
    c6: UseItem<E, RouterResponse>,
  ): void;

  // Overload 7
  <
    A extends Request,
    B extends Request,
    C extends Request,
    D extends Request,
    E extends Request,
    F extends Request,
  >(
    path: string,
    c1: UseItem<TInput, A>,
    c2: UseItem<A, B>,
    c3: UseItem<B, C>,
    c4: UseItem<C, D>,
    c5: UseItem<D, E>,
    c6: UseItem<E, F>,
    c7: UseItem<F, RouterResponse>,
  ): void;

  // Overload 8
  <
    A extends Request,
    B extends Request,
    C extends Request,
    D extends Request,
    E extends Request,
    F extends Request,
    G extends Request,
  >(
    path: string,
    c1: UseItem<TInput, A>,
    c2: UseItem<A, B>,
    c3: UseItem<B, C>,
    c4: UseItem<C, D>,
    c5: UseItem<D, E>,
    c6: UseItem<E, F>,
    c7: UseItem<F, G>,
    c8: UseItem<G, RouterResponse>,
  ): void;

  // Overload 9
  <
    A extends Request,
    B extends Request,
    C extends Request,
    D extends Request,
    E extends Request,
    F extends Request,
    G extends Request,
    H extends Request,
  >(
    path: string,
    c1: UseItem<TInput, A>,
    c2: UseItem<A, B>,
    c3: UseItem<B, C>,
    c4: UseItem<C, D>,
    c5: UseItem<D, E>,
    c6: UseItem<E, F>,
    c7: UseItem<F, G>,
    c8: UseItem<G, H>,
    c9: UseItem<H, RouterResponse>,
  ): void;

  // Fallback for 10+ items in chain:
  <
    A extends Request,
    B extends Request,
    C extends Request,
    D extends Request,
    E extends Request,
    F extends Request,
    G extends Request,
    H extends Request,
    I extends Request,
  >(
    path: string,
    c1: UseItem<TInput, A>,
    c2: UseItem<A, B>,
    c3: UseItem<B, C>,
    c4: UseItem<C, D>,
    c5: UseItem<D, E>,
    c6: UseItem<E, F>,
    c7: UseItem<F, G>,
    c8: UseItem<G, H>,
    c9: UseItem<H, I>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- we can't keep enumerating
    ...rest: Array<UseItem<any, RouterResponse>>
  ): void;
}

interface Route {
  path: Path<StringRecord>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- storing as any. type is checked on setting up chain
  callbacks: ReadonlyArray<MiddlewareCallback<any, any>>;
}

enum HTTPMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
}

function wrapRouterAsMiddleware<In extends Request>(
  router: Router<In>,
): MiddlewareCallback<In, RouterResponse> {
  return async (req, res) => {
    const hr = await router.route(req);
    return res(hr); // Convert the HandlerResponse to RouterResponse
  };
}
export class Router<T extends Request = Request> {
  private subRoutes: Route[];
  private routes: Record<HTTPMethod, Route[]>;
  private baseUrl: string;

  public get: ChainMethod<T>;
  public post: ChainMethod<T>;
  public put: ChainMethod<T>;
  public delete: ChainMethod<T>;

  public use: ChainMethod<T>;

  constructor(baseUrl?: string) {
    this.routes = {
      [HTTPMethod.GET]: [],
      [HTTPMethod.POST]: [],
      [HTTPMethod.PUT]: [],
      [HTTPMethod.DELETE]: [],
    };
    this.subRoutes = [];
    this.baseUrl = baseUrl ?? "";

    this.get = this.createChainMethod(HTTPMethod.GET);
    this.post = this.createChainMethod(HTTPMethod.POST);
    this.put = this.createChainMethod(HTTPMethod.PUT);
    this.delete = this.createChainMethod(HTTPMethod.DELETE);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- type checking is done on setting up chain
    this.use = ((path: string, ...items: Array<UseItem<any, unknown>>) => {
      const callbacks: MiddlewareCallback<unknown, unknown>[] = items.map(
        (item) =>
          item instanceof Router ? wrapRouterAsMiddleware(item) : item,
      );
      this.subRoutes.push({
        path: this.getPath(path),
        callbacks,
      });
    }) as ChainMethod<T>;
  }

  private createChainMethod(method: HTTPMethod): ChainMethod<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- type checking is done on setting up chain
    return ((path: string, ...items: Array<UseItem<any, unknown>>) => {
      const callbacks: MiddlewareCallback<unknown, unknown>[] = items.map(
        (item) =>
          item instanceof Router ? wrapRouterAsMiddleware(item) : item,
      );
      this.routes[method].push({
        path: this.getPath(path),
        callbacks,
      });
    }) as ChainMethod<T>;
  }

  private getPath(pathStr: string) {
    return new Path<StringRecord>(`${this.baseUrl}${pathStr}`);
  }

  async route(req: T): Promise<HandlerResponse> {
    const path = req.event.path;

    // 1) Try sub-routes
    for (const subRoute of this.subRoutes) {
      const pathTest = subRoute.path.partialTest(path);
      if (pathTest) {
        return this.dispatch({ ...req, params: pathTest }, subRoute.callbacks);
      }
    }

    // 2) Try main routes for the actual HTTP method
    const httpMethod = req.event.httpMethod as HTTPMethod;
    for (const route of this.routes[httpMethod]) {
      const pathTest = route.path.test(path);
      if (pathTest) {
        return this.dispatch({ ...req, params: pathTest }, route.callbacks);
      }
    }

    // 3) If the path matches but method is different => 405
    for (const methodKey of Object.keys(this.routes)) {
      for (const route of this.routes[methodKey as HTTPMethod]) {
        const pathTest = route.path.test(path);
        if (pathTest) {
          return methodNotAllowed();
        }
      }
    }

    // 4) Else => 404
    return notFound();
  }

  /**
   * Execute the chain of middlewares. The final callback in the chain
   * is guaranteed (by the time of definition) to return a RouterResponse.
   */
  private async dispatch(
    req: T,
    callbacks: ReadonlyArray<MiddlewareCallback<unknown, unknown>>,
  ): Promise<HandlerResponse> {
    let current: unknown = req;

    for (const callback of callbacks) {
      const result = await callback(current, createRouterResponse);

      if (isRouterResponse(result)) {
        return result.response;
      }

      current = result;
    }
    return internalServerError();
  }
}
