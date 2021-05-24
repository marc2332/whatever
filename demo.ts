import { lexer, parser } from "./parser.ts";
import VM from "./vm.ts";

/*

fn test(ok string): string {

	fn wow(omg string): string {
		return omg;
	}

	return wow("haha");
}

var hola string = expr {
	return test("lol");
}

 */

const tokens = lexer(`

pub var whatever: boolean;

pub var hello: string = expr {
 return "hola"
}

pub fn main(value boolean, test number): number {
	whatever = value;
	return 0
}

pub fn change_boolean(value boolean): void {
	whatever = value;
}

`);

const abi = parser(
  tokens.flat(),
  <any> {
    body: [],
  },
  [],
);

const vm0 = new VM(
  abi.scope,
  // We can pass custom initial values to public variables
  <any> {
    whatever: true,
  },
  [
    {
      type: "call",
      name: "main",
      arguments: [{
        type: "boolean",
        value: false,
      }],
    },
  ],
);

const VmResult = vm0.run();

// Log final values of public variables
Object.keys(VmResult.cachedOperations).map((key: string) => {
  console.log(`${key}: ${VmResult.cachedOperations[key]}`);
});
