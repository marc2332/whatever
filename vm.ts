import {
  AnyVmOperation,
  VmABI,
  VmCachedOperations,
  VmOperationFunction,
  VmOperations,
  VmOperationVariable,
  VmResult,
  VmScopeResult,
} from "./types.ts";

export class Memory {
  ops: VmOperations = [];

  constructor(initialOps: VmOperations) {
    this.ops = initialOps;
  }

  push(op: AnyVmOperation) {
    this.ops.push(op);
  }

  executeFunctionByName(name: string, args: any[]) {
    let res = null;
    this.ops.forEach((op: AnyVmOperation) => {
      const funcOp = <VmOperationFunction> op;
      if (funcOp.name === name) {
        const functionResult = funcOp.fn(args) || { computedValue: null };
        res = functionResult.computedValue;
      }
    });
    return res;
  }

  getValueByVariableName(name: string) {
    let res = null;
    this.ops.forEach((action: any) => {
      if (action.name === name) res = action.computedValue;
    });
    return res;
  }

  setValueByVariableName<T>(name: string, newValue: T) {
    this.ops.forEach((op: AnyVmOperation) => {
      const varOp = <VmOperationVariable> op;
      if (varOp.name === name) varOp.computedValue = newValue;
    });
  }
}

export default class VM {
  abi: VmABI;
  cachedOperations: VmCachedOperations;
  constructor(abi: VmABI, cachedOperations: VmCachedOperations) {
    this.abi = abi;
    this.cachedOperations = cachedOperations;
  }

  runScope(abi: VmABI, scoppedOps: any[]): VmScopeResult {
    const memory = new Memory(scoppedOps);
    let res: any = {
      computedValue: 0,
    };
    abi.body.forEach((action: any) => {
      switch (action.type) {
        case "assignment":
          let valueAssign = null;

          switch (action.value.type) {
            case "reference":
              valueAssign = memory.getValueByVariableName(action.value.value);
              break;
          }

          memory.setValueByVariableName(action.name, valueAssign);

          break;

        case "function":
          memory.push({
            type: "function",
            name: action.name,
            fn: (args: any[]) => {
              args.forEach((arg, i) => {
                const finalVar = {
                  type: "variable",
                  name: action.arguments[i].name,
                  computedValue: arg.value,
                };

                memory.push(finalVar);
              });

              return this.runScope(action, memory.ops);
            },
          });

          break;

        case "call":
          memory.executeFunctionByName(action.name, action.arguments);

          break;

        case "return":
          const finalRet = {
            type: "value",
            computedValue: null,
          };

          switch (action.value.type) {
            case "call":
              finalRet.computedValue = memory.executeFunctionByName(
                action.value.name,
                action.value.arguments,
              );
              break;
            case "reference":
              finalRet.computedValue = memory.getValueByVariableName(
                action.value.value,
              );
              break;
            case "string":
              finalRet.computedValue = action.value.value;
              break;
          }

          res = finalRet;
          break;
        case "variable":
          const finalVar: VmOperationVariable = {
            type: "variable",
            name: action.name,
            computedValue: null,
            isPublic: action.modifiers.pub,
          };
          if (action.value != null) {
            switch (action.value.type) {
              case "expression":
                finalVar.computedValue =
                  this.runScope(action.value, memory.ops).computedValue;
                break;
              case "call":
                finalVar.computedValue = memory.executeFunctionByName(
                  action.value.name,
                  action.value.arguments,
                );
                break;
              default:
                finalVar.computedValue = action.value.value;
            }
          } else {
            /*
                         * If the variable is not inicialized then assign to it a cached value in case it exists
                         */
            const cachedValue = this.cachedOperations[action.name];
            if (cachedValue != null) {
              finalVar.computedValue = cachedValue;
            }
          }

          memory.push(finalVar);
          break;
      }
    });
    return {
      computedValue: res.computedValue,
      memory: memory,
    };
  }

  run(): VmResult {
    const res = this.runScope(this.abi, []);
    const cachedOperations: VmCachedOperations = {};
    res.memory.ops.filter((op: AnyVmOperation) => {
      const varOp = <VmOperationVariable> op;
      if (varOp.isPublic === true) {
        cachedOperations[varOp.name] = varOp.computedValue;
      }
    });

    return {
      computedValue: res.computedValue,
      cachedOperations,
    };
  }
}
