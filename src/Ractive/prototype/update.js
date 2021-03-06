import Hook from '../../events/Hook';
import runloop from '../../global/runloop';
import { splitKeypath } from '../../shared/keypaths';

var updateHook = new Hook( 'update' );

export default function Ractive$update ( keypath ) {
	var promise, model;

	model = keypath ?
		this.viewmodel.joinAll( splitKeypath( keypath ) ) :
		this.viewmodel;

	promise = runloop.start( this, true );
	model.mark();
	runloop.end();

	updateHook.fire( this, model );

	return promise;
}
