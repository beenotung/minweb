import { IncomingMessage as Request, ServerResponse as Response } from 'http';
import { handle } from './ui';

module.exports = function(context, req: Request, res: Response) {
  handle(req, res);
};
