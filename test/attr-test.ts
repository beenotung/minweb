import { main } from '../src/main';

main('http://conal.net/blog/posts/the-c-language-is-purely-functional', {
  inject_style: true,
}).then(s => console.log(s));
