import css from 'config/options/css/css';
import data from 'config/options/data';
import debug from 'config/options/debug';
import defaults from 'config/defaults/options';
import computed from 'config/options/computed';
import template from 'config/options/template/template';

import parseOptions from 'config/options/groups/parseOptions';
import registries from 'config/options/groups/registries';

import wrap from 'utils/wrapPrototypeMethod';
import deprecate from 'config/deprecate';


var custom, options, config;

custom = {
	data: data,
	debug: debug,
	computed: computed,
	template: template,
	css: css
};


// fill in basicConfig for all default options not covered by
// registries, parse options, and any custom configuration

options = Object.keys( defaults )
	.filter( key => !registries[ key ] && !custom[ key ] && !parseOptions[ key ] );

// this defines the order:
config = [].concat(
	custom.debug,
	custom.data,
	parseOptions,
	options,
	custom.computed,
	registries,
	custom.template,
	custom.css
);

for( let key in custom ) {
	config[ key ] = custom[ key ];
}

// for iteration
config.keys = Object.keys( defaults ).concat( registries.map( r => r.name ) ).concat( [ 'css' ] );

config.parseOptions = parseOptions;
config.registries = registries;


function customConfig ( method, key, Parent, instance, options ) {
	custom[ key ][ method ]( Parent, instance, options );
}

config.extend = function ( Parent, proto, options ) {

	configure ( 'extend', Parent, proto, options );
};

config.init = function ( Parent, ractive, options ) {

	configure ( 'init', Parent, ractive, options );

	if ( ractive._config ) {
		ractive._config.options = options;
	}

	// Breaking change
	// config.keys.forEach( key => {
	// 	options[ key ] = ractive[ key ];
	// });
};

function configure ( method, Parent, instance, options ) {

	deprecate( options );

	customConfig( method, 'data', Parent, instance, options );
	customConfig( method, 'debug', Parent, instance, options );

	config.parseOptions.forEach( key => {

		if( key in options ) {
			instance[ key ] = options[ key ];
		}

	})

	for ( let key in options ) {
		if( key in defaults && !( key in config.parseOptions ) && !( key in custom ) ) {
			let value = options[ key ];
			instance[ key ] = typeof value === 'function'
				? wrap( instance, Parent.prototype, key, value )
				: value;
		}
	}

	// customConfig( method, 'complete', Parent, instance, options );
	customConfig( method, 'computed', Parent, instance, options );

	config.registries.forEach( registry => {
		registry[ method ]( Parent, instance, options );
	});

	customConfig( method, 'template', Parent, instance, options );
	customConfig( method, 'css', Parent, instance, options );

}

config.reset = function ( ractive ) {
	return config.filter( c => {
		return c.reset && c.reset( ractive );
	});
};



export default config;



