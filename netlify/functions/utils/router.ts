import { Path } from "path-parser";

import { internalServerError, methodNotAllowed, notFound } from "./responses";
import { StringRecord } from "./types";

const RouterResponseSym = Symbol();

export type RouterResponse = {
  type: typeof RouterResponseSym;
  response: Response;
};

export function createRouterResponse(response: Response): RouterResponse {
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

export interface FnRequest {
  request: globalThis.Request;
  path: string;
  method: string;
  headers: Headers;
  query: URLSearchParams;
  params: StringRecord;
}

export function isFnRequest(req: unknown): req is FnRequest {
  return (
    typeof req === "object" &&
    req !== null &&
    "request" in req &&
    "path" in req &&
    "params" in req
  );
}

export type MiddlewareCallback<T, R> = (
  req: T,
  res: (data: Response) => RouterResponse,
) => Promise<RouterResponse | R>;

/**
 * A single chain "item" can be either a middleware or a Router.
 */
export type UseItem<In extends FnRequest, Out> =
  | MiddlewareCallback<In, Out>
  | Router<In>;

/**
 * The signature of the chaining function, enumerating multiple overloads
 * so that TypeScript can infer the type transformations step by step.
 *
 * Each overload ensures the final item returns a RouterResponse.
 */
export interface ChainMethod<TInput extends FnRequest> {
  // Overload 0: no middlewares
  (path: string): void;

  // Overload 1: just one item, must produce RouterResponse from TInput
  (path: string, c1: UseItem<TInput, RouterResponse>): void;

  <A extends FnRequest>(
    path: string,
    c1: UseItem<TInput, A>,
    c2: UseItem<A, RouterResponse>,
  ): void;

  <A extends FnRequest, B extends FnRequest>(
    path: string,
    c1: UseItem<TInput, A>,
    c2: UseItem<A, B>,
    c3: UseItem<B, RouterResponse>,
  ): void;

  <A extends FnRequest, B extends FnRequest, C extends FnRequest>(
    path: string,
    c1: UseItem<TInput, A>,
    c2: UseItem<A, B>,
    c3: UseItem<B, C>,
    c4: UseItem<C, RouterResponse>,
  ): void;

  <
    A extends FnRequest,
    B extends FnRequest,
    C extends FnRequest,
    D extends FnRequest,
  >(
    path: string,
    c1: UseItem<TInput, A>,
    c2: UseItem<A, B>,
    c3: UseItem<B, C>,
    c4: UseItem<C, D>,
    c5: UseItem<D, RouterResponse>,
  ): void;

  <
    A extends FnRequest,
    B extends FnRequest,
    C extends FnRequest,
    D extends FnRequest,
    E extends FnRequest,
  >(
    path: string,
    c1: UseItem<TInput, A>,
    c2: UseItem<A, B>,
    c3: UseItem<B, C>,
    c4: UseItem<C, D>,
    c5: UseItem<D, E>,
    c6: UseItem<E, RouterResponse>,
  ): void;

  <
    A extends FnRequest,
    B extends FnRequest,
    C extends FnRequest,
    D extends FnRequest,
    E extends FnRequest,
    F extends FnRequest,
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
    A extends FnRequest,
    B extends FnRequest,
    C extends FnRequest,
    D extends FnRequest,
    E extends FnRequest,
    F extends FnRequest,
    G extends FnRequest,
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
    A extends FnRequest,
    B extends FnRequest,
    C extends FnRequest,
    D extends FnRequest,
    E extends FnRequest,
    F extends FnRequest,
    G extends FnRequest,
    H extends FnRequest,
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
    A extends FnRequest,
    B extends FnRequest,
    C extends FnRequest,
    D extends FnRequest,
    E extends FnRequest,
    F extends FnRequest,
    G extends FnRequest,
    H extends FnRequest,
    I extends FnRequest,
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

function wrapRouterAsMiddleware<In extends FnRequest>(
  router: Router<In>,
): MiddlewareCallback<In, RouterResponse> {
  return async (req, res) => {
    const response = await router.route(req);
    return res(response);
  };
}
export class Router<T extends FnRequest = FnRequest> {
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

  async route(req: T): Promise<Response> {
    const path = req.path;

    // 1) Try sub-routes
    for (const subRoute of this.subRoutes) {
      const pathTest = subRoute.path.partialTest(path);
      if (pathTest) {
        return this.dispatch({ ...req, params: pathTest }, subRoute.callbacks);
      }
    }

    // 2) Try main routes for the actual HTTP method
    const httpMethod = req.method as HTTPMethod;
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
  ): Promise<Response> {
    let current: unknown = req;

    for (const callback of callbacks) {
      try {
        const result = await callback(current, createRouterResponse);

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
