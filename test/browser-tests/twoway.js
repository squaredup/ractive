import { test } from 'qunit';
import { fire } from 'simulant';
import { hasUsableConsole, onWarn } from 'test-config';

test( 'Two-way bindings work with index references', t => {
	const ractive = new Ractive({
		el: fixture,
		template: '{{#items:i}}<label><input value="{{items[i].name}}"> {{name}}</label>{{/items}}',
		data: { items: [{ name: 'foo' }, { name: 'bar' }] }
	});

	const input = ractive.find( 'input' );

	input.value = 'baz';
	fire( input, 'change' );
	t.equal( ractive.get( 'items[0].name' ), 'baz' );
	t.htmlEqual( fixture.innerHTML, '<label><input> baz</label><label><input> bar</label>' );
});

test( 'Two-way bindings work with foo["bar"] type notation', t => {
	const ractive = new Ractive({
		el: fixture,
		template: '<label><input value={{foo["bar"]["baz"]}}> {{foo.bar.baz}}</label>',
		data: { foo: { bar: { baz: 1 } } }
	});

	const input = ractive.find( 'input' );

	input.value = 2;
	fire( input, 'change' );

	t.equal( ractive.get( 'foo.bar.baz' ), 2 );
	t.htmlEqual( fixture.innerHTML, '<label><input> 2</label>' );
});

test( 'Two-way bindings work with arbitrary expressions that resolve to keypaths', t => {
	const ractive = new Ractive({
		el: fixture,
		template: '<label><input value={{foo["bar"][ a+1 ].baz[ b ][ 1 ] }}> {{ foo.bar[1].baz.qux[1] }}</label>',
		data: {
			foo: {
				bar: [
					null,
					{ baz: { qux: [ null, 'yes' ] } }
				]
			},
			a: 0,
			b: 'qux'
		}
	});

	const input = ractive.find( 'input' );

	input.value = 'it works';
	fire( input, 'change' );

	t.equal( ractive.get( 'foo.bar[1].baz.qux[1]' ), 'it works' );
	t.htmlEqual( fixture.innerHTML, '<label><input> it works</label>' );
});

test( 'An input whose value is updated programmatically will update the model on blur (#644)', t => {
	const ractive = new Ractive({
		el: fixture,
		template: '<input value="{{foo}}">',
		data: { foo: 'bar' }
	});

	try {
		ractive.find( 'input' ).value = 'baz';
		fire( ractive.find( 'input' ), 'blur' );

		t.equal( ractive.get( 'foo' ), 'baz' );
	} catch ( err ) {
		t.ok( true ); // otherwise phantomjs throws a hissy fit
	}
});

test( 'Model is validated on blur, and the view reflects the validate model (#644)', t => {
	const ractive = new Ractive({
		el: fixture,
		template: '<input value="{{foo}}">',
		data: { foo: 'bar' }
	});

	ractive.observe( 'foo', function ( foo ) {
		this.set( 'foo', foo.toUpperCase() );
	});

	try {
		ractive.find( 'input' ).value = 'baz';
		fire( ractive.find( 'input' ), 'blur' );

		t.equal( ractive.find( 'input' ).value, 'BAZ' );
	} catch ( err ) {
		t.ok( true ); // phantomjs
	}
});

test( 'Two-way data binding is not attempted on elements with no mustache binding', t => {
	t.expect( 0 );

	// This will throw an error if the binding is attempted (Issue #750)
	new Ractive({
		el: fixture,
		template: '<input type="radio"><input type="checkbox"><input type="file"><select></select><textarea></textarea><div contenteditable="true"></div>'
	});
});

test( 'Uninitialised values should be initialised with whatever the \'empty\' value is (#775)', t => {
	const ractive = new Ractive({
		el: fixture,
		template: '<input value="{{foo}}">'
	});

	t.equal( ractive.get( 'foo' ), '' );
});

