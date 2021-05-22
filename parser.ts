import {
  ArgumentsList,
  CallOperation,
  Operation,
  ReturnOperation,
  ScopeOperation,
  Token,
  TokensList,
  VariableOperation,
} from "./types.ts";

export function lexer(code: string) {
  const tokens: TokensList = [];
  code.split(/;/).map((sep) => {
    const splitted = sep.split(/[\s+:]|([()])/);
    const words = splitted.filter(Boolean);
    words.forEach(function (value: string, i) {
      switch (value) {
        case "class":
          tokens.push({
            type: "class",
            value,
          });
          break;
        case "expr":
          tokens.push({
            type: "expression",
            value,
          });
          break;
        case "pub":
          tokens.push({
            type: "modifier",
            value,
          });
          break;
        case "fn":
          tokens.push({
            type: "function",
            value,
          });
          break;
        case "var":
          tokens.push({
            type: "variable",
            value,
          });
          break;
        case "=":
          tokens.push({
            type: "assignment",
            value,
          });
          break;
        case "(":
          tokens.push({
            type: "group",
            value: "open",
          });
          break;
        case ")":
          tokens.push({
            type: "group",
            value: "closes",
          });
          break;
        case "return":
          tokens.push({
            type: "return",
            value,
          });
          break;
        default:
          if (value.startsWith('"') && value.endsWith('"')) {
            tokens.push({
              type: "string",
              value,
            });
          } else if (!isNaN(Number(value))) {
            tokens.push({
              type: "number",
              value: Number(value),
            });
          } else if (value === "true" || value === "false") {
            tokens.push({
              type: "boolean",
              value: value === "true",
            });
          } else if (value === "{" || value === "}") {
            tokens.push({
              type: "expression",
              value: value === "{" ? "open" : "closes",
            });
          } else if (words[i + 1] === "(" && words[i - 1] !== "fn") {
            tokens.push({
              type: "call",
              value: value,
            });
          } else {
            tokens.push({
              type: "reference",
              value: value.split(/[()]/gm)[0],
            });
          }
      }
    });
  });
  return tokens;
}

function getAllTokensUntil<T>(tokens: TokensList, type: string, value: T) {
  let res: TokensList = [];
  for (const token of tokens) {
    if (token.type === type && token.value === value) {
      return res;
    }
    res.push(token);
  }
  return res;
}

function getMatchingOperation(
  operations: Operation[],
  type: string,
  name: string,
): Operation | undefined {
  return operations.find((op: Operation) => {
    if (op.type === type && op.name === name) {
      return op;
    }
  });
}

function transformTokensToArguments(tokens: TokensList): ArgumentsList {
  const res: ArgumentsList = [];
  for (let i = 0; i < tokens.length; i += 2) {
    const token = tokens[i];
    res.push({
      type: "argument",
      name: token.value,
      interface: tokens[i + 1].value,
    });
  }
  return res;
}

function transformIntoCall(name: string, args: TokensList): CallOperation {
  return {
    type: "call",
    name,
    arguments: args,
  };
}

