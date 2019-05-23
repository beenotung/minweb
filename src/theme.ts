import { ObjectMap } from './utils';

export type TextDecorator = (s: string) => string;

export const plainTextDecorator: TextDecorator = s => s;

const colors = ['#33cc00', '#00c0dc'];
let c = 0;
const getColor = () => colors[c++ % colors.length];

export const debugTextDecorator: TextDecorator = s =>
  s
    .split(' ')
    .map(s => `<span style="background: ${getColor()}">${s}</span> `)
    .join(' ');

export type Theme = 'default' | 'light' | 'dark' | 'console';

const genColorStyle = (
  background: string,
  color: string,
  a_normal?: string,
  a_visited?: string,
) => {
  let a = '';
  if (a_normal) {
    a += 'a{color:' + a_normal + ';}';
  }
  if (a_visited) {
    a += 'a:visited{color:' + a_visited + ';}';
  }
  return `<style>body,input,textarea{background:${background};color: ${color};}${a}</style>`;
};

export const ThemeStyles = new ObjectMap<Theme, string>();
ThemeStyles.set('default', '');
ThemeStyles.set('light', genColorStyle('lightgrey', 'black'));
ThemeStyles.set(
  'dark',
  genColorStyle('black', 'lightgrey', 'cornflowerblue', 'chocolate'),
);
ThemeStyles.set(
  'console',
  genColorStyle('black', 'lightgreen', 'green', 'darkorchid'),
);
