import { createServer } from 'http';
import { handle } from './ui';

createServer(handle).listen(3000);
console.log('http://127.0.0.1:3000');
