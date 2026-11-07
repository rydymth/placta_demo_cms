import { Request, Response, NextFunction } from "express"

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    console.info(`[New Req: ${new Date().toISOString()}]:\nReq Method: ${req.method}\nReq Url: ${req.url}`);
    next();
}