test( 'Contenteditable elements can be bound via the value attribute', t => {
	const ractive = new Ractive({
		el: fixture,
		template: '<div contenteditable="true" value="{{content}}"><strong>some content</strong></div>'
	});

	t.equal( ractive.get( 'content' ), '<strong>some content</strong>' );
	t.htmlEqual( fixture.innerHTML, '<div contenteditable="true"><strong>some content</strong></div>' );

	ractive.set( 'content', '<p>some different content</p>' );
	t.htmlEqual( fixture.innerHTML, '<div contenteditable="true"><p>some different content</p></div>' );
});

try {
	fire( document.createElement( 'div' ), 'change' );

	test( 'Contenteditable elements can be bound with a bindable contenteditable attribute.', ( t ) => {
		const ractive = new Ractive({
			el: fixture,
			template: '<div contenteditable="{{editable}}" value="{{content}}"><strong>some content</strong></div>',
			data: { editable: false }
		});

		const div = ractive.find( 'div' );
		div.innerHTML = 'foo';
		fire( div, 'change' );

		t.equal( div.innerHTML, ractive.get( 'content' ) );
		t.equal( ractive.get( 'content' ), 'foo' );
	});
} catch ( err ) {
	// do nothing
}

test( 'Existing model data overrides contents of contenteditable elements', t => {
	const ractive = new Ractive({
		el: fixture,
		template: '<div contenteditable="true" value="{{content}}"><strong>some content</strong></div>',
		data: { content: 'overridden' }
	});

	t.equal( ractive.get( 'content' ), 'overridden' );
	t.htmlEqual( fixture.innerHTML, '<div contenteditable="true">overridden</div>' );
});

test( 'The order of attributes does not affect contenteditable (#1134)', t => {
	new Ractive({
		el: fixture,
		template: `
			<div value='{{foo}}' contenteditable='true'></div>
			<div contenteditable='true' value='{{bar}}'></div>`,
		data: {
			foo: 'one',
			bar: 'two'
		}
	});

	t.htmlEqual( fixture.innerHTML, '<div contenteditable="true">one</div><div contenteditable="true">two</div>' );
});

[ 'number', 'range' ].forEach( function ( type ) {
	test( 'input type=' + type + ' values are coerced', t => {
		const ractive = new Ractive({
			el: fixture,
			template: '<input value="{{a}}" type="' + type + '"><input value="{{b}}" type="' + type + '">{{a}}+{{b}}={{a+b}}'
		});

		t.equal( ractive.get( 'a' ), undefined );
		t.equal( ractive.get( 'b' ), undefined );

		const inputs = ractive.findAll( 'input' );
		inputs[0].value = '40';
		inputs[1].value = '2';
		ractive.updateModel();
		t.htmlEqual( fixture.innerHTML, '<input type="' + type + '"><input type="' + type + '">40+2=42' );
	});
});

test( 'The model updates to reflect which checkbox inputs are checked at render time', t => {
	let ractive = new Ractive({
		el: fixture,
		template: '<input id="red" type="checkbox" name="{{colors}}" value="red"><input id="green" type="checkbox" name="{{colors}}" value="blue" checked><input id="blue" type="checkbox" name="{{colors}}" value="green" checked>'
	});

	t.deepEqual( ractive.get( 'colors' ), [ 'blue', 'green' ] );
	t.ok( !ractive.nodes.red.checked );
	t.ok( ractive.nodes.blue.checked );
	t.ok( ractive.nodes.green.checked );

	ractive = new Ractive({
		el: fixture,
		template: '<input id="red" type="checkbox" name="{{colors}}" value="red"><input id="green" type="checkbox" name="{{colors}}" value="blue"><input id="blue" type="checkbox" name="{{colors}}" value="green">'
	});

	t.deepEqual( ractive.get( 'colors' ), [] );
	t.ok( !ractive.nodes.red.checked );
	t.ok( !ractive.nodes.blue.checked );
	t.ok( !ractive.nodes.green.checked );
});

