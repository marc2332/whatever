import sample_abi from './index.js';

class Stack {
    ops: any= [];
    push(op: any){
        this.ops.push(op)
    }

    executeFunctionByName(name: string, args: any[]){
        let res = null;
        this.ops.forEach((action: any) => {
            if(action.name === name) {
                const a = action.fn(args);
                res = a.computedValue
            }
        })
        return res;
    }

    getValueByVariableName(name: string){
        let res = null;
        this.ops.forEach((action: any) => {
            if(action.name === name) res = action.computedValue
        })
        return res;
    }
}


class VM {
    abi: any;
    stack: Stack;
    constructor(abi: any) {
        this.abi = abi;
        this.stack = new Stack();
    }

    runScope(abi: any): any{
        let res = null;
        abi.body.forEach((action: any) => {
            switch (action.type){
                case 'function':


                    this.stack.push({
                        name: action.name,
                        fn: (args: any[]) => {
                            args.forEach((arg, i) => {
                                const finalVar = {
                                    type: 'variable',
                                    name: action.arguments[i].name,
                                    computedValue: arg.value
                                }

                                this.stack.push(finalVar)
                            })

                            return this.runScope(action)
                        }
                    })

                    break;
                case 'return':
                    const finalRet = {
                        type: 'value',
                        computedValue: null
                    }
                    switch (action.value.type) {
                        case 'reference':
                            finalRet.computedValue = this.stack.getValueByVariableName(action.value.value)
                            break;
                        case 'string':
                            finalRet.computedValue = action.value.value
                            break;
                    }
                    res = finalRet
                    break;
                case 'variable':
                    const finalVar = {
                        type: 'variable',
                        name: action.name,
                        computedValue: null
                    }
                    switch (action.value.type) {
                        case 'call':
                            finalVar.computedValue = this.stack.executeFunctionByName(action.value.name, action.value.arguments)
                            break;
                    }
                    this.stack.push(finalVar)
                    break;
            }
        })
        return res
    }

    run(){
        return this.runScope(this.abi)
    }
}


const vm0 = new VM(sample_abi);

const res = vm0.run();

console.log(res.computedValue)

















