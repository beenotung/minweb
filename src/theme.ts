import {TextDecorator} from "./core";

export const plainTextDecorator: TextDecorator = s => s;

const colors = [
  '#33cc00'
  , '#00c0dc'
];
let c = 0;
const getColor = () => colors[(c++) % colors.length];

export const debugTextDecorator: TextDecorator = s =>
  s.split(' ')
    .map(s => `<span style="background: ${getColor()}">${s}</span> `)
    .join(' ');

export type Theme = 'default' | 'light' | 'dark' | 'console';

const genColorStyle = (background: string, color: string) => `<style>body,input,textarea{background:${background};color: ${color};}</style>`;
export const ThemeStyles = new Map<Theme, string>();
ThemeStyles.set('default', '');
ThemeStyles.set('light', genColorStyle('lightgrey', 'black'));
ThemeStyles.set('dark', genColorStyle('black', 'lightgrey'));
ThemeStyles.set('console', genColorStyle('black', 'lightgreen'));
