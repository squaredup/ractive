import { test } from 'qunit';

test( 'Pattern observers on arrays fire correctly after mutations (mirror of test in observe.js)', t => {
	const ractive = new Ractive({
		data: {
			items: [ 'a', 'b', 'c' ]
		}
	});

	let lastKeypath;
	let lastValue;
	let observedLengthChange = false;

	ractive.observe( 'items.*', function ( n, o, k ) {
		lastKeypath = k;
		lastValue = n;

		if ( k === 'items.length' ) {
			observedLengthChange = true;
		}
	}, { init: false });

	ractive.push( 'items', 'd' );
	t.equal( lastKeypath, 'items.3' );
	t.equal( lastValue, 'd' );

	ractive.pop( 'items' );
	// TODO this appears to directly contradict related tests in observe.js???
	// t.equal( lastKeypath, 'items.3' );
	// t.equal( lastValue, undefined );

	t.ok( !observedLengthChange );

	ractive.set( 'items.length', 4 );
	t.ok( observedLengthChange );
});

test( '#if sections only render once when arrays are mutated', t => {
	const ractive = new Ractive({
		el: fixture,
		template: '{{#if list}}yes{{else}}no{{/if}}',
		data: {
			list: [ 'a', 'b', 'c' ]
		}
	});

	t.htmlEqual( fixture.innerHTML, 'yes' );

	ractive.push( 'list', 'd' );
	t.htmlEqual( fixture.innerHTML, 'yes' );

	ractive.splice( 'list', 0, 0, 'e', 'f' );
	t.htmlEqual( fixture.innerHTML, 'yes' );
});

// TODO reinstate this in some form. Commented out for purposes of #1740
// test( `Array shuffling only adjusts context and doesn't tear stuff down to rebuild it`, t => {
// 	let ractive = new Ractive({
// 		el: fixture,
// 		template: '{{#each items}}{{.name}}{{.name + "_expr"}}{{.[~/name]}}<span {{#.name}}ok{{/}} class="{{.name}}">{{.name}}</span>{{/each}}',
// 		data: { items: [ { name: 'foo' } ], name: 'name' }
// 	});

// 	t.htmlEqual( fixture.innerHTML, 'foofoo_exprfoo<span ok class="foo">foo</span>' );

// 	let iter = ractive.fragment.items[0].fragments[0],
// 		ref = iter.items[0],
// 		exp = iter.items[1],
// 		mem = iter.items[2],
// 		el = iter.items[3];

// 	// make sure these little suckers don't get re-rendered
// 	ref.node.data += 'a';
// 	exp.node.data += 'b';
// 	mem.node.data += 'c';

// 	ractive.unshift( 'items', { name: 'bar' } );

// 	t.htmlEqual( fixture.innerHTML, 'barbar_exprbar<span ok class="bar">bar</span>fooafoo_exprbfooc<span ok class="foo">foo</span>' );

// 	let shifted = ractive.fragment.items[0].fragments[1];
// 	t.strictEqual( iter, shifted );
// 	t.strictEqual( ref, shifted.items[0]);
// 	t.strictEqual( exp, shifted.items[1]);
// 	t.strictEqual( mem, shifted.items[2]);
// 	t.strictEqual( el, shifted.items[3]);
// });

function removedElementsTest ( action, fn ) {
	test( `Array elements removed via ${action} do not trigger updates in removed sections`, t => {
		let observed = false;
		let errored = false;

		t.expect( 5 );

		let ractive = new Ractive({
			debug: true,
			el: fixture,
			template: '{{#options}}{{get(this)}}{{/options}}',
			data: {
				options: [ 'a', 'b', 'c' ],
				get ( item ){
					if (!item ) errored = true;
					return item;
				}
			}
		});

		ractive.observe( 'options.2', function ( n, o ) {
			t.ok( !n );
			t.equal( o, 'c' );
			observed = true;
		}, { init: false } );

		t.ok( !observed );

		fn( ractive );

		t.ok( observed );
		t.ok( !errored );
	});
}

removedElementsTest( 'splice', ractive => ractive.splice( 'options', 1, 1 ) );
removedElementsTest( 'merge', ractive => ractive.merge( 'options', [ 'a', 'c' ] ) );
