declare module "express" {
  namespace express {
    interface Request {
      body?: unknown;
      query?: Record<string, unknown>;
      params?: Record<string, string>;
      headers: Record<string, string | string[] | undefined>;
    }

    interface Response {
      headersSent: boolean;
      setHeader(name: string, value: string): void;
      status(code: number): Response;
      json(body: unknown): Response;
      send(body: unknown): Response;
      end(): void;
    }

    type NextFunction = () => void;
    type Handler = (
      req: Request,
      res: Response,
      next: NextFunction,
    ) => unknown;

    interface Application {
      use(handler: Handler): void;
      use(handler: unknown): void;
      all(path: string, handler: Handler): void;
      get(path: string, handler: Handler): void;
      listen(port: number, callback?: () => void): void;
    }

    function json(options?: unknown): Handler;
    function urlencoded(options?: unknown): Handler;
  }

  function express(): express.Application;
  export = express;
}