test( 'The model overrides which checkbox inputs are checked at render time', t => {
	const ractive = new Ractive({
		el: fixture,
		template: `
			<input id="red" type="checkbox" name="{{colors}}" value="red">
			<input id="blue" type="checkbox" name="{{colors}}" value="blue" checked>
			<input id="green" type="checkbox" name="{{colors}}" value="green" checked>`,
		data: { colors: [ 'red', 'blue' ] }
	});

	t.deepEqual( ractive.get( 'colors' ), [ 'red', 'blue' ] );
	t.ok( ractive.nodes.red.checked );
	t.ok( ractive.nodes.blue.checked );
	t.ok( !ractive.nodes.green.checked );
});

test( 'Named checkbox bindings are kept in sync with data changes (#1610)', t => {
	const ractive = new Ractive({
		el: fixture,
		template: `
		<input type="checkbox" name="{{colors}}" value="red" />
		<input type="checkbox" name="{{colors}}" value="blue" />
		<input type="checkbox" name="{{colors}}" value="green" /> `,
		data: { colors: [ 'red', 'blue' ] }
	});

	ractive.set( 'colors', [ 'green' ] );
	t.deepEqual( ractive.get( 'colors' ), [ 'green' ] );

	fire( ractive.find( 'input' ), 'click' );
	t.deepEqual( ractive.get( 'colors' ), [ 'red', 'green' ]);
});

test( 'The model updates to reflect which radio input is checked at render time', t => {
	let ractive = new Ractive({
		el: fixture,
		template: '<input type="radio" name="{{color}}" value="red"><input type="radio" name="{{color}}" value="blue" checked><input type="radio" name="{{color}}" value="green">'
	});

	t.deepEqual( ractive.get( 'color' ), 'blue' );

	ractive = new Ractive({
		el: fixture,
		template: '<input type="radio" name="{{color}}" value="red"><input type="radio" name="{{color}}" value="blue"><input type="radio" name="{{color}}" value="green">'
	});

	t.deepEqual( ractive.get( 'color' ), undefined );
});

test( 'The model overrides which radio input is checked at render time', t => {
	const ractive = new Ractive({
		el: fixture,
		template: '<input id="red" type="radio" name="{{color}}" value="red"><input id="blue" type="radio" name="{{color}}" value="blue" checked><input id="green" type="radio" name="{{color}}" value="green">',
		data: { color: 'green' }
	});

	t.deepEqual( ractive.get( 'color' ), 'green' );
	t.ok( !ractive.nodes.red.checked );
	t.ok( !ractive.nodes.blue.checked );
	t.ok( ractive.nodes.green.checked );
});

test( 'updateModel correctly updates the value of a text input', t => {
	const ractive = new Ractive({
		el: fixture,
		template: '<input value="{{name}}">',
		data: { name: 'Bob' }
	});

	ractive.find( 'input' ).value = 'Jim';
	ractive.updateModel( 'name' );

	t.equal( ractive.get( 'name' ), 'Jim' );
});

test( 'updateModel correctly updates the value of a select', t => {
	const ractive = new Ractive({
		el: fixture,
		template: '<select value="{{selected}}"><option selected value="red">red</option><option value="blue">blue</option><option value="green">green</option></select>'
	});

	t.equal( ractive.get( 'selected' ), 'red' );

	ractive.findAll( 'option' )[1].selected = true;
	ractive.updateModel();

	t.equal( ractive.get( 'selected' ), 'blue' );
});

test( 'updateModel correctly updates the value of a textarea', t => {
	const ractive = new Ractive({
		el: fixture,
		template: '<textarea value="{{name}}"></textarea>',
		data: { name: 'Bob' }
	});

	ractive.find( 'textarea' ).value = 'Jim';
	ractive.updateModel( 'name' );

	t.equal( ractive.get( 'name' ), 'Jim' );
});

test( 'updateModel correctly updates the value of a checkbox', t => {
	const ractive = new Ractive({
		el: fixture,
		template: '<input type="checkbox" checked="{{active}}">',
		data: { active: true }
	});

	ractive.find( 'input' ).checked = false;
	ractive.updateModel();

	t.equal( ractive.get( 'active' ), false );
});

