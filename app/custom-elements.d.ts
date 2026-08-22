import type { HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "mounjaro-tracker": HTMLAttributes<HTMLElement>;
    }
  }
}
