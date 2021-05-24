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
  code.split(/[;\n]/).map((sep, lineNumber) => {
    const splitted = sep.split(/[\s+,:]|([()])/);
    const words = splitted.filter(Boolean);
    words.forEach((value: string, i) => {
      switch (value) {
        case "class":
          tokens.push({
            type: "class",
            value,
            lineNumber,
          });
          break;
        case "expr":
          tokens.push({
            type: "anon_expression",
            value: "anon_expression",
            lineNumber,
          });
          break;
        case "pub":
          tokens.push({
            type: "modifier",
            value,
            lineNumber,
          });
          break;
        case "fn":
          tokens.push({
            type: "function",
            value,
            lineNumber,
          });
          break;
        case "var":
          tokens.push({
            type: "variable",
            value,
            lineNumber,
          });
          break;
        case "=":
          tokens.push({
            type: "assignment",
            value,
            lineNumber,
          });
          break;
        case "(":
          tokens.push({
            type: "group",
            value: "open",
            lineNumber,
          });
          break;
        case ")":
          tokens.push({
            type: "group",
            value: "closes",
            lineNumber,
          });
          break;
        case "return":
          tokens.push({
            type: "return",
            value,
            lineNumber,
          });
          break;
        default:
          if (value.startsWith('"') && value.endsWith('"')) {
            tokens.push({
              type: "string",
              value,
              lineNumber,
            });
          } else if (!isNaN(Number(value))) {
            tokens.push({
              type: "number",
              value: Number(value),
              lineNumber,
            });
          } else if (value === "true" || value === "false") {
            tokens.push({
              type: "boolean",
              value: value === "true",
              lineNumber,
            });
          } else if (value === "{" || value === "}") {
            tokens.push({
              type: "expression",
              value: value === "{" ? "open" : "closes",
              lineNumber,
            });
          } else if (words[i + 1] === "(" && words[i - 1] !== "fn") {
            tokens.push({
              type: "call",
              value: value,
              lineNumber,
            });
          } else {
            tokens.push({
              type: "reference",
              value: value.split(/[()]/gm)[0],
              lineNumber,
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

function getAllVariablesUntil<T>(
  variables: VariableOperation[],
  type: string,
  value: T,
) {
  let res: VariableOperation[] = [];
  for (const variable of variables) {
    if (variable.type === type && variable.value === value) {
      return res;
    }
    res.push(variable);
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
        const functionArguments = transformTokensToArguments(
          getAllTokensUntil(tokens.slice(i + 3), "group", "closes"),
        );
        const returnInterface =
          tokens[i + (functionArguments.length * 2) + 4].value;

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

        const receivedTypeReturn = getType(valueObjRet.value);
        const expectedTypeReturn = currentScope.interface;

        if (receivedTypeReturn !== expectedTypeReturn) {
          compilerError(
            `${simulateCode(objRet)} 
              \n      Expected return type was '${expectedTypeReturn}' but returned type of '${receivedTypeReturn}'`,
          );
        } else {
          switch (currentScope.type) {
            case "variable":
              currentScope.value.body.push(objRet);
              break;
            case "function":
            default:
              currentScope.body.push(objRet);
          }

          i += 1;
        }

        break;

      case "assignment":
        let expectedTypeAssignment;
        const isDeclaration = i > 2 && tokens[i - 3].type === "variable";
        const valueObj = tokens[i + 1];
        let obj;

        if (isDeclaration) {
          obj = {
            ...currentScope.body[currentScope.body.length - 1],
          };
          expectedTypeAssignment = tokens[i - 1].value;
        } else {
          const referenceName = tokens[i - 1].value;
          const referenceToken = getAllVariablesUntil(
            allDefinitions,
            "variable",
            referenceName,
          )[0];
          expectedTypeAssignment = referenceToken.interface;

          obj = {
            type: "assignment",
            name: referenceName,
          };
        }

        let receivedTypeAssignment;

        switch (valueObj.type) {
          case "call":
            obj.value = transformIntoCall(
              valueObj.value,
              getAllTokensUntil(tokens.slice(i + 3), "group", "closes"),
            );
            // WIP
            receivedTypeAssignment = expectedTypeAssignment;
            break;
          case "anon_expression":
            obj.value = {
              type: "expression",
              body: [],
            };
            // WIP
            expectedTypeAssignment = receivedTypeAssignment;
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
              receivedTypeAssignment = referenceReceivedToken.interface;
            }
            obj.value = valueObj;
            break;
          default:
            obj.value = valueObj;
            receivedTypeAssignment = getType(valueObj.value);
        }

        if (!isValidType(receivedTypeAssignment, expectedTypeAssignment)) {
          compilerError(
            `${simulateCode(obj)} 
              \n      Expected type was '${expectedTypeAssignment}' but received type of '${receivedTypeAssignment}'`,
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

function simulateCode(astToken: any): string {
  let simulation: string = "";
  switch (astToken.type) {
    case "variable":
      simulation =
        `var ${astToken.name} ${astToken.interface} = ${astToken.value.value};`;
      break;
    case "assignment":
      simulation = `${astToken.name} = ${astToken.value.value};`;
      break;
    case "return":
      simulation = `return ${astToken.value.value}`;
      break;
  }
  return simulation;
}