test( 'updateModel correctly updates the value of a radio', t => {
	const ractive = new Ractive({
		el: fixture,
		template: '<input type="radio" checked="{{active}}">',
		data: { active: true }
	});

	ractive.find( 'input' ).checked = false;
	ractive.updateModel();

	t.equal( ractive.get( 'active' ), false );
});

test( 'updateModel correctly updates the value of an indirect (name-value) checkbox', t => {
	const ractive = new Ractive({
		el: fixture,
		template: '<input type="checkbox" name="{{colour}}" value="red"><input type="checkbox" name="{{colour}}" value="blue" checked><input type="checkbox" name="{{colour}}" value="green">'
	});

	t.deepEqual( ractive.get( 'colour' ), [ 'blue' ] );

	ractive.findAll( 'input' )[2].checked = true;
	ractive.updateModel();

	t.deepEqual( ractive.get( 'colour' ), [ 'blue', 'green' ] );
});

test( 'updateModel correctly updates the value of an indirect (name-value) radio', t => {
	const ractive = new Ractive({
		el: fixture,
		template: '<input type="radio" name="{{colour}}" value="red"><input type="radio" name="{{colour}}" value="blue" checked><input type="radio" name="{{colour}}" value="green">'
	});

	t.deepEqual( ractive.get( 'colour' ), 'blue' );

	ractive.findAll( 'input' )[2].checked = true;
	ractive.updateModel();

	t.deepEqual( ractive.get( 'colour' ), 'green' );
});

test( 'Radio inputs will update the model if another input in their group is checked', t => {
	const ractive = new Ractive({
		el: fixture,
		template: '{{#items}}<input type="radio" name="plan" checked="{{ checked }}"/>{{/items}}',
		data: {
			items: [
				{ key: 'a', checked: true  },
				{ key: 'b', checked: false },
				{ key: 'c', checked: false }
			]
		}
	});

	const inputs = ractive.findAll( 'input' );
	t.equal( inputs[0].checked, true );

	inputs[1].checked = true;
	fire( inputs[1], 'change' );
	t.equal( ractive.get( 'items[0].checked' ), false );
	t.equal( ractive.get( 'items[1].checked' ), true );
});

test( 'Radio name inputs respond to model changes (regression, see #783)', t => {
	const ractive = new Ractive({
		el: fixture,
		template: '{{#items}}<input type="radio" name="{{foo}}" value="{{this}}"/>{{/items}}',
		data: {
			foo: undefined,
			items: [ 'a', 'b', 'c' ]
		}
	});

	const inputs = ractive.findAll( 'input' );

	t.equal( ractive.get( 'foo' ), undefined );

	ractive.set( 'foo', 'b' );
	t.ok( inputs[1].checked );

	ractive.set( 'items', [ 'd', 'e', 'f' ]);
	t.equal( ractive.get( 'foo' ), undefined );
	t.ok( !inputs[1].checked );
});

test( 'Post-blur validation works (#771)', t => {
	const ractive = new Ractive({
		el: fixture,
		template: '<input value="{{foo}}">{{foo}}'
	});

	ractive.observe( 'foo', function ( foo ) {
		this.set( 'foo', foo.toUpperCase() );
	});

	const input = ractive.find( 'input' );
	input.value = 'bar';
	fire( input, 'change' );

	t.equal( input.value, 'bar' );
	t.equal( ractive.get( 'foo' ), 'BAR' );
	t.htmlEqual( fixture.innerHTML, '<input>BAR' );

	fire( input, 'change' );
	try {
		fire( input, 'blur' );

		t.equal( input.value, 'BAR' );
		t.equal( ractive.get( 'foo' ), 'BAR' );
		t.htmlEqual( fixture.innerHTML, '<input>BAR' );
	} catch ( err ) {
		// Oh PhantomJS. You are so very WTF
	}
});

