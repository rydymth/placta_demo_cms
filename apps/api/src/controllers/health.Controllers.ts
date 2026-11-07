import { Request, Response } from "express"
import mongoose from "mongoose";

// Req needed to load in appuse
export const getHealth = (req: Request, res: Response): void => {
  if (mongoose.connection.readyState === 1)
    res.status(200).json({ status: 'OK', message: 'API backend working OK and mongo db connected' });
  else
    res.status(500).json({ status: 'Internal Server Error', message: 'Check logs' });
};
