import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  console.error('[Error]', err.message, err.stack?.split('\n')[1]);
  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { message: err.message }),
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: `${req.method} ${req.path} not found` });
}
