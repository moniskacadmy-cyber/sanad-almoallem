import app from '../server.js';

export default async function handler(req: any, res: any) {
  req.url = '/api/health';
  return app(req, res);
}
