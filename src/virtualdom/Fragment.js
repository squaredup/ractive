import createItem from './items/createItem';
import createResolver from './resolvers/createResolver';

export default class Fragment {
	constructor ( options ) {
		this.owner = options.owner; // The item that owns this fragment - an element, section, partial, or attribute
		this.root = options.root;

		this.parent = this.owner.parentFragment;
		this.context = null;
		this.rendered = false;

		this.resolvers = [];

		this.items = options.template
			.map( ( template, index ) => createItem({ parentFragment: this, template, index }) );
	}

	bind ( context ) {
		this.context = context;
		this.items.forEach( item => item.bind() );
	}

	render () {
		if ( this.rendered ) throw new Error( 'Fragment is already rendered!' );

		if ( this.items.length === 1 ) {
			return this.items[0].render();
		}

		const docFrag = document.createDocumentFragment();
		this.items.forEach( item => docFrag.appendChild( item.render() ) );
		return docFrag;
	}

	resolve ( template, callback ) {
		if ( !this.context ) {
			return this.parent.resolve( template, callback );
		}

		const resolver = createResolver( this, template, callback );

		if ( !resolver.resolved ) {
			this.resolvers.push( resolver );
		}
	}

	toHtml () {
		return this.toString();
	}

	toString () {
		return this.items.map( item => item.toString() ).join( '' );
	}

	unbind () {
		this.items.forEach( item => item.unbind() );
	}
}
