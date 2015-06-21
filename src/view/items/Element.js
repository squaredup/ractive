import { ELEMENT } from 'config/types';
import runloop from 'global/runloop';
import Item from './shared/Item';
import Fragment from '../Fragment';
import Attribute from './element/Attribute';
import Decorator from './element/Decorator';
import EventHandler from './element/EventHandler';
import Transition from './element/Transition';
import updateLiveQueries from './element/updateLiveQueries';
import { voidElementNames } from 'utils/html';
import { bind, render, unrender, update } from 'shared/methodCallers';
import { matches } from 'utils/dom';
import { defineProperty } from 'utils/object';
import selectBinding from './element/binding/selectBinding';

export default class Element extends Item {
	constructor ( options ) {
		super( options );

		this.liveQueries = []; // TODO rare case. can we handle differently?

		this.name = options.template.e.toLowerCase();
		this.isVoid = voidElementNames.test( this.name );

		// find parent element
		let fragment = this.parentFragment;
		while ( fragment ) {
			if ( fragment.owner.type === ELEMENT ) {
				this.parent = fragment.owner;
				break;
			}
			fragment = fragment.parent;
		}

		// create attributes
		this.attributeByName = {};
		this.attributes = [];

		if ( this.template.a ) {
			Object.keys( this.template.a ).forEach( name => {
				// TODO process this at parse time
				if ( name === 'twoway' || name === 'lazy' ) return;

				const attribute = new Attribute({
					name,
					element: this,
					parentFragment: this.parentFragment,
					template: this.template.a[ name ]
				});

				this.attributeByName[ name ] = attribute;
				this.attributes.push( attribute );
			});
		}

		// create decorator
		if ( this.template.o ) {
			this.decorator = new Decorator( this, this.template.o );
		}

		// attach event handlers
		this.eventHandlers = [];
		if ( this.template.v ) {
			Object.keys( this.template.v ).forEach( key => {
				const eventNames = key.split( '-' );
				const template = this.template.v[ key ];

				eventNames.forEach( eventName => {
					this.eventHandlers.push( new EventHandler( this, eventName, template ) );
				});
			});
		}

		// create children
		if ( options.template.f ) {
			this.fragment = new Fragment({
				template: options.template.f,
				owner: this
			});
		}

		this.binding = null; // filled in later
	}

	bind () {
		this.attributes.forEach( bind );
		this.eventHandlers.forEach( bind );

		if ( this.decorator ) this.decorator.bind();
		if ( this.fragment ) this.fragment.bind();

		// create two-way binding if necessary
		if ( this.binding = this.createTwowayBinding() ) this.binding.bind();
	}

	createTwowayBinding () {
		const attributes = this.template.a;

		if ( !attributes ) return null;

		const shouldBind = 'twoway' in attributes ?
			attributes.twoway === 0 || attributes.twoway === 'true' : // covers `twoway` and `twoway='true'`
			this.ractive.twoway;

		if ( !shouldBind ) return null;

		const Binding = selectBinding( this );

		if ( !Binding ) return null;

		const binding = new Binding( this );

		return binding && binding.model ?
			binding :
			null;
	}

	detach () {
		if ( this.decorator ) this.decorator.unrender();

		const parentNode = this.node.parentNode;
		if ( parentNode ) parentNode.removeChild( this.node );

		return this.node;
	}

	find ( selector ) {
		if ( matches( this.node, selector ) ) return this.node;
		if ( this.fragment ) {
			return this.fragment.find( selector );
		}
	}

	findAll ( selector, query ) {
		// Add this node to the query, if applicable, and register the
		// query on this element
		if ( query._test( this, true ) && query.live ) {
			this.liveQueries.push( query );
		}

		if ( this.fragment ) {
			this.fragment.findAll( selector, query );
		}
	}

	findComponent ( name ) {
		if ( this.fragment ) {
			return this.fragment.findComponent( name );
		}
	}

	findAllComponents ( name, queryResult ) {
		if ( this.fragment ) {
			this.fragment.findAllComponents( name, queryResult );
		}
	}

	firstNode () {
		return this.node;
	}

	getAttribute ( name ) {
		const attribute = this.attributeByName[ name ];
		return attribute ? attribute.getValue() : undefined;
	}

	render () {
		// TODO determine correct namespace
		const node = document.createElement( this.template.e );
		this.node = node;

		const context = this.parentFragment.findContext();

		defineProperty( node, '_ractive', {
			value: {
				events: {},
				context,
				keypath: context.getKeypath()
			}
		});

		if ( this.fragment ) {
			node.appendChild( this.fragment.render() );
		}

		this.attributes.forEach( render );
		this.eventHandlers.forEach( render );

		if ( this.decorator ) this.decorator.render(); // TODO this should only happen once render is complete
		if ( this.binding ) this.binding.render();

		updateLiveQueries( this );

		// transitions
		const transitionTemplate = this.template.t0 || this.template.t1;
		if ( transitionTemplate && this.ractive.transitionsEnabled ) {
			const transition = new Transition( this, transitionTemplate, true );
			runloop.registerTransition( transition );

			this._introTransition = transition; // so we can abort if it gets removed
		}

		return node;
	}

	toString () {
		const tagName = this.template.e;

		const attrs = this.attributes
			.map( attr => {
				return ` ${attr.toString()}`;
			})
			.join( '' );

		if ( this.isVoid ) {
			return `<${tagName}${attrs}>`;
		}

		const contents = this.fragment ?
			this.fragment.toString( !/^(?:script|style)$/i.test( this.template.e ) ) : // escape text unless script/style
			'';

		return `<${tagName}${attrs}>${contents}</${tagName}>`;
	}

	unbind () {
		if ( this.fragment ) {
			this.fragment.unbind();
		}
	}

	unrender ( shouldDestroy ) {
		// unrendering before intro completed? complete it now
		// TODO should be an API for aborting transitions
		let transition = this._introTransition;
		if ( transition ) transition.complete();

		// Detach as soon as we can
		if ( this.name === 'option' ) {
			// <option> elements detach immediately, so that
			// their parent <select> element syncs correctly, and
			// since option elements can't have transitions anyway
			this.detach();
		} else if ( shouldDestroy ) {
			runloop.detachWhenReady( this );
		}

		if ( this.fragment ) this.fragment.unrender();

		this.eventHandlers.forEach( unrender );

		if ( this.binding ) this.binding.unrender();
		if ( !shouldDestroy && this.decorator ) this.decorator.unrender();

		// outro transition
		const transitionTemplate = this.template.t0 || this.template.t2;
		if ( transitionTemplate && this.ractive.transitionsEnabled ) {
			const transition = new Transition( this, transitionTemplate, false );
			runloop.registerTransition( transition );
		}

		// special case
		const id = this.attributeByName.id;
		if ( id  ) {
			delete this.ractive.nodes[ id.getValue() ];
		}

		// TODO update live queries
		// TODO forms are a special case
	}

	update () {
		if ( this.dirty ) {
			this.attributes.forEach( update );
			this.eventHandlers.forEach( update );

			if ( this.decorator ) this.decorator.update();
			if ( this.fragment ) this.fragment.update();

			this.dirty = false;
		}
	}
}