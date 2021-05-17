function lexer (code) {
	const map = []
	code.split(/;/).map((sep) => {
		const splitted = sep.split(/[\s+:]|([()])/)
		const tokens = splitted.filter(Boolean)
		tokens.forEach(function (t, i) {
			switch(t){
				case 'class':
					map.push({
						type: 'class',
						value: t
					})
					break;
				case 'fn':
					map.push({
						type: 'function',
						value: t
					})
					break;
				case 'var':
					map.push( {
						type: 'variable',
						value: t
					})
					break;
				case '=':
					map.push( {
						type: 'asignment',
						value: t
					})
					break;
				case '(':
					map.push( {
						type: 'group',
						value: 'open'
					})
					break;
				case ')':
					map.push( {
						type: 'group',
						value: 'closes'
					})
					break;
				case 'return':
					map.push( {
						type: 'return',
						value: 'return'
					})
					break;
				default:
					if(t.startsWith('"') && t.endsWith('"')){
						map.push( {
							type: 'string',
							value: t
						})
					}else if(!isNaN(t)){
						map.push( {
							type: 'number',
							value: Number(t)
						})
					}else if(t === '{' || t === '}'){
						map.push( {
							type: 'expression',
							value: t === '{' ? 'open' : 'closes'
						})
					}else if(tokens[i+1] === '(' && tokens[i-1] !== 'fn'){
						map.push( {
							type: 'call',
							value: t
						})
					}else{
						map.push( {
							type: 'reference',
							value: t.split(/[()]/gm)[0]
						})
					}
			}
		})

	})
	return map
}

function getAllTokensUntil(tokens, type, value){
	let res = []
	for(const token of tokens){
		if( token.type === type && token.value === value) return res
		res.push(token)
	}
	return res
}

function transformTokensToArguments(tokens){
	const res = []
	for(let i = 0; i < tokens.length; i += 2){
		const token = tokens[i]
		res.push({
			name: token.value,
			interface: tokens[i+1].value
		})
	}
	return res
}

function transformTokensToArgumentsWithoutInterface(tokens){
	const res = []
	for(let i = 0; i < tokens.length; i += 2){
		const token = tokens[i]
		res.push({
			value: token.value
		})
	}
	return res
}

function transformIntoCall(name, args){
	let res = {
		type: 'call',
		name,
		arguments: args
	}

	return res
}


function parser(tokens, currentScope) {
	for(let i = 0; i < tokens.length; i++){
		const { type, value } = tokens[i]
		switch(type){
			case 'class':

				currentScope.body.push({
					type: 'class',
					name: tokens[i+1].value,
					body:[]
				})

				break;

			case 'function':

				const returnInterface = tokens[i+2].value !== 'open' ? tokens[i+2].value : 'self'

				currentScope.body.push({
					type: 'function',
					name: tokens[i+1].value,
					arguments: transformTokensToArguments(getAllTokensUntil(tokens.slice(i+3), 'group', 'closes')),
					interface: returnInterface,
					body:[]
				})

				break;
			case 'expression':

				if(value === 'open'){
					const closingTokenIndex = parser(tokens.slice(i+1), currentScope.body[currentScope.body.length - 1])
					i += closingTokenIndex +1;
				} else {
					return i
				}

				break;
			case 'call':
				currentScope.body.push(
					transformIntoCall(
						value,
						getAllTokensUntil(tokens.slice(i+2), 'group', 'closes')
					)
				)

				break;
			case 'reference':

				if(value === 'open'){
					const closingTokenIndex = parser(tokens.slice(i+1), currentScope.body[currentScope.body.length - 1])
					i += closingTokenIndex +1;
				} else if(value === 'closes') {
					return i
				}

				break;
			case 'variable':
				currentScope.body.push({
					type: 'variable',
					value: null,
					name: null,
					interface: null
				})
				break;
			case 'return':
				currentScope.body.push({
					type: 'return',
					value: tokens[i+1]
				})
				break;
			case 'print':
				currentScope.body.push({
					type: 'reference',
					value: tokens[i].value,
					arguments: transformTokensToArgumentsWithoutInterface(getAllTokensUntil(tokens.slice(i+2), 'group', 'closes'))
				})
				break;
			case 'asignment':

				const expectedType = tokens[i-1].value
				const receivedType = getType(tokens[i+1].value)

				const obj = currentScope.body[currentScope.body.length - 1];

				const valueObj = tokens[i+1]

				switch (valueObj.type){
					case 'call':
						obj.value = transformIntoCall(
							valueObj.value,
							getAllTokensUntil(tokens.slice(i+3),'group','closes')
						)
						break;
					default:
						obj.value = valueObj
				}

				obj.name = tokens[i-2].value
				obj.interface = tokens[i-1].value

				i += 1;

				if(isValidType(receivedType,expectedType)){
					
				}else{
					compilerError(
						`${simulateCode(currentScope.body[currentScope.body.length-1])} \n\n	Expected type was '${expectedType}' but received type of '${receivedType}'`)
					
				}
				
				break;
		}

	}

	return currentScope
}

function compilerError(err){
	console.error(`
	-- Error -
	
	${err}
	
	----
`)
}

function isValidType(type, expectedType){
	return type === expectedType
}

function getType(value){
	return typeof value
}

function simulateCode(astToken){
	let simulation
	switch(astToken.type){
		case 'variable':
			simulation = `var ${astToken.name} ${astToken.interface} = ${astToken.value};`
			break;
	}
	return simulation
}

/*


class hola {

	var hello string = "hola";

	fn constructor( test string, whatever boolean ) {

	}
}

 */


const tokens = lexer(`

class test {
	fn constructor(){
		test("oh")
	}
}

fn test(ok string): string {
	return ok;
}

var whatever string = test("1");

return whatever;


`)

//console.log(tokens.flat())


const ast = parser(tokens.flat(),{
	body:[]
})

//console.log(JSON.stringify(ast,null,2))

export default ast;
