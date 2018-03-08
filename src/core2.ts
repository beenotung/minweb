export type HTMLType = 'command';

export interface HTMLItem {
  type: HTMLType;
  tag?: HTMLTag;
  command?: HTMLTag;
}

export interface HTMLCommand {
  name: string;
  attributes: HTMLAttribute[];
}

export interface HTMLAttribute {
  name: string;
  value?: string;
}

export interface HTMLTag {
  tagName: string;
  attributes: HTMLAttribute[];
}

export function parseWord(s: string, offset = 0) {

}

export function parseHTMLText(s: string, offset = 0, emit: () =>) {
  switch (s[offset]) {
    case '<':
  }
}
