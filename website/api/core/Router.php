<?php
declare(strict_types=1);

class Router {
    private array $routes     = [];
    private array $middleware = [];

    public function get(string $path, callable $handler, array $middleware = []): void {
        $this->routes[] = ['GET', $path, $handler, $middleware];
    }
    public function post(string $path, callable $handler, array $middleware = []): void {
        $this->routes[] = ['POST', $path, $handler, $middleware];
    }
    public function put(string $path, callable $handler, array $middleware = []): void {
        $this->routes[] = ['PUT', $path, $handler, $middleware];
    }
    public function patch(string $path, callable $handler, array $middleware = []): void {
        $this->routes[] = ['PATCH', $path, $handler, $middleware];
    }
    public function delete(string $path, callable $handler, array $middleware = []): void {
        $this->routes[] = ['DELETE', $path, $handler, $middleware];
    }

    public function dispatch(Request $req): void {
        $method = $req->method();
        $uri    = $req->uri();  // already stripped of /api prefix

        foreach ($this->routes as [$routeMethod, $routePath, $handler, $middleware]) {
            if ($routeMethod !== $method) continue;

            $pattern = preg_replace('/\{[^}]+\}/', '([^/]+)', $routePath);
            $pattern = "#^$pattern$#";

            if (!preg_match($pattern, $uri, $matches)) continue;

            // Extract named params from path
            preg_match_all('/\{([^}]+)\}/', $routePath, $paramNames);
            array_shift($matches); // remove full match
            foreach ($paramNames[1] as $i => $name) {
                $req->setParam($name, $matches[$i] ?? '');
            }

            // Run middleware
            foreach ($middleware as $mw) {
                match($mw) {
                    'auth'  => AuthMiddleware::handle($req),
                    'admin' => AdminMiddleware::handle($req),
                    default => null,
                };
            }

            // Dispatch
            $handler($req);
            return;
        }

        Response::error('Not found', 404);
    }
}
