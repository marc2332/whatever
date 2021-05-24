import { Memory } from "./vm.ts";

export interface Token {
  type: string;
  value: any;
  lineNumber: number;
}

export type TokensList = Token[];

export interface Argument {
  type: string;
  name: string;
  interface: string;
}

export type ArgumentsList = Argument[];

export interface Operation {
  name?: string;
  type: string;
  value: any;
}

export interface ScopeOperation extends Operation {
  name: string;
  body: any[];
  interface: string;
}

export interface CallOperation {
  type: string;
  name: string;
  arguments: TokensList;
}

export interface ReturnOperation extends Operation {
  value: CallOperation | Token;
}

export interface FunctionOperation extends ScopeOperation {
  modifiers: {
    pub: boolean;
  };
  arguments: ArgumentsList;
  interface: string;
}

export interface VariableOperation extends Operation {
  name: string;
  interface: string;
  value: any;
}

// VM

export interface VmOperation {
  type: string;
}

export type AnyVmOperation =
  | VmOperation
  | VmOperationFunction
  | VmOperationVariable;

export type VmOperations = AnyVmOperation[];

export interface VmOperationFunction extends VmOperation {
  fn: (...args: any) => any;
  name: string;
}

export interface VmOperationVariable extends VmOperation {
  name: string;
  computedValue: any;
  isPublic: boolean;
}

export interface VmABI {
  body: Operation[];
}

export interface VmScopeResult {
  computedValue: any;
  memory: Memory;
}

export type VmCachedOperations = {
  [key: string]: any;
};

export interface VmResult {
  computedValue: any;
  cachedOperations: VmCachedOperations;
}
