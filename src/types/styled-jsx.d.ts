import 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      style: React.StyleHTMLAttributes<HTMLStyleElement> & {
        jsx?: boolean;
        global?: boolean;
        children?: string;
      };
    }
  }
}