test( 'Reference expression radio bindings rebind correctly inside reference expression sections (#904)', t => {
	const ractive = new Ractive({
		el: fixture,
		template: '{{#with steps[current] }}<input type="radio" name="{{~/selected[name]}}" value="{{value}}">{{/with}}',
		data: {
			steps: [{ name: 'one', value: 'a' }, { name: 'two', value: 'b' }],
			current: 0
		}
	});

	ractive.find( 'input' ).checked = true;
	ractive.updateModel();
	t.deepEqual( ractive.get( 'selected' ), { one: 'a' });

	ractive.set( 'current', 1 );
	ractive.find( 'input' ).checked = true;
	ractive.updateModel();
	t.deepEqual( ractive.get( 'selected' ), { one: 'a', two: 'b' });
});

test( 'Ambiguous reference expressions in two-way bindings attach to correct context', t => {
	const ractive = new Ractive({
		el: fixture,
		template: `
			<p>obj.foo[{{bar}}]: {{obj.foo[bar]}}</p>
			{{#with obj}}
				<input value='{{foo[bar]}}'>
			{{/with}}`,
		data: {
			bar: 0,
			obj: {}
		}
	});

	ractive.find( 'input' ).value = 'test';
	ractive.updateModel();

	t.deepEqual( ractive.get( 'obj.foo' ), [ 'test' ] );
	t.htmlEqual( fixture.innerHTML, '<p>obj.foo[0]: test</p><input>' );
});

test( 'Static bindings can only be one-way (#1149)', t => {
	const ractive = new Ractive({
		el: fixture,
		template: '<input value="[[foo]]">{{foo}}',
		data: {
			foo: 'static'
		}
	});

	ractive.find( 'input' ).value = 'dynamic';
	ractive.updateModel();
	t.equal( ractive.get( 'foo' ), 'static' );
	t.htmlEqual( fixture.innerHTML, '<input>static' );
});

test( 'input[type="checkbox"] with bound name updates as expected (#1305)', t => {
	const ractive = new Ractive({
		el: fixture,
		template: '<input type="checkbox" name="{{ch}}" value="foo">',
		data: { ch: 'bar' }
	});

	ractive.set( 'ch', 'foo' );
	t.ok( ractive.find( 'input' ).checked );
});

test( 'input[type="checkbox"] with bound name updates as expected, with array mutations (#1305)', t => {
	const ractive = new Ractive({
		el: fixture,
		template: `
			<input type="checkbox" name="{{array}}" value="foo">
			<input type="checkbox" name="{{array}}" value="bar">
			<input type="checkbox" name="{{array}}" value="baz">`,
		data: {
			array: [ 'foo', 'bar' ]
		}
	});

	const checkboxes = ractive.findAll( 'input' );

	t.ok( checkboxes[0].checked );
	t.ok( checkboxes[1].checked );

	ractive.push( 'array', 'baz' );

	t.ok( checkboxes[0].checked );
	t.ok( checkboxes[1].checked );
	t.ok( checkboxes[2].checked );

	ractive.shift( 'array' );

	t.ok( !checkboxes[0].checked );
	t.ok( checkboxes[1].checked );
});

test( 'input[type="checkbox"] works with array of numeric values (#1305)', t => {
	const ractive = new Ractive({
		el: fixture,
		template: `
			<input type="checkbox" name="{{array}}" value="1">
			<input type="checkbox" name="{{array}}" value="2">
			<input type="checkbox" name="{{array}}" value="3">`,
		data: {
			array: [ 1, 2 ]
		}
	});

	const checkboxes = ractive.findAll( 'input' );

	t.ok( checkboxes[0].checked );
	t.ok( checkboxes[1].checked );

	ractive.push( 'array', 3 );

	t.ok( checkboxes[0].checked );
	t.ok( checkboxes[1].checked );
	t.ok( checkboxes[2].checked );
});

test( 'input[type="checkbox"] works with array mutated on init (#1305)', t => {
	const ractive = new Ractive({
		el: fixture,
		template: `
			<input type="checkbox" name="{{array}}" value="a">
			<input type="checkbox" name="{{array}}" value="b">
			<input type="checkbox" name="{{array}}" value="c">`,
		data: {
			array: [ 'a', 'b']
		},
		oninit () {
			this.push( 'array', 'c' );
		}
	});

	const checkboxes = ractive.findAll( 'input' );

	t.ok( checkboxes[0].checked );
	t.ok( checkboxes[1].checked );
	t.ok( checkboxes[2].checked );
});

