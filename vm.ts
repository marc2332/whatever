import sample_abi from './index.js';

class Memory {
    ops: any = [];

    constructor(initialOps: any[]) {
       this.ops = initialOps;
    }

    push(op: any){
        this.ops.push(op)
    }

    executeFunctionByName(name: string, args: any[]){
        let res = null;
        this.ops.forEach((action: any) => {
            if(action.name === name) {
                const a = action.fn(args) || {computedValue: null};
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

    setValueByVariableName(name: string, newValue: any){
        this.ops.forEach((action: any) => {
            if(action.name === name) action.computedValue = newValue
        })
    }

}


class VM {
    abi: any;
    cachedObjects: any;
    constructor(abi: any, cachedObjects: any) {
        this.abi = abi;
        this.cachedObjects = cachedObjects;
    }

    runScope(abi: any, scoppedOps: any[]): any{
        const memory = new Memory(scoppedOps);
        let res: any = {
            computedValue: 0
        };
        abi.body.forEach((action: any) => {
            switch (action.type){

                case 'assignment':

                    let valueAssign = null;

                    switch (action.value.type) {
                        case 'reference':
                            valueAssign = memory.getValueByVariableName(action.value.value)
                            break;
                    }

                    memory.setValueByVariableName(action.name, valueAssign)

                    break;

                case 'function':

                    memory.push({
                        name: action.name,
                        fn: (args: any[]) => {
                            args.forEach((arg, i) => {
                                const finalVar = {
                                    type: 'variable',
                                    name: action.arguments[i].name,
                                    computedValue: arg.value
                                }

                                memory.push(finalVar)
                            })

                            return this.runScope(action, memory.ops)
                        }
                    })

                    break;

                case 'call':

                    memory.executeFunctionByName(action.name, action.arguments)

                    break;

                case 'return':
                    const finalRet = {
                        type: 'value',
                        computedValue: null
                    }

                    switch (action.value.type) {
                        case 'call':
                            finalRet.computedValue = memory.executeFunctionByName(action.value.name, action.value.arguments)
                            break;
                        case 'reference':
                            finalRet.computedValue = memory.getValueByVariableName(action.value.value)
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
                        computedValue: null,
                        isPublic: action.modifiers.pub
                    }
                    if(action.value != null){
                        switch (action.value.type) {
                            case 'expression':
                                finalVar.computedValue = this.runScope(action.value, memory.ops).computedValue
                                break;
                            case 'call':
                                finalVar.computedValue = memory.executeFunctionByName(action.value.name, action.value.arguments)
                                break;
                            default:
                                finalVar.computedValue = action.value.value
                        }
                    } else {
                        finalVar.computedValue = this.cachedObjects[action.name];
                    }

                    memory.push(finalVar)
                    break;
            }
        })
        return {
            computedValue: res.computedValue,
            memory: memory
        }
    }

    run(){
        const res = this.runScope(this.abi, []);
        return {
            computedValue: res.computedValue,
            publicObjects: res.memory.ops.filter((op: any) => {
                if(op.isPublic === true) return op
            })
        }
    }
}


const vm0 = new VM(sample_abi,{
    whatever: true
});

const res = vm0.run();

console.log(res.publicObjects.map(({ name, computedValue }: any) => {
    return {
        name,
        value: computedValue
    }
}))




