export function parser(
  tokens: TokensList,
  currentScope: ScopeOperation,
  allDefinitions: any,
) {
  for (let i = 0; i < tokens.length; i++) {
    const { type, value } = tokens[i];

    switch (type) {
      case "class":
        currentScope.body.push({
          type: "class",
          name: tokens[i + 1].value,
          body: [],
        });

        break;

      case "function":
        const returnInterface = tokens[i + 2].value !== "open"
          ? tokens[i + 2].value
          : "self";

        const functionArguments = transformTokensToArguments(
          getAllTokensUntil(tokens.slice(i + 3), "group", "closes"),
        );
        const functionDefinition = {
          type: "function",
          modifiers: {
            pub: i > 0 && tokens[i - 1].type === "modifier" &&
              tokens[i - 1].value === "pub",
          },
          name: tokens[i + 1].value,
          arguments: functionArguments,
          interface: returnInterface,
          body: [],
        };

        currentScope.body.push(functionDefinition);
        allDefinitions.push(functionDefinition);

        break;
      case "expression":
        if (value === "open") {
          const functionArguments =
            currentScope.body[currentScope.body.length - 1].arguments || [];

          const { tokenIndex } = parser(
            tokens.slice(i + 1),
            currentScope.body[currentScope.body.length - 1],
            [...allDefinitions, ...functionArguments],
          );
          i += tokenIndex + 1;
        } else {
          return {
            scope: currentScope,
            tokenIndex: i,
          };
        }

        break;
      case "call":
        currentScope.body.push(
          transformIntoCall(
            value,
            getAllTokensUntil(tokens.slice(i + 2), "group", "closes"),
          ),
        );

        break;
      case "reference":
        if (value === "open") {
          const functionArguments =
            currentScope.body[currentScope.body.length - 1].arguments;
          const { tokenIndex } = parser(
            tokens.slice(i + 1),
            currentScope.body[currentScope.body.length - 1],
            [...allDefinitions, ...functionArguments],
          );
          i += tokenIndex + 1;
        } else if (value === "closes") {
          return {
            scope: currentScope,
            tokenIndex: i,
          };
        }

        break;
      case "variable":
        const variableDefiniton = {
          type: "variable",
          value: null,
          name: tokens[i + 1].value,
          interface: tokens[i + 2].value,
          modifiers: {
            pub: i > 0 && tokens[i - 1].type === "modifier" &&
              tokens[i - 1].value === "pub",
          },
        };

        currentScope.body.push(variableDefiniton);
        allDefinitions.push(variableDefiniton);
        break;
      case "return":
        const objRet: ReturnOperation = {
          type: "return",
          value: tokens[i + 1],
        };

        const valueObjRet = tokens[i + 1];

        switch (valueObjRet.type) {
          case "call":
            objRet.value = transformIntoCall(
              valueObjRet.value,
              getAllTokensUntil(tokens.slice(i + 3), "group", "closes"),
            );
            break;
          default:
            objRet.value = valueObjRet;
        }
        switch (currentScope.type) {
          case "variable":
            currentScope.value.body.push(objRet);
            break;
          case "function":
          default:
            currentScope.body.push(objRet);
        }

        i += 1;

        break;

      case "assignment":
        let expectedType;
        const isDeclaration = i > 2 && tokens[i - 3].type === "variable";
        const valueObj = tokens[i + 1];
        let obj;

        if (isDeclaration) {
          obj = {
            ...currentScope.body[currentScope.body.length - 1],
          };
          expectedType = tokens[i - 1].value;
        } else {
          const referenceName = tokens[i - 1].value;
          const referenceToken = <VariableOperation> getAllTokensUntil(
            allDefinitions,
            "variable",
            referenceName,
          )[0];
          expectedType = referenceToken.interface;

          obj = {
            type: "assignment",
            name: referenceName,
          };
        }

        let receivedType;

        switch (valueObj.type) {
          case "call":
            obj.value = transformIntoCall(
              valueObj.value,
              getAllTokensUntil(tokens.slice(i + 3), "group", "closes"),
            );
            // WIP
            receivedType = expectedType;
            break;
          case "expression":
            obj.value = {
              type: "expression",
              body: [],
            };
            // WIP
            receivedType = expectedType;
            break;
          case "reference":
            const referenceReceivedName = tokens[i + 1].value;
            const referenceReceivedToken =
              <VariableOperation> getMatchingOperation(
                allDefinitions,
                "argument",
                referenceReceivedName,
              );
            if (referenceReceivedToken) {
              receivedType = referenceReceivedToken.interface;
            }
            obj.value = valueObj;
            break;
          default:
            obj.value = valueObj;
            receivedType = getType(valueObj.value);
        }

        if (!isValidType(receivedType, expectedType)) {
          compilerError(
            `${simulateCode(obj)} 
              \n      Expected type was '${expectedType}' but received type of '${receivedType}'`,
          );
        } else {
          currentScope.body.push(obj);
        }

        i += 1;

        break;
    }
  }

  return {
    scope: currentScope,
    tokenIndex: currentScope.body.length - 1,
  };
}

function compilerError(err: string) {
  console.error(`
      || Error ||
	
      ${err}
`);
}

function isValidType<T>(type: T, expectedType: T): boolean {
  return type === expectedType;
}

function getType(value: any): string {
  return typeof value;
}

function simulateCode(astToken: VariableOperation): string {
  let simulation: string = "";
  switch (astToken.type) {
    case "variable":
      simulation =
        `var ${astToken.name} ${astToken.interface} = ${astToken.value.value};`;
      break;
    case "assignment":
      simulation = `${astToken.name} = ${astToken.value.value};`;
      break;
  }
  return simulation;
}