test( 'Downstream expression objects in two-way bindings do not trigger a warning (#1421)', t => {
	const ractive = new Ractive({
		el: fixture,
		template: '{{#foo()}}<input value="{{.}}">{{/}}',
		data: { foo: () => ['bar'] }
	});

	t.equal( ractive.find('input').value, 'bar' );
});

test( 'Changes made in oninit are reflected on render (#1390)', t => {
	let inputs;

	new Ractive({
		el: fixture,
		template: '{{#each items}}<input type="checkbox" name="{{selected}}" value="{{this}}">{{/each}}',
		data: { items: [ 'a', 'b', 'c' ] },
		oninit () {
			this.set( 'selected', [ 'b' ]);
		},
		onrender () {
			inputs = this.findAll( 'input' );
		}
	});

	t.ok( !inputs[0].checked );
	t.ok(  inputs[1].checked );
	t.ok( !inputs[2].checked );
});

test( 'If there happen to be unresolved references next to binding resolved references, the unresolveds should not be evicted by mistake (#1608)', t => {
	const ractive = new Ractive({
		el: fixture,
		template: `
			{{#context}}
				<select value="{{bar}}">
					<option>baz</option>
				</select>
				<input type="checkbox" checked="{{foo}}">
				<div>{{foo}}: {{#foo}}true{{else}}false{{/}}</div>
			{{/}}`,
		data: {
			context: {}
		}
	});

	const div = ractive.find( 'div' );
	t.htmlEqual( div.innerHTML, 'false: false' );
	fire( ractive.find( 'input' ), 'click' );
	t.htmlEqual( div.innerHTML, 'true: true' );
});

test( 'Change events propagate after the model has been updated (#1371)', t => {
	t.expect( 1 );

	let ractive = new Ractive({
		el: fixture,
		template: `
			<select value='{{value}}' on-change='checkValue(value)'>
				<option value='1'>1</option>
				<option value='2'>2</option>
			</select>`,
		checkValue ( value ) {
			t.equal( value, 2 );
		}
	});

	ractive.findAll( 'option' )[1].selected = true;
	fire( ractive.find( 'select' ), 'change' );
});

if ( hasUsableConsole ) {
	// #1740: this test fails because {{#with ...}} now behaves as {{#if ...}}{{#with ...}}?
	test( 'Ambiguous references trigger a warning (#1692)', t => {
		t.expect( 1 );

		onWarn( warning => {
			t.ok( /ambiguous/.test( warning ) );
		});

		new Ractive({
			el: fixture,
			template: `{{#with whatever}}<input value='{{uniqueToThisTest}}'>{{/with}}`,
			data: {
				whatever: {}
			}
		});
	});

	test( 'Using expressions in two-way bindings triggers a warning (#1399)', t => {
		onWarn( message => {
			t.ok( ~message.indexOf( 'Cannot use two-way binding on <input> element: foo() is read-only' ) );
		});

		new Ractive({
			el: fixture,
			template: '<input value="{{foo()}}">',
			data: { foo: () => 'bar' }
		});
	});

	test( 'Using expressions with keypath in two-way bindings triggers a warning (#1399/#1421)', t => {
		onWarn( () => {
			t.ok( true );
		});

		new Ractive({
			el: fixture,
			template: '<input value="{{foo.bar()[\'biz.bop\']}}">',
			data: { foo: { bar: () => 'bar' } }
		});
	});

	test( '@key cannot be used for two-way binding', t => {
		t.expect( 3 );

		onWarn( msg => {
			t.ok( /Cannot use two-way binding/.test( msg ) );
		});

		new Ractive({
			el: fixture,
			template: `{{#each obj}}<input value='{{@key}}'>{{/each}}`,
			data: {
				obj: { foo: 1, bar: 2, baz: 3 }
			}
		});
	});
}

test( 'Radio input can have name/checked attributes without two-way binding (#783)', t => {
	t.expect( 0 );

	new Ractive({
		el: fixture,
		template: '<input type="radio" name="a" value="a" checked>'
	});
});

