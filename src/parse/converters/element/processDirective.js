import Parser from '../../Parser';
import readExpression from '../readExpression';
import flattenExpression from '../../utils/flattenExpression';
import parseJSON from '../../../utils/parseJSON';

var methodCallPattern = /^([a-zA-Z_$][a-zA-Z_$0-9]*)\(/,
	methodCallExcessPattern = /\)\s*$/,
	ExpressionParser;

ExpressionParser = Parser.extend({
	converters: [ readExpression ]
});

// TODO clean this up, it's shocking
export default function processDirective ( tokens, parentParser ) {
	var result,
		match,
		parser,
		args,
		token,
		colonIndex,
		directiveName,
		directiveArgs,
		parsed;

	if ( typeof tokens === 'string' ) {
		if ( match = methodCallPattern.exec( tokens ) ) {
			let end = tokens.lastIndexOf(')');

			// check for invalid method calls
			if ( !methodCallExcessPattern.test( tokens ) ) {
				parentParser.error( `Invalid input after method call expression '${tokens.slice(end + 1)}'` );
			}

			result = { m: match[1] };
			const sliced = tokens.slice( result.m.length + 1, end );

			if ( sliced === '...arguments' ) {
				// TODO: what the heck should this be???
				// maybe ExpressionParser should understand ES6???
				result.g = true;
			}
			else {
				args = '[' + sliced + ']';
				parser = new ExpressionParser( args );
				result.a = flattenExpression( parser.result[0] );
			}

			return result;
		}

		if ( tokens.indexOf( ':' ) === -1 ) {
			return tokens.trim();
		}

		tokens = [ tokens ];
	}

	result = {};

	directiveName = [];
	directiveArgs = [];

	if ( tokens ) {
		while ( tokens.length ) {
			token = tokens.shift();

			if ( typeof token === 'string' ) {
				colonIndex = token.indexOf( ':' );

				if ( colonIndex === -1 ) {
					directiveName.push( token );
				} else {
					// is the colon the first character?
					if ( colonIndex ) {
						// no
						directiveName.push( token.substr( 0, colonIndex ) );
					}

					// if there is anything after the colon in this token, treat
					// it as the first token of the directiveArgs fragment
					if ( token.length > colonIndex + 1 ) {
						directiveArgs[0] = token.substring( colonIndex + 1 );
					}

					break;
				}
			}

			else {
				directiveName.push( token );
			}
		}

		directiveArgs = directiveArgs.concat( tokens );
	}

	if ( !directiveName.length ) {
		result = '';
	} else if ( directiveArgs.length || typeof directiveName !== 'string' ) {
		result = {
			// TODO is this really necessary? just use the array
			n: ( directiveName.length === 1 && typeof directiveName[0] === 'string' ? directiveName[0] : directiveName )
		};

		if ( directiveArgs.length === 1 && typeof directiveArgs[0] === 'string' ) {
			parsed = parseJSON( '[' + directiveArgs[0] + ']' );
			result.a = parsed ? parsed.value : [ directiveArgs[0].trim() ];
		}

		else {
			result.d = directiveArgs;
		}
	} else {
		result = directiveName;
	}

	return result;
}
