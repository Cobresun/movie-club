import { type HandlerContext, type HandlerEvent, type HandlerResponse } from "@netlify/functions";
import { Path } from "path-parser";

import { internalServerError, methodNotAllowed, notFound } from "./responses";
import { type StringRecord } from "./types";

const RouterResponseSym = Symbol("router-response");

export type RouterResponse = {
  type: typeof RouterResponseSym;
  response: HandlerResponse;
};

export function createRouterResponse(response: HandlerResponse): RouterResponse {
  return {
    type: RouterResponseSym,
    response,
  };
}

export function isRouterResponse(response: unknown): response is RouterResponse {
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

export type MiddlewareCallback<T, R> = (
  req: T,
  res: (data: HandlerResponse) => RouterResponse,
) => RouterResponse | R | Promise<RouterResponse | R>;

/**
 * A single chain “item” can be either a middleware or a Router.
 */
export type UseItem<In extends Request, Out> = MiddlewareCallback<In, Out> | Router<In>;

/**
 * The signature of the chaining function, enumerating multiple overloads
 * so that TypeScript can infer the type transformations step by step.
 *
 * Each overload ensures the final item returns a RouterResponse.
 */
export interface ChainMethod<TInput extends Request> {
  // Overload 0+1: no middlewares, or a single item producing RouterResponse
  (path: string, c1?: UseItem<TInput, RouterResponse>): void;

  <A extends Request>(path: string, c1: UseItem<TInput, A>, c2: UseItem<A, RouterResponse>): void;

  <A extends Request, B extends Request>(
    path: string,
    c1: UseItem<TInput, A>,
    c2: UseItem<A, B>,
    c3: UseItem<B, RouterResponse>,
  ): void;

  <A extends Request, B extends Request, C extends Request>(
    path: string,
    c1: UseItem<TInput, A>,
    c2: UseItem<A, B>,
    c3: UseItem<B, C>,
    c4: UseItem<C, RouterResponse>,
  ): void;

  <A extends Request, B extends Request, C extends Request, D extends Request>(
    path: string,
    c1: UseItem<TInput, A>,
    c2: UseItem<A, B>,
    c3: UseItem<B, C>,
    c4: UseItem<C, D>,
    c5: UseItem<D, RouterResponse>,
  ): void;

  <A extends Request, B extends Request, C extends Request, D extends Request, E extends Request>(
    path: string,
    c1: UseItem<TInput, A>,
    c2: UseItem<A, B>,
    c3: UseItem<B, C>,
    c4: UseItem<C, D>,
    c5: UseItem<D, E>,
    c6: UseItem<E, RouterResponse>,
  ): void;

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
    ...rest: UseItem<any, RouterResponse>[]
  ): void;
}

interface Route {
  path: Path<StringRecord>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- storing as any. type is checked on setting up chain
  callbacks: readonly MiddlewareCallback<any, any>[];
}

enum HTTPMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
}

function isHTTPMethod(value: string): value is HTTPMethod {
  return HTTP_METHODS.has(value);
}

const HTTP_METHODS: ReadonlySet<string> = new Set([
  HTTPMethod.GET,
  HTTPMethod.POST,
  HTTPMethod.PUT,
  HTTPMethod.DELETE,
]);

function wrapRouterAsMiddleware<In extends Request>(
  router: Router<In>,
): MiddlewareCallback<In, RouterResponse> {
  return async (req, res) => {
    const hr = await router.route(req);
    return res(hr); // Convert the HandlerResponse to RouterResponse
  };
}
export class Router<T extends Request = Request> {
  private readonly subRoutes: Route[];
  private readonly routes: Record<HTTPMethod, Route[]>;
  private readonly baseUrl: string;

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
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the rest-param implementation cannot match the overloaded ChainMethod interface without a cast
    this.use = ((path: string, ...items: UseItem<any, unknown>[]) => {
      const callbacks: MiddlewareCallback<unknown, unknown>[] = items.map((item) =>
        item instanceof Router ? wrapRouterAsMiddleware(item) : item,
      );
      this.subRoutes.push({
        path: this.getPath(path),
        callbacks,
      });
    }) as unknown as ChainMethod<T>;
  }

  private createChainMethod(method: HTTPMethod): ChainMethod<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- type checking is done on setting up chain
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the rest-param implementation cannot match the overloaded ChainMethod interface without a cast
    return ((path: string, ...items: UseItem<any, unknown>[]) => {
      const callbacks: MiddlewareCallback<unknown, unknown>[] = items.map((item) =>
        item instanceof Router ? wrapRouterAsMiddleware(item) : item,
      );
      this.routes[method].push({
        path: this.getPath(path),
        callbacks,
      });
    }) as unknown as ChainMethod<T>;
  }

  private getPath(pathStr: string) {
    return new Path<StringRecord>(`${this.baseUrl}${pathStr}`);
  }

  route(req: T): Promise<HandlerResponse> {
    const { path } = req.event;

    // 1) Try sub-routes
    for (const subRoute of this.subRoutes) {
      const pathTest = subRoute.path.partialTest(path);
      if (pathTest) {
        return this.dispatch({ ...req, params: pathTest }, subRoute.callbacks);
      }
    }

    // 2) Try main routes for the actual HTTP method
    if (isHTTPMethod(req.event.httpMethod)) {
      for (const route of this.routes[req.event.httpMethod]) {
        const pathTest = route.path.test(path);
        if (pathTest) {
          return this.dispatch({ ...req, params: pathTest }, route.callbacks);
        }
      }
    }

    // 3) If the path matches but method is different => 405
    for (const methodKey of Object.keys(this.routes)) {
      if (!isHTTPMethod(methodKey)) continue;
      for (const route of this.routes[methodKey]) {
        const pathTest = route.path.test(path);
        if (pathTest) {
          return Promise.resolve(methodNotAllowed());
        }
      }
    }

    // 4) Else => 404
    return Promise.resolve(notFound());
  }

  /**
   * Execute the chain of middlewares. The final callback in the chain
   * is guaranteed (by the time of definition) to return a RouterResponse.
   */
  private async dispatch(
    req: T,
    callbacks: readonly MiddlewareCallback<unknown, unknown>[],
  ): Promise<HandlerResponse> {
    let current: unknown = req;

    for (const middleware of callbacks) {
      try {
        const result = await middleware(current, createRouterResponse);

        if (isRouterResponse(result)) {
          return result.response;
        }

        current = result;
      } catch (e) {
        console.error(e);
        return internalServerError();
      }
    }
    return internalServerError();
  }
}