test( 'Two-way binding can be set up against expressions that resolve to regular keypaths', t => {
	const ractive = new Ractive({
		el: fixture,
		template: '{{#items:i}}<label><input value="{{ proxies[i].name }}"> name: {{ proxies[i].name }}</label>{{/items}}',
		data: {
			items: [{}],
			proxies: []
		}
	});

	const input = ractive.find( 'input' );
	input.value = 'foo';
	ractive.updateModel();

	t.deepEqual( ractive.get( 'proxies' ), [{name: 'foo'  }] );
	t.htmlEqual( fixture.innerHTML, '<label><input> name: foo</label>' );
});

test( 'Contenteditable works with lazy: true (#1933)', t => {
	const ractive = new Ractive({
		el: fixture,
		template: '<div contenteditable="true" value="{{value}}"></div>',
		lazy: true
	});

	const div = ractive.find( 'div' );
	div.innerHTML = 'foo';

	try {
		fire( div, 'blur' );
		t.equal( ractive.get( 'value' ), 'foo' );
	} catch ( err ) {
		t.ok( true ); // phantomjs ಠ_ಠ
	}
});

test( 'type attribute does not have to be first (#1968)', t => {
	const ractive = new Ractive({
		el: fixture,
		template: '<input id="red" name="{{selectedColors}}" value="red" type="checkbox">'
	});

	ractive.set( 'selectedColors', [ 'red' ]);

	t.ok( ractive.nodes.red.checked );
});

test( 'input type=number binds (#2082)', t => {
	const ractive = new Ractive({
		el: fixture,
		template: `{{number}} <input type="number" value="{{number}}">`,
		data: { number: 10 }
	});

	const input = ractive.find( 'input' );
	input.value = '20';
	fire( input, 'change' );
	t.equal( ractive.get( 'number' ), 20 );
});

test( 'twoway may be overridden on a per-element basis', t => {
	let ractive = new Ractive({
		el: fixture,
		template: '<input value="{{foo}}" twoway="true" />',
		data: { foo: 'test' },
		twoway: false
	});

	let node = ractive.find( 'input' );
	node.value = 'bar';
	fire( node, 'change' );
	t.equal( ractive.get( 'foo' ), 'bar' );

	ractive = new Ractive({
		el: fixture,
		template: '<input value="{{foo}}" twoway="false" />',
		data: { foo: 'test' },
		twoway: true
	});

	node = ractive.find( 'input' );
	node.value = 'bar';
	fire( node, 'change' );
	t.equal( ractive.get( 'foo' ), 'test' );
});

test( 'Presence of lazy or twoway without value is considered true', t => {
	const ractive = new Ractive({
		el: fixture,
		template: '<input value="{{foo}}" twoway lazy/>',
		twoway: false
	});

	const input = ractive.find( 'input' );

	input.value = 'changed';

	// input events shouldn't trigger change (because lazy=true)...
	fire( input, 'input' );
	t.equal( ractive.get( 'foo' ), '' );

	// ...but change events still should (because twoway=true)
	fire( input, 'change' );
	t.equal( ractive.get( 'foo' ), 'changed' );
});

test( '`lazy=0` is not mistaken for `lazy`', t => {
	const ractive = new Ractive({
		el: fixture,
		template: '<input value="{{foo}}" lazy="0"/>'
	});

	const input = ractive.find( 'input' );

	input.value = 'changed';

	// input events should trigger change
	fire( input, 'input' );
	t.equal( ractive.get( 'foo' ), 'changed' );
});

test( '`twoway=0` is not mistaken for `twoway`', t => {
	const ractive = new Ractive({
		el: fixture,
		template: '<input value="{{foo}}" twoway="0"/>'
	});

	const input = ractive.find( 'input' );

	input.value = 'changed';

	fire( input, 'input' );
	t.equal( ractive.get( 'foo' ), undefined );

	fire( input, 'change' );
	t.equal( ractive.get( 'foo' ), undefined );
});
