import { warnIfDebug } from 'utils/log';
import { COMPONENT, INTERPOLATOR } from 'config/types';
import Item from './shared/Item';
import construct from 'Ractive/construct';
import initialise from 'Ractive/initialise';
import { create } from 'utils/object';
import { removeFromArray } from 'utils/array';
import { isArray } from 'utils/is';
import resolve from '../resolvers/resolve';
import { cancel, unbind } from 'shared/methodCallers';
import Hook from 'events/Hook';
import Fragment from '../Fragment';
import parseJSON from 'utils/parseJSON';

function removeFromLiveComponentQueries ( component ) {
	let instance = component.ractive;

	while ( instance ) {
		const query = instance._liveComponentQueries[ `_${component.name}` ];
		if ( query ) query._remove( component );

		instance = instance.parent;
	}
}

const teardownHook = new Hook( 'teardown' );

export default class Component extends Item {
	constructor ( options, ComponentConstructor ) {
		super( options );
		this.type = COMPONENT; // override ELEMENT from super

		const instance = create( ComponentConstructor.prototype );

		this.instance = instance;
		this.name = options.template.e;
		this.parentFragment = options.parentFragment;
		this.resolvers = [];
		this.complexMappings = [];

		if ( instance.el ) {
			warnIfDebug( `The <${this.name}> component has a default 'el' property; it has been disregarded` );
		}

		let partials = options.template.p || {};
		if ( !( 'content' in partials ) ) partials.content = options.template.f || [];
		this._partials = partials; // TEMP

		this.yielders = {};

		construct( this.instance, { partials });

		// add component-instance-specific properties
		instance.parent = this.parentFragment.ractive;
		//instance.container = options.container || null; TODO...?
		instance.root = instance.parent.root;
		instance.component = this;

		// for hackability, this could be an open option
		// for any ractive instance, but for now, just
		// for components and just for ractive...
		// TODO is this still used?
		//instance._inlinePartials = options.inlinePartials;
	}

	bind () {
		const viewmodel = this.instance.viewmodel;
		const childData = viewmodel.value;

		let initialising = true;

		// determine mappings
		if ( this.template.a ) {
			Object.keys( this.template.a ).forEach( localKey => {
				const template = this.template.a[ localKey ];

				if ( typeof template === 'string' ) {
					const parsed = parseJSON( template );
					viewmodel.joinKey( localKey ).set( parsed ? parsed.value : template );
				}

				else if ( isArray( template ) ) {
					if ( template.length === 1 && template[0].t === INTERPOLATOR ) {
						const model = resolve( this.parentFragment, template[0] );

						if ( model ) {
							viewmodel.map( localKey, model );

							if ( model.value === undefined && localKey in childData ) {
								model.set( childData[ localKey ] );
							}
						}

						else {
							const resolver = this.parentFragment.resolve( template[0].r, model => {
								viewmodel.map( localKey, model );
								viewmodel.clearUnresolveds( localKey );
							});

							// TODO is this necessary? or can the parentFragment handle cleanup?
							this.resolvers.push( resolver );
						}
					}

					else {
						const fragment = new Fragment({
							owner: this,
							template
						}).bind();

						const model = viewmodel.joinKey( localKey );
						model.set( fragment.valueOf() );

						// this is a *bit* of a hack
						fragment.bubble = () => {
							Fragment.prototype.bubble.call( fragment );
							model.set( fragment.valueOf() );
						};

						this.complexMappings.push( fragment );
					}
				}
			});
		}

		initialising = false;

		initialise( this.instance, {
			partials: this._partials
		}, {
			indexRefs: this.instance.isolated ? {} : this.parentFragment.indexRefs,
			keyRefs: this.instance.isolated ? {} : this.parentFragment.keyRefs
		});
	}

	bubble () {
		if ( !this.dirty ) {
			this.dirty = true;
			this.parentFragment.bubble();
		}
	}

	checkYielders () {
		Object.keys( this.yielders ).forEach( name => {
			if ( this.yielders[ name ].length > 1 ) {
				throw new Error( `A component template can only have one {{yield${name ? ' ' + name : ''}}} declaration at a time` );
			}
		});
	}

	detach () {
		return this.instance.detach();
	}

	find ( selector ) {
		return this.instance.fragment.find( selector );
	}

	findAll ( selector, queryResult ) {
		this.instance.fragment.findAll( selector, queryResult );
	}

	findComponent ( name ) {
		if ( this.name === name ) return this.instance;

		if ( this.instance.fragment ) {
			return this.instance.fragment.findComponent( name );
		}
	}

	findAllComponents ( name, queryResult ) {
		queryResult._test( this, true );
		this.instance.fragment.findAllComponents( name, queryResult );
	}

	firstNode () {
		return this.instance.fragment.firstNode();
	}

	// TODO can this be done in a less roundabout way?
	render () {
		var instance = this.instance;

		instance.render( this.parentFragment.findParentNode().cloneNode() );
		this.checkYielders();

		this.rendered = true;
		const docFrag = instance.fragment.detach();
		return docFrag;
	}

	toString () {
		return this.instance.toHTML();
	}

	unbind () {
		this.complexMappings.forEach( unbind );
		this.resolvers.forEach( unbind );

		const instance = this.instance;
		instance.viewmodel.teardown();
		instance.fragment.unbind();
		instance._observers.forEach( cancel );

		removeFromLiveComponentQueries( this );

		if ( instance.fragment.rendered && instance.el.__ractive_instances__ ) {
			removeFromArray( instance.el.__ractive_instances__, instance );
		}

		teardownHook.fire( instance );
	}

	unrender ( shouldDestroy ) {
		this.shouldDestroy = shouldDestroy;
		this.instance.unrender();
	}

	update () {
		this.instance.fragment.update();
		this.checkYielders();

		this.dirty = false;
	}
}