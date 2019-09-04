export interface Context {
  definitions: () => void;
  tests: () => void;
  reset?: () => void;
}
